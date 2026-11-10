// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useConversationViewModel } from './useConversationViewModel';
import { api } from '../services/api';
import { defaultCharacter } from '../models/catalog';
import type { Conversation } from '../models/types';

vi.mock('../services/api', () => ({
    api: { transcribe: vi.fn(), turn: vi.fn(), speech: vi.fn(), conversation: vi.fn() },
    ApiError: class extends Error {},
}));

const conversation: Conversation = {
    id: 'local-test',
    title: 'Test',
    character_id: 'friend',
    snapshot: defaultCharacter,
    language: 'en',
    level: 'B1',
    scene: 'park',
    messages: [],
    version: 0,
    created_at: '2026-11-05T00:00:00Z',
    updated_at: '2026-11-05T00:00:00Z',
};

class Recorder {
    static instances: Recorder[] = [];
    static isTypeSupported() {
        return true;
    }
    state = 'inactive';
    mimeType = 'audio/webm';
    ondataavailable: ((event: { data: Blob }) => void) | null = null;
    onstop: (() => void) | null = null;
    onerror: (() => void) | null = null;
    data = 'actual-test-recording';
    constructor() {
        Recorder.instances.push(this);
    }
    start() {
        this.state = 'recording';
    }
    pause() {
        this.state = 'paused';
    }
    resume() {
        this.state = 'recording';
    }
    stop() {
        this.state = 'inactive';
        this.ondataavailable?.({
            data: new Blob([this.data], { type: 'audio/webm' }),
        });
        this.onstop?.();
    }
}

let root: Root;
let vm: ReturnType<typeof useConversationViewModel>;
let stopTrack: ReturnType<typeof vi.fn>;
let capture: ReturnType<typeof vi.fn>;
let activeConversation: Conversation;

function Harness() {
    vm = useConversationViewModel(activeConversation, vi.fn());
    return null;
}

beforeEach(async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    activeConversation = conversation;
    Recorder.instances = [];
    stopTrack = vi.fn();
    capture = vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] });
    Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: { getUserMedia: capture },
    });
    vi.stubGlobal('MediaRecorder', Recorder);
    vi.mocked(api.transcribe).mockResolvedValue({ text: 'I enjoy music.' });
    vi.mocked(api.turn).mockResolvedValue({
        ...conversation,
        version: 1,
        messages: [
            {
                id: 'user-message',
                role: 'user',
                content: 'I enjoy music.',
                revision: 0,
                created_at: '',
            },
            {
                id: 'ai-message',
                role: 'assistant',
                content: 'Which music do you like?',
                revision: 0,
                created_at: '',
            },
        ],
    });
    // Speech is unavailable in this test; text must still be saved once.
    vi.mocked(api.speech).mockRejectedValue(new Error('Voice unavailable'));
    root = createRoot(document.createElement('div'));
    await act(async () => {
        root.render(<Harness />);
    });
});

afterEach(async () => {
    if (root) await act(async () => root.unmount());
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe('conversation playback and recording drafts', () => {
    it('pauses and resumes at the same time, and restarts cached audio and text from zero', async () => {
        class Player {
            static latest: Player;
            currentTime = 0;
            duration = 3;
            src = '';
            paused = true;
            ontimeupdate: (() => void) | null = null;
            onended: (() => void) | null = null;
            onerror: (() => void) | null = null;
            constructor() {
                Player.latest = this;
            }
            pause() {
                this.paused = true;
            }
            async play() {
                this.paused = false;
            }
        }
        vi.stubGlobal('Audio', Player);
        vi.mocked(api.speech).mockResolvedValue({
            audio: btoa('test-audio'),
            mime: 'audio/mpeg',
            provider: 'test',
            voice: 'test',
            timings: [
                { start: 0.1, end: 0.8, text: 'Hello' },
                { start: 1, end: 1.8, text: 'friend' },
                { start: 2, end: 2.8, text: 'again' },
            ],
        });
        await act(async () => {
            await vm.play({
                id: 'reply',
                role: 'assistant',
                content: 'Hello friend again.',
                revision: 0,
                created_at: '',
            });
        });
        const player = Player.latest;
        await act(async () => {
            player.currentTime = 1.4;
            player.ontimeupdate?.();
            vm.pauseAudio();
        });
        expect(vm.state).toBe('paused');
        expect(vm.displayText).toBe('Hello friend');
        expect(player.paused).toBe(true);
        const pausedText = vm.displayText;
        await act(async () => {
            await Promise.resolve();
        });
        expect(vm.displayText).toBe(pausedText);
        await act(async () => {
            await vm.continueAudio();
        });
        expect(player.currentTime).toBe(1.4);
        expect(vm.state).toBe('playing');
        await act(async () => {
            vm.pauseAudio();
        });
        await act(async () => {
            await vm.restartAudio();
        });
        expect(player.currentTime).toBe(0);
        expect(vm.progress).toBe(0);
        expect(vm.displayText).not.toContain('friend');
        expect(vm.state).toBe('playing');
        await act(async () => {
            player.currentTime = 3;
            player.onended?.();
        });
        expect(vm.displayText).toBe('Hello friend again.');
        await act(async () => {
            await vm.restartAudio();
        });
        expect(player.currentTime).toBe(0);
        expect(api.speech).toHaveBeenCalledTimes(1);
    });
    it('waits for a new user message after a refusal instead of generating an alternative', async () => {
        activeConversation = { ...conversation, awaiting_user: true };
        await act(async () => {
            root.render(<Harness />);
        });
        await act(async () => {
            await vm.send('topic');
            await vm.send('regenerate');
            await vm.send('start');
        });
        expect(api.turn).not.toHaveBeenCalled();
        await act(async () => {
            await vm.send('message', 'Can we talk about music?');
        });
        expect(api.turn).toHaveBeenCalledTimes(1);
        expect(api.turn).toHaveBeenCalledWith(
            'local-test',
            'message',
            'Can we talk about music?',
            0,
            expect.any(String),
        );
    });
    it('shows the selected replay text and ignores a retired player error on a new turn', async () => {
        class Player {
            static latest: Player;
            onended: (() => void) | null = null;
            ontimeupdate: (() => void) | null = null;
            onerror: (() => void) | null = null;
            currentTime = 0;
            duration = 10;
            constructor() {
                Player.latest = this;
            }
            set src(value: string) {
                if (!value) queueMicrotask(() => this.onerror?.());
            }
            async play() {}
            pause() {}
        }
        vi.stubGlobal('Audio', Player);
        vi.mocked(api.speech).mockResolvedValue({
            audio: btoa('test-audio'),
            mime: 'audio/mpeg',
            timings: [],
            provider: 'test',
            voice: 'test',
        });
        await act(async () => {
            await vm.play({
                id: 'old-message',
                role: 'assistant',
                content: 'Hello.',
                revision: 0,
                created_at: '',
            });
        });
        expect(vm.state).toBe('playing');
        await act(async () => {
            Player.latest.currentTime = 10;
            Player.latest.ontimeupdate?.();
        });
        expect(vm.displayText).toBe('Hello.');
        let finish!: (result: Conversation) => void;
        vi.mocked(api.turn).mockImplementation(
            () =>
                new Promise((resolve) => {
                    finish = resolve;
                }),
        );
        await act(async () => {
            void vm.send('message', 'Next question.');
            await Promise.resolve();
        });
        expect(vm.state).toBe('thinking');
        expect(vm.error).toBe('');
        await act(async () => {
            finish({ ...conversation, version: 1 });
        });
    });

    it('finishes locally and sends the captured blob only after an explicit send', async () => {
        await act(async () => {
            await vm.microphone();
        });
        expect(vm.state).toBe('recording');
        expect(api.transcribe).not.toHaveBeenCalled();
        expect(Recorder.instances[0].state).toBe('recording');
        await act(async () => {
            await vm.microphone();
        });
        expect(vm.state).toBe('recording-ready');
        expect(vm.recording.url).not.toBe('');
        expect(api.transcribe).not.toHaveBeenCalled();
        expect(api.turn).not.toHaveBeenCalled();
        await act(async () => {
            await vm.sendRecording();
        });
        expect(api.transcribe).toHaveBeenCalledTimes(1);
        const blob = vi.mocked(api.transcribe).mock.calls[0][1];
        expect(await blob.text()).toBe('actual-test-recording');
        expect(api.turn).toHaveBeenCalledTimes(1);
        expect(api.turn).toHaveBeenCalledWith(
            'local-test',
            'message',
            'I enjoy music.',
            0,
            expect.any(String),
        );
        expect(stopTrack).toHaveBeenCalledTimes(1);
    });

    it('shows permission refusal without inventing a transcription or sending a turn', async () => {
        capture.mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));
        await act(async () => {
            await vm.microphone();
        });
        expect(vm.state).toBe('error');
        expect(vm.error).toContain('Permita o microfone');
        expect(api.transcribe).not.toHaveBeenCalled();
        expect(api.turn).not.toHaveBeenCalled();
    });

    it('stops capture and discards an unfinished recording when leaving the conversation', async () => {
        await act(async () => {
            await vm.microphone();
        });
        await act(async () => root.unmount());
        expect(stopTrack).toHaveBeenCalledTimes(1);
        expect(Recorder.instances[0].state).toBe('inactive');
        expect(api.transcribe).not.toHaveBeenCalled();
    });

    it('retains the recording for retry after transcription failure, with no fictional message', async () => {
        vi.mocked(api.transcribe).mockRejectedValueOnce(new Error('Connection failed'));
        await act(async () => {
            await vm.microphone();
        });
        await act(async () => {
            await vm.microphone();
        });
        await act(async () => {
            await vm.sendRecording();
        });
        expect(vm.state).toBe('recording-ready');
        expect(vm.retryKind).toBe('upload');
        expect(api.turn).not.toHaveBeenCalled();
        const original = vi.mocked(api.transcribe).mock.calls[0][1];
        await act(async () => {
            await vm.retry();
        });
        expect(api.transcribe).toHaveBeenCalledTimes(2);
        expect(vi.mocked(api.transcribe).mock.calls[1][1]).toBe(original);
        expect(api.turn).toHaveBeenCalledTimes(1);
    });

    it('pauses capture and its clock, then resumes the same recording without sending', async () => {
        vi.useFakeTimers();
        await act(async () => { await vm.microphone(); });
        await act(async () => { vi.advanceTimersByTime(3000); });
        expect(vm.recordedSeconds).toBe(3);
        await act(async () => { vm.recording.pause(); });
        expect(vm.state).toBe('recording-paused');
        expect(Recorder.instances[0].state).toBe('paused');
        await act(async () => { vi.advanceTimersByTime(20_000); });
        expect(vm.recordedSeconds).toBe(3);
        await act(async () => { await vm.send('message', 'Do not send while paused'); });
        expect(api.turn).not.toHaveBeenCalled();
        await act(async () => { vm.recording.resume(); });
        await act(async () => { vi.advanceTimersByTime(2000); });
        expect(vm.recordedSeconds).toBe(5);
        expect(Recorder.instances).toHaveLength(1);
        await act(async () => { await vm.microphone(); });
        expect(vm.state).toBe('recording-ready');
        expect(api.transcribe).not.toHaveBeenCalled();
    });

    it('restarts from zero and ignores late events from the discarded recording', async () => {
        vi.useFakeTimers();
        await act(async () => { await vm.microphone(); });
        const first = Recorder.instances[0];
        first.data = 'discard this attempt';
        const lateStop = first.onstop;
        await act(async () => { vi.advanceTimersByTime(4000); vm.recording.pause(); });
        await act(async () => { await vm.restartRecording(); });
        expect(first.state).toBe('inactive');
        expect(vm.recordedSeconds).toBe(0);
        expect(vm.state).toBe('recording');
        expect(Recorder.instances).toHaveLength(2);
        await act(async () => { lateStop?.(); });
        expect(vm.state).toBe('recording');
        Recorder.instances[1].data = 'the replacement attempt';
        await act(async () => { await vm.microphone(); });
        expect(await vm.recording.blob!.text()).toBe('the replacement attempt');
        expect(api.transcribe).not.toHaveBeenCalled();
        await act(async () => { await vm.sendRecording(); });
        expect(await vi.mocked(api.transcribe).mock.calls[0][1].text()).toBe('the replacement attempt');
    });

    it('restarts a finished draft and releases its preview URL', async () => {
        const revoke = vi.spyOn(URL, 'revokeObjectURL');
        try {
            await act(async () => { await vm.microphone(); });
            await act(async () => { await vm.microphone(); });
            const originalUrl = vm.recording.url;
            await act(async () => { await vm.restartRecording(); });
            expect(revoke).toHaveBeenCalledWith(originalUrl);
            expect(vm.recording.blob).toBeNull();
            expect(vm.recording.url).toBe('');
            expect(vm.state).toBe('recording');
            expect(api.transcribe).not.toHaveBeenCalled();
        } finally {
            revoke.mockRestore();
        }
    });

    it('stops at the duration limit for review without uploading or sending a turn', async () => {
        vi.useFakeTimers();
        await act(async () => { await vm.microphone(); });
        await act(async () => { vi.advanceTimersByTime(120_000); });
        expect(vm.state).toBe('recording-ready');
        expect(vm.recordedSeconds).toBe(120);
        expect(vm.recording.notice).toContain('Limite de tempo');
        expect(api.transcribe).not.toHaveBeenCalled();
        expect(api.turn).not.toHaveBeenCalled();
        expect(stopTrack).toHaveBeenCalledTimes(1);
    });

    it('stops at the size limit for review without uploading', async () => {
        await act(async () => { await vm.microphone(); });
        await act(async () => {
            Recorder.instances[0].ondataavailable?.({ data: new Blob([new Uint8Array(7_800_000)]) });
        });
        expect(vm.state).toBe('recording-ready');
        expect(vm.recording.notice).toContain('Limite de tamanho');
        expect(api.transcribe).not.toHaveBeenCalled();
    });

    it('discards a paused recording and lets the user switch to text', async () => {
        await act(async () => { await vm.microphone(); });
        await act(async () => { vm.recording.pause(); });
        await act(async () => { vm.discardRecording(); });
        expect(vm.state).toBe('idle');
        expect(vm.hasRecording).toBe(false);
        expect(stopTrack).toHaveBeenCalledTimes(1);
        expect(api.transcribe).not.toHaveBeenCalled();
        await act(async () => { await vm.send('message', 'I prefer to type.'); });
        expect(api.turn).toHaveBeenCalledTimes(1);
    });

    it('discards a pending permission request even if the browser resolves it later', async () => {
        let grant!: (value: unknown) => void;
        capture.mockImplementationOnce(() => new Promise((resolve) => { grant = resolve; }));
        await act(async () => { void vm.microphone(); });
        expect(vm.state).toBe('permission');
        await act(async () => { vm.discardRecording(); });
        await act(async () => { grant({ getTracks: () => [{ stop: stopTrack }] }); });
        expect(vm.state).toBe('idle');
        expect(Recorder.instances).toHaveLength(0);
        expect(stopTrack).toHaveBeenCalledTimes(1);
        expect(api.transcribe).not.toHaveBeenCalled();
    });

    it('blocks duplicate uploads when send is clicked twice', async () => {
        await act(async () => { await vm.microphone(); });
        await act(async () => { await vm.microphone(); });
        await act(async () => { await Promise.all([vm.sendRecording(), vm.sendRecording()]); });
        expect(api.transcribe).toHaveBeenCalledTimes(1);
        expect(api.turn).toHaveBeenCalledTimes(1);
    });
});

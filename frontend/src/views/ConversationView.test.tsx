// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { ConversationView } from './ConversationView';
import { defaultCharacter } from '../models/catalog';
import type { Conversation } from '../models/types';
import { api } from '../services/api';

it('keeps only user-input and replay actions available after a prohibited message', async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const container = document.createElement('div');
    const root = createRoot(container);
    const refusal =
        'This content is not allowed in Marai. Please rephrase your question about an allowed topic.';
    const conversation: Conversation = {
        id: 'test',
        character_id: 'friend',
        title: 'Test',
        snapshot: defaultCharacter,
        language: 'en',
        level: 'B1',
        scene: 'park',
        version: 1,
        awaiting_user: true,
        created_at: '',
        updated_at: '',
        messages: [
            {
                id: 'refusal',
                role: 'assistant',
                content: refusal,
                revision: 0,
                created_at: '',
                blocked: true,
            },
        ],
    };
    try {
        await act(async () => {
            root.render(
                <ConversationView
                    conversation={conversation}
                    onUpdate={() => {}}
                    onBack={() => {}}
                />,
            );
        });
        expect(
            container.querySelector<HTMLButtonElement>('[aria-label="Outra resposta"]')!.disabled,
        ).toBe(true);
        expect(
            container.querySelector<HTMLButtonElement>('[aria-label="Trocar assunto"]')!.disabled,
        ).toBe(true);
        expect(container.querySelector<HTMLButtonElement>('.mic-button')!.disabled).toBe(false);
        expect(container.querySelector<HTMLButtonElement>('.text-entry-button')!.disabled).toBe(
            false,
        );
        expect(container.querySelector('.speech-text')!.textContent).toBe(refusal);
        expect(container.querySelector('.conversation-status')!.textContent).toContain(
            'reformule sua pergunta',
        );
        await act(async () => {
            root.render(
                <ConversationView
                    conversation={{ ...conversation, awaiting_user: false }}
                    onUpdate={() => {}}
                    onBack={() => {}}
                />,
            );
        });
        expect(
            container.querySelector<HTMLButtonElement>('[aria-label="Outra resposta"]')!.disabled,
        ).toBe(false);
        expect(
            container.querySelector<HTMLButtonElement>('[aria-label="Trocar assunto"]')!.disabled,
        ).toBe(false);
    } finally {
        await act(async () => root.unmount());
    }
});

it('offers recording controls and a local preview, and sends only from Enviar áudio', async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    class Recorder {
        static isTypeSupported() { return true; }
        state = 'inactive';
        mimeType = 'audio/webm';
        ondataavailable: ((event: { data: Blob }) => void) | null = null;
        onstop: (() => void) | null = null;
        start() { this.state = 'recording'; }
        pause() { this.state = 'paused'; }
        resume() { this.state = 'recording'; }
        stop() {
            this.state = 'inactive';
            this.ondataavailable?.({ data: new Blob(['my recording']) });
            this.onstop?.();
        }
    }
    const originalMedia = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
    Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop() {} }] }) },
    });
    vi.stubGlobal('MediaRecorder', Recorder);
    const conversation: Conversation = {
        id: 'draft-test', character_id: 'friend', title: 'Test', snapshot: defaultCharacter,
        language: 'en', level: 'B1', scene: 'park', version: 0, messages: [],
        created_at: '', updated_at: '',
    };
    const transcribe = vi.spyOn(api, 'transcribe').mockResolvedValue({ text: 'My answer.' });
    const turn = vi.spyOn(api, 'turn').mockResolvedValue({ ...conversation, version: 1 });
    const container = document.createElement('div');
    const root = createRoot(container);
    const control = (label: string) =>
        container.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;
    const click = async (button: HTMLButtonElement) => {
        expect(button.disabled).toBe(false);
        await act(async () => { button.click(); });
    };
    try {
        await act(async () => {
            root.render(<ConversationView conversation={conversation} onUpdate={() => {}} onBack={() => {}} />);
        });
        await click(container.querySelector('.mic-button')!);
        expect(transcribe).not.toHaveBeenCalled();
        await click(control('Pausar gravação'));
        expect(control('Pausar gravação').disabled).toBe(true);
        expect(container.querySelector('.conversation-status')!.textContent).toContain('Gravação pausada');
        await click(control('Continuar gravação'));
        await click(control('Reiniciar gravação'));
        expect(container.querySelector('.mic-button')!.textContent).toContain('Finalizar gravação');
        await click(container.querySelector('.mic-button')!);
        expect(container.querySelector('audio.recording-preview')).not.toBeNull();
        expect(transcribe).not.toHaveBeenCalled();
        expect(turn).not.toHaveBeenCalled();
        expect(container.querySelector('.mic-button')!.textContent).toContain('Enviar áudio');
        await click(container.querySelector('.mic-button')!);
        expect(transcribe).toHaveBeenCalledTimes(1);
        expect(turn).toHaveBeenCalledTimes(1);
    } finally {
        await act(async () => root.unmount());
        transcribe.mockRestore();
        turn.mockRestore();
        vi.unstubAllGlobals();
        if (originalMedia) Object.defineProperty(navigator, 'mediaDevices', originalMedia);
        else Reflect.deleteProperty(navigator, 'mediaDevices');
    }
});

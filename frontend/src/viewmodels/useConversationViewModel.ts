import { useCallback, useEffect, useRef, useState } from 'react';
import type { Conversation, ConversationState, Speech } from '../models/types';
import { api, ApiError } from '../services/api';
import { revealedText } from '../services/reveal';
import { useAudioRecorder } from './useAudioRecorder';

type Pending = {
    action: 'message' | 'start' | 'regenerate' | 'topic';
    text: string;
    id: string;
    version: number;
};

export function useConversationViewModel(
    conversation: Conversation,
    onUpdate: (c: Conversation) => void,
    maxSeconds = 120,
) {
    const [state, setState] = useState<ConversationState>('idle');
    const [error, setError] = useState('');
    const [text, setText] = useState('');
    const recording = useAudioRecorder(maxSeconds);
    const [revealed, setRevealed] = useState('');
    const [progress, setProgress] = useState(0);
    const [speechMessage, setSpeechMessage] = useState('');
    const [speechContent, setSpeechContent] = useState('');
    const activeSpeech = useRef<{ id: string; content: string; timings: Speech['timings'] } | null>(
        null,
    );
    const [retryKind, setRetryKind] = useState<'turn' | 'voice' | 'upload' | null>(null);
    const audio = useRef<HTMLAudioElement | null>(null);
    const audioUrl = useRef('');
    const alive = useRef(true);
    const pending = useRef<Pending | null>(null);
    const failedAudio = useRef<Blob | null>(null);
    const busyRef = useRef(false);
    const current = useRef(conversation);
    current.current = conversation;
    const messages = conversation.messages ?? [];
    const lastMessage = [...messages].reverse().find((m) => m.role === 'assistant');
    const responseBusy = ['uploading', 'thinking', 'voicing'].includes(state);
    const busy = responseBusy || ['permission', 'stopping'].includes(recording.status);
    const recordingStates: Partial<Record<typeof recording.status, ConversationState>> = {
        permission: 'permission',
        recording: 'recording',
        paused: 'recording-paused',
        stopping: 'recording-stopping',
        ready: 'recording-ready',
    };
    const displayState = responseBusy
        ? state
        : recordingStates[recording.status] ?? (recording.error ? 'error' : state);

    const stopAudio = useCallback(() => {
        if (audio.current) {
            // Retired players must not overwrite the state of a new recording or reply.
            audio.current.onended = null;
            audio.current.ontimeupdate = null;
            audio.current.onerror = null;
            audio.current.pause();
            audio.current.src = '';
            audio.current = null;
        }
        activeSpeech.current = null;
        if (audioUrl.current) {
            URL.revokeObjectURL(audioUrl.current);
            audioUrl.current = '';
        }
    }, []);

    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
            stopAudio();
        };
    }, [stopAudio]);

    function syncPlayback() {
        const player = audio.current;
        const speech = activeSpeech.current;
        if (!alive.current || !player || !speech) return;
        setRevealed(
            revealedText(speech.content, player.currentTime, player.duration, speech.timings),
        );
        setProgress(
            Number.isFinite(player.duration) && player.duration > 0
                ? player.currentTime / player.duration
                : 0,
        );
    }

    function pauseAudio() {
        if (!audio.current || busyRef.current || recording.hasDraft()) return;
        audio.current.pause();
        syncPlayback();
        setState('paused');
    }

    async function continueAudio() {
        const player = audio.current;
        if (!player || busyRef.current || recording.hasDraft()) return;
        try {
            await player.play();
            if (!alive.current || player !== audio.current) return;
            syncPlayback();
            setState('playing');
            setError('');
        } catch {
            if (!alive.current) return;
            setState('paused');
            setError(
                'O navegador não conseguiu iniciar o áudio. Clique em Continuar para tentar novamente.',
            );
        }
    }

    async function restartAudio() {
        const player = audio.current;
        if (busyRef.current || recording.hasDraft()) return;
        if (!player || !activeSpeech.current || state === 'error') {
            if (state === 'error') stopAudio();
            await play();
            return;
        }
        player.pause();
        player.currentTime = 0;
        setProgress(0);
        setRevealed('');
        await continueAudio();
    }

    async function play(message = lastMessage) {
        if (!message || busyRef.current || recording.hasDraft()) return;
        if (audio.current && activeSpeech.current?.id === message.id && state !== 'error') {
            await restartAudio();
            return;
        }
        busyRef.current = true;
        recording.discard();
        stopAudio();
        setState('voicing');
        setError('');
        setRetryKind(null);
        setRevealed(message.content);
        setSpeechContent(message.content);
        try {
            const result: Speech = await api.speech(conversation.id, message.id);
            if (!alive.current) return;
            const binary = Uint8Array.from(atob(result.audio), (c) => c.charCodeAt(0));
            const url = URL.createObjectURL(new Blob([binary], { type: result.mime }));
            audioUrl.current = url;
            const player = new Audio(url);
            audio.current = player;
            activeSpeech.current = {
                id: message.id,
                content: message.content,
                timings: result.timings,
            };
            setSpeechMessage(message.id);
            setProgress(0);
            player.ontimeupdate = syncPlayback;
            player.onended = () => {
                if (alive.current) {
                    setState('idle');
                    setRevealed(message.content);
                    setProgress(1);
                }
            };
            player.onerror = () => {
                if (alive.current) {
                    setState('error');
                    setError('Não foi possível reproduzir. Tente ouvir novamente.');
                    setRetryKind('voice');
                    setRevealed(message.content);
                }
            };
            try {
                setRevealed('');
                await player.play();
                if (alive.current) {
                    setState('playing');
                }
            } catch {
                setState('paused');
                syncPlayback();
                setError('Seu navegador pausou o áudio. Clique em Continuar para reproduzir.');
            }
        } catch (error) {
            if (alive.current) {
                setError((error as Error).message);
                setState('error');
                setRetryKind('voice');
                setRevealed(message.content);
            }
        } finally {
            busyRef.current = false;
        }
    }

    async function send(action: Pending['action'], content = '', retry = false) {
        if (current.current.awaiting_user && action !== 'message') return;
        if (busyRef.current || recording.hasDraft()) return;
        busyRef.current = true;
        recording.discard();
        stopAudio();
        setState('thinking');
        setError('');
        setRetryKind(null);
        if (!retry || !pending.current)
            pending.current = {
                action,
                text: content,
                id: crypto.randomUUID(),
                version: current.current.version,
            };
        const operation = pending.current;
        try {
            const result = await api.turn(
                conversation.id,
                operation.action,
                operation.text,
                operation.version,
                operation.id,
            );
            if (!alive.current) return;
            onUpdate(result);
            current.current = result;
            pending.current = null;
            if (action === 'message') setText('');
            const last = result.messages?.at(-1);
            setRevealed(last?.content ?? '');
            busyRef.current = false;
            if (last?.role === 'assistant') await play(last);
            else setState('idle');
        } catch (error) {
            if (!alive.current) return;
            if (error instanceof ApiError && error.status === 409) {
                pending.current = null;
                try {
                    onUpdate(await api.conversation(conversation.id));
                } catch {
                    /* Original error remains visible. */
                }
            }
            setError((error as Error).message);
            setState('error');
            setRetryKind(pending.current ? 'turn' : null);
        } finally {
            busyRef.current = false;
        }
    }

    async function upload(blob: Blob) {
        if (busyRef.current) return;
        busyRef.current = true;
        setState('uploading');
        setError('');
        failedAudio.current = blob;
        try {
            const result = await api.transcribe(conversation.id, blob);
            if (!alive.current) return;
            setText(result.text);
            failedAudio.current = null;
            recording.discard();
            busyRef.current = false;
            await send('message', result.text);
        } catch (error) {
            if (alive.current) {
                setError((error as Error).message);
                setState('error');
                setRetryKind('upload');
            }
        } finally {
            busyRef.current = false;
        }
    }

    async function microphone() {
        if (['recording', 'paused'].includes(recording.status)) {
            recording.stop();
            return;
        }
        if (busyRef.current || recording.hasDraft()) return;
        await restartRecording();
    }

    async function restartRecording() {
        if (busyRef.current) return;
        stopAudio();
        setState('idle');
        setError('');
        setRetryKind(null);
        failedAudio.current = null;
        await recording.start();
    }

    function discardRecording() {
        if (busyRef.current) return;
        recording.discard();
        failedAudio.current = null;
        setRetryKind(null);
        setError('');
        setState('idle');
    }

    async function sendRecording() {
        if (recording.status !== 'ready' || !recording.blob || busyRef.current) return;
        await upload(recording.blob);
    }

    async function toggleAudio() {
        if (state === 'playing' && audio.current) pauseAudio();
        else if (state === 'paused' && audio.current) await continueAudio();
        else if (audio.current && activeSpeech.current) await restartAudio();
        else await play();
    }
    async function retry() {
        if (retryKind === 'voice') await play();
        else if (retryKind === 'upload' && failedAudio.current) await upload(failedAudio.current);
        else if (pending.current) await send(pending.current.action, pending.current.text, true);
    }

    // A historical replay must show that message's text, rather than the latest reply.
    const displayText = speechMessage ? revealed : (lastMessage?.content ?? '');
    return {
        state: displayState,
        error: error || recording.error,
        text,
        setText,
        recordedSeconds: recording.seconds,
        recording,
        hasRecording: recording.hasDraft(),
        restartRecording,
        discardRecording,
        sendRecording,
        displayText,
        playbackText: speechContent || lastMessage?.content || '',
        progress,
        busy,
        lastMessage,
        send,
        microphone,
        toggleAudio,
        pauseAudio,
        continueAudio,
        restartAudio,
        play,
        retry,
        retryKind,
    };
}

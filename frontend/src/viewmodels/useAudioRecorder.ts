import { useCallback, useEffect, useRef, useState } from 'react';

type RecordingStatus = 'idle' | 'permission' | 'recording' | 'paused' | 'stopping' | 'ready' | 'error';
const MAX_BYTES = 7_800_000;

/** Owns a local recording draft. Network requests belong to the conversation ViewModel. */
export function useAudioRecorder(maxSeconds = 120) {
    const [status, setStatus] = useState<RecordingStatus>('idle');
    const [seconds, setSeconds] = useState(0);
    const [blob, setBlob] = useState<Blob | null>(null);
    const [url, setUrl] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const statusRef = useRef<RecordingStatus>('idle');
    const media = useRef<MediaRecorder | null>(null);
    const stream = useRef<MediaStream | null>(null);
    const timer = useRef<ReturnType<typeof setInterval> | null>(null);
    const elapsed = useRef(0);
    const started = useRef<number | null>(null);
    const draftUrl = useRef('');
    const generation = useRef(0);
    const alive = useRef(true);

    function transition(next: RecordingStatus) {
        statusRef.current = next;
        setStatus(next);
    }

    const clearTimer = useCallback(() => {
        if (timer.current !== null) clearInterval(timer.current);
        timer.current = null;
    }, []);

    const releaseCapture = useCallback(() => {
        clearTimer();
        const recorder = media.current;
        media.current = null;
        if (recorder) {
            recorder.ondataavailable = null;
            recorder.onstop = null;
            recorder.onerror = null;
            if (recorder.state !== 'inactive') recorder.stop();
        }
        stream.current?.getTracks().forEach((track) => track.stop());
        stream.current = null;
    }, [clearTimer]);

    const releaseUrl = useCallback(() => {
        if (draftUrl.current) URL.revokeObjectURL(draftUrl.current);
        draftUrl.current = '';
    }, []);

    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
            generation.current += 1;
            releaseCapture();
            releaseUrl();
        };
    }, [releaseCapture, releaseUrl]);

    function discard() {
        generation.current += 1;
        releaseCapture();
        releaseUrl();
        elapsed.current = 0;
        started.current = null;
        setSeconds(0);
        setBlob(null);
        setUrl('');
        setError('');
        setNotice('');
        transition('idle');
    }

    function activeMilliseconds() {
        return elapsed.current + (started.current === null ? 0 : Date.now() - started.current);
    }

    function saveElapsed() {
        elapsed.current = activeMilliseconds();
        started.current = null;
        setSeconds(Math.min(maxSeconds, Math.floor(elapsed.current / 1000)));
    }

    function stop(message = '') {
        const recorder = media.current;
        if (!recorder || !['recording', 'paused'].includes(statusRef.current)) return;
        saveElapsed();
        clearTimer();
        setNotice(message);
        transition('stopping');
        recorder.stop();
    }

    function startTimer() {
        clearTimer();
        timer.current = setInterval(() => {
            const milliseconds = activeMilliseconds();
            setSeconds(Math.min(maxSeconds, Math.floor(milliseconds / 1000)));
            if (milliseconds >= maxSeconds * 1000) {
                stop('Limite de tempo atingido. Ouça sua gravação antes de enviar.');
            }
        }, 250);
    }

    async function start() {
        if (statusRef.current === 'permission' || statusRef.current === 'stopping') return;
        discard();
        if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
            setError('Este navegador não permite gravar áudio. Use Chrome ou Edge, ou responda por texto.');
            transition('error');
            return;
        }
        const request = generation.current;
        transition('permission');
        try {
            const capture = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true },
                video: false,
            });
            if (!alive.current || request !== generation.current) {
                capture.getTracks().forEach((track) => track.stop());
                return;
            }
            stream.current = capture;
            const mime = [
                'audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus',
            ].find((type) => MediaRecorder.isTypeSupported(type));
            const recorder = new MediaRecorder(capture, mime ? { mimeType: mime } : undefined);
            media.current = recorder;
            const chunks: BlobPart[] = [];
            let size = 0;
            recorder.ondataavailable = (event) => {
                if (request !== generation.current || media.current !== recorder) return;
                if (event.data.size) {
                    chunks.push(event.data);
                    size += event.data.size;
                    if (size >= MAX_BYTES) stop('Limite de tamanho atingido. Ouça antes de enviar.');
                }
            };
            recorder.onerror = () => {
                if (!alive.current || request !== generation.current) return;
                releaseCapture();
                started.current = null;
                setError('Falha ao capturar o microfone. Tente novamente ou use texto.');
                transition('error');
            };
            recorder.onstop = () => {
                if (!alive.current || request !== generation.current || media.current !== recorder) return;
                saveElapsed();
                const recording = new Blob(chunks, { type: recorder.mimeType });
                releaseCapture();
                if (!recording.size) {
                    setError('Nenhum áudio foi capturado. Grave novamente ou responda por texto.');
                    transition('error');
                    return;
                }
                draftUrl.current = URL.createObjectURL(recording);
                setBlob(recording);
                setUrl(draftUrl.current);
                transition('ready');
            };
            recorder.start(250);
            started.current = Date.now();
            transition('recording');
            startTimer();
        } catch (failure) {
            if (!alive.current || request !== generation.current) return;
            releaseCapture();
            const name = (failure as DOMException).name;
            setError(name === 'NotAllowedError'
                ? 'Permita o microfone no navegador para gravar. Você também pode responder por texto.'
                : name === 'NotFoundError'
                  ? 'Nenhum microfone encontrado. Conecte um microfone ou responda por texto.'
                  : 'Não consegui acessar o microfone. Confira se outro aplicativo está usando o dispositivo.');
            transition('error');
        }
    }

    function pause() {
        if (statusRef.current !== 'recording' || !media.current) return;
        media.current.pause();
        saveElapsed();
        clearTimer();
        transition('paused');
    }

    function resume() {
        if (statusRef.current !== 'paused' || !media.current) return;
        media.current.resume();
        started.current = Date.now();
        transition('recording');
        startTimer();
    }

    function hasDraft() {
        return !['idle', 'error'].includes(statusRef.current);
    }

    return { status, seconds, blob, url, error, notice, start, pause, resume, stop, discard, hasDraft };
}

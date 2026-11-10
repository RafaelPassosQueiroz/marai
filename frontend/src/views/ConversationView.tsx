import { useEffect, useRef, useState } from 'react';
import {
    ArrowLeft,
    ArrowRightLeft,
    Check,
    ChevronDown,
    Keyboard,
    Languages,
    LoaderCircle,
    Mic,
    Pause,
    Play,
    RefreshCw,
    RotateCcw,
    Send,
    ShieldCheck,
    Square,
    Volume2,
    X,
} from 'lucide-react';
import type { Conversation } from '../models/types';
import { languages, scenes } from '../models/catalog';
import { Scene } from '../components/Scene';
import { Avatar } from '../components/Avatar';
import { useConversationViewModel } from '../viewmodels/useConversationViewModel';
import { SpeechText } from '../components/SpeechText';
import { useTranslationViewModel } from '../viewmodels/useTranslationViewModel';
import { TranslationPanel } from './TranslationPanel';

const states = {
    idle: 'Seu tempo, sua conversa.',
    permission: 'Aguardando permissão do microfone…',
    recording: 'Gravando sua resposta. Você pode pausar ou recomeçar.',
    'recording-paused': 'Gravação pausada. Continue quando quiser.',
    'recording-stopping': 'Preparando sua gravação para ouvir…',
    'recording-ready': 'Sua gravação está pronta. Ouça antes de enviar.',
    uploading: 'Enviando e reconhecendo sua fala…',
    thinking: 'Pensando em uma resposta…',
    voicing: 'Preparando a voz…',
    playing: 'Falando…',
    paused: 'Áudio pausado',
    error: 'Vamos tentar de novo?',
};

export function ConversationView({
    conversation,
    onUpdate,
    onBack,
    maxSeconds,
}: {
    conversation: Conversation;
    onUpdate: (c: Conversation) => void;
    onBack: () => void;
    maxSeconds?: number;
}) {
    const vm = useConversationViewModel(conversation, onUpdate, maxSeconds);
    const [textOpen, setTextOpen] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [translatorOpen, setTranslatorOpen] = useState(false);
    const translator = useTranslationViewModel(conversation.language);
    const translatorButton = useRef<HTMLButtonElement>(null);
    const [expanded, setExpanded] = useState(false);
    const controls = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (vm.hasRecording) {
            controls.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
        }
    }, [vm.hasRecording, vm.recording.status]);
    const messages = conversation.messages ?? [];
    const friend = conversation.snapshot;
    const started = messages.length > 0;
    const disabled = vm.busy || vm.hasRecording;
    const capturing = ['recording', 'paused'].includes(vm.recording.status);
    const recordingReady = vm.recording.status === 'ready';
    const formatTime = (seconds: number) =>
        `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    const awaitingUser = Boolean(conversation.awaiting_user);
    return (
        <main
            className={`conversation-page scene-${conversation.scene} ${expanded || vm.hasRecording ? 'expanded-response' : ''}`}
        >
            <Scene scene={conversation.scene} />
            <div className="scene-vignette" />
            <header className="conversation-header">
                <div className="conversation-person">
                    <button
                        className="icon-button mobile-back"
                        onClick={onBack}
                        disabled={disabled}
                        aria-label="Voltar ao início"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div className="mini-portrait">
                        <Avatar appearance={friend.appearance} name={friend.name} />
                    </div>
                    <div>
                        <h1>
                            {friend.name}
                            <span className="online-dot" />
                        </h1>
                        <span>
                            <b>{languages.find((l) => l.value === conversation.language)?.code}</b>{' '}
                            {languages.find((l) => l.value === conversation.language)?.label}{' '}
                            <i>·</i> Nível {conversation.level}
                        </span>
                    </div>
                </div>
                <div className="conversation-header-actions">
                    <button
                        className="button ghost"
                        disabled={disabled || !started || awaitingUser}
                        aria-label="Trocar assunto"
                        onClick={() => vm.send('topic')}
                    >
                        <ArrowRightLeft size={17} />
                        <span>Trocar assunto</span>
                    </button>
                    <button
                        className="button ghost"
                        disabled={disabled || !vm.lastMessage || awaitingUser}
                        aria-label="Outra resposta"
                        onClick={() => vm.send('regenerate')}
                    >
                        <RefreshCw size={17} />
                        <span>Outra resposta</span>
                    </button>
                    <button
                        className={`icon-button ${historyOpen ? 'active' : ''}`}
                        onClick={() => { setHistoryOpen(!historyOpen); setTranslatorOpen(false); }}
                        aria-label="Ver transcrição da conversa"
                        aria-expanded={historyOpen}
                    >
                        <svg
                            width={21}
                            height={21}
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M5.64 18.36A9 9 0 1 0 3 12v2" />
                            <path d="m1 12 2 2 2-2" />
                            <path d="M11 8v5h5" />
                        </svg>
                    </button>
                    <button
                        ref={translatorButton}
                        className={`icon-button ${translatorOpen ? 'active' : ''}`}
                        onClick={() => { setTranslatorOpen(!translatorOpen); setHistoryOpen(false); }}
                        aria-label="Abrir tradutor"
                        aria-expanded={translatorOpen}
                        aria-controls="translation-panel"
                    >
                        <Languages size={21} />
                    </button>
                </div>
            </header>
            <span className="scene-caption">
                <span className="little-dot" />{' '}
                {scenes.find((s) => s.value === conversation.scene)?.label}
            </span>
            <section className="conversation-stage">
                <div className="stage-avatar">
                    <Avatar
                        appearance={friend.appearance}
                        name={`${friend.name}, seu amigo fictício`}
                    />
                </div>
                <div className="speech-area">
                    {!started ? (
                        <div className="start-bubble">
                            <span className="eyebrow">UM OI JÁ É UM COMEÇO</span>
                            <h2>
                                Quem puxa
                                <br />o primeiro assunto?
                            </h2>
                            <p>
                                Sem roteiro, sem pressão.
                                <br />A conversa pode levar a qualquer lugar.
                            </p>
                            <button
                                className="button primary"
                                disabled={disabled}
                                onClick={() => vm.microphone()}
                            >
                                <Mic size={17} /> Quero começar
                            </button>
                            <button
                                className="button secondary"
                                disabled={disabled}
                                onClick={() => vm.send('start')}
                            >
                                Deixe meu amigo começar <ArrowRightLeft size={17} />
                            </button>
                            <span className="start-tip">
                                Você também pode começar por texto abaixo.
                            </span>
                        </div>
                    ) : (
                        <div
                            className={`speech-bubble ${vm.state === 'playing' ? 'is-speaking' : ''}`}
                        >
                            <div className="speech-tools">
                                <div
                                    className="speech-audio-actions"
                                    role="group"
                                    aria-label="Reprodução de áudio"
                                >
                                    <button
                                        className="speech-control"
                                        aria-label="Pausar áudio"
                                        disabled={vm.state !== 'playing'}
                                        onClick={vm.pauseAudio}
                                    >
                                        <Pause size={14} /> Pausar
                                    </button>
                                    <button
                                        className="speech-control"
                                        aria-label="Continuar áudio"
                                        disabled={vm.state !== 'paused'}
                                        onClick={vm.continueAudio}
                                    >
                                        <Play size={14} /> Continuar
                                    </button>
                                    <button
                                        className="speech-control"
                                        aria-label="Reiniciar áudio"
                                        disabled={disabled}
                                        onClick={vm.restartAudio}
                                    >
                                        <RotateCcw size={14} /> Reiniciar
                                    </button>
                                </div>
                                <div
                                    className={`waveform ${vm.state === 'playing' ? 'animated' : ''}`}
                                    aria-hidden="true"
                                >
                                    {Array.from({ length: 23 }, (_, index) => (
                                        <i
                                            key={index}
                                            style={{
                                                height: `${7 + Math.sin(index * 0.83) ** 2 * 22}px`,
                                                animationDelay: `${index * -0.06}s`,
                                            }}
                                        />
                                    ))}
                                </div>
                                <span className="speech-caption">
                                    {vm.state === 'playing'
                                        ? 'Pode ouvir, sem pressa.'
                                        : 'Uma conversa de cada vez.'}
                                </span>
                            </div>
                            <SpeechText
                                text={vm.displayText}
                                fullText={vm.playbackText}
                                language={conversation.language}
                                onExpanded={setExpanded}
                            />
                            <div
                                className="audio-progress"
                                role="progressbar"
                                aria-label="Progresso do áudio"
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={Math.round(vm.progress * 100)}
                            >
                                <span style={{ width: `${vm.progress * 100}%` }} />
                            </div>
                        </div>
                    )}
                    {started && (
                        <div className="fiction-note">
                            <ShieldCheck size={13} /> Amigo fictício · Sem correções, só conversa
                        </div>
                    )}
                </div>
            </section>
            <div className="conversation-bottom">
                {vm.error && (
                    <div className="conversation-error" role="alert">
                        <span>{vm.error}</span>
                        {vm.retryKind && (
                            <button
                                className="text-button"
                                disabled={vm.busy}
                                onClick={() => vm.retry()}
                            >
                                <RefreshCw size={14} /> Tentar novamente
                            </button>
                        )}
                    </div>
                )}
                <div className="conversation-controls" ref={controls}>
                    <div className={`conversation-status status-${vm.state}`} aria-live="polite">
                        {vm.busy ? (
                            <LoaderCircle size={15} className="spin" />
                        ) : (
                            <span className="little-dot" />
                        )}
                        {awaitingUser && vm.state === 'idle'
                            ? 'É sua vez: reformule sua pergunta para continuar.'
                            : states[vm.state]}
                        {vm.hasRecording && vm.recording.status !== 'permission' && (
                            <b>
                                {formatTime(vm.recordedSeconds)} / {formatTime(maxSeconds ?? 120)}
                            </b>
                        )}
                    </div>
                    <div className="control-buttons">
                        <button
                            className={`button mic-button ${capturing ? 'recording' : ''}`}
                            disabled={vm.busy}
                            onClick={() => recordingReady ? vm.sendRecording() : vm.microphone()}
                        >
                            {recordingReady ? (
                                <Send size={19} />
                            ) : capturing ? (
                                <Square size={18} fill="currentColor" />
                            ) : (
                                <Mic size={21} />
                            )}
                            {recordingReady ? 'Enviar áudio' : capturing ? 'Finalizar gravação' : 'Gravar resposta'}
                            <span className="mic-key">
                                {recordingReady ? 'ENVIAR' : capturing ? 'REVISAR' : 'MIC'}
                            </span>
                        </button>
                        <button
                            className={`button text-entry-button ${textOpen ? 'selected' : ''}`}
                            disabled={disabled}
                            onClick={() => setTextOpen(!textOpen)}
                        >
                            <Keyboard size={21} /> Responder por texto{' '}
                            <ChevronDown size={15} className={textOpen ? 'rotate' : ''} />
                        </button>
                        {started && (
                            <button
                                className="icon-button audio-toggle"
                                disabled={disabled}
                                onClick={() => vm.toggleAudio()}
                                aria-label={
                                    vm.state === 'playing'
                                        ? 'Pausar resposta'
                                        : 'Reproduzir resposta'
                                }
                            >
                                {vm.state === 'playing' ? <Pause size={21} /> : <Play size={21} />}
                            </button>
                        )}
                    </div>
                    {vm.hasRecording && (
                        <div className="recording-panel">
                            <div className="recording-actions" role="group" aria-label="Controles da sua gravação">
                                <button
                                    className="speech-control"
                                    aria-label="Pausar gravação"
                                    disabled={vm.busy || vm.recording.status !== 'recording'}
                                    onClick={vm.recording.pause}
                                >
                                    <Pause size={15} /> Pausar
                                </button>
                                <button
                                    className="speech-control"
                                    aria-label="Continuar gravação"
                                    disabled={vm.busy || vm.recording.status !== 'paused'}
                                    onClick={vm.recording.resume}
                                >
                                    <Play size={15} /> Continuar
                                </button>
                                <button
                                    className="speech-control"
                                    aria-label="Reiniciar gravação"
                                    disabled={vm.busy}
                                    onClick={() => vm.restartRecording()}
                                >
                                    <RotateCcw size={15} /> Reiniciar
                                </button>
                                <button
                                    className="speech-control recording-discard"
                                    aria-label="Descartar gravação"
                                    disabled={vm.busy && vm.recording.status !== 'permission'}
                                    onClick={vm.discardRecording}
                                >
                                    <X size={15} /> Descartar
                                </button>
                            </div>
                            {recordingReady && vm.recording.url && !vm.busy && (
                                <audio
                                    className="recording-preview"
                                    controls
                                    preload="metadata"
                                    src={vm.recording.url}
                                    aria-label="Ouvir sua gravação antes de enviar"
                                />
                            )}
                            {vm.recording.notice && (
                                <p className="recording-notice" role="status">{vm.recording.notice}</p>
                            )}
                        </div>
                    )}
                    {textOpen && (
                        <form
                            className="text-composer"
                            onSubmit={(event) => {
                                event.preventDefault();
                                if (vm.text.trim()) void vm.send('message', vm.text);
                            }}
                        >
                            <label className="sr-only" htmlFor="message-input">
                                Sua mensagem
                            </label>
                            <input
                                id="message-input"
                                autoFocus
                                value={vm.text}
                                onChange={(event) => vm.setText(event.target.value)}
                                placeholder={`Escreva em ${languages.find((l) => l.value === conversation.language)?.label.toLowerCase()}…`}
                                maxLength={4000}
                                disabled={disabled}
                            />
                            <button
                                className="icon-button send-button"
                                type="submit"
                                disabled={disabled || !vm.text.trim()}
                                aria-label="Enviar mensagem"
                            >
                                <Send size={19} />
                            </button>
                        </form>
                    )}
                    <span className="control-hint">
                        {recordingReady
                            ? 'Só será enviado ao clicar em Enviar áudio. Reiniciar apaga esta tentativa.'
                            : vm.hasRecording
                              ? 'Pause, continue ou reinicie. Finalizar gravação permite ouvir antes de enviar.'
                              : 'Grave no seu tempo, ouça sua resposta e envie quando estiver pronto.'}
                    </span>
                </div>
                <div className="conversation-footer">
                    <span>
                        <ShieldCheck size={12} /> Amizade com respeito, sempre.
                    </span>
                    <span>
                        <Check size={12} /> Conversa salva automaticamente
                    </span>
                </div>
            </div>
            {translatorOpen && <TranslationPanel vm={translator} onClose={() => {
                setTranslatorOpen(false);
                translatorButton.current?.focus();
            }} />}
            {historyOpen && (
                <aside className="transcript-panel" aria-label="Transcrição da conversa">
                    <div className="transcript-heading">
                        <div>
                            <span className="eyebrow">PALAVRAS QUE FICAM</span>
                            <h2>Nossa conversa</h2>
                        </div>
                        <button
                            className="icon-button"
                            onClick={() => setHistoryOpen(false)}
                            aria-label="Fechar transcrição"
                        >
                            <X size={20} />
                        </button>
                    </div>
                    <div className="transcript-messages">
                        {messages.length ? (
                            messages.map((m) => (
                                <article key={m.id} className={`transcript-message ${m.role}`}>
                                    <strong>{m.role === 'user' ? 'Você' : friend.name}</strong>
                                    <p lang={conversation.language}>{m.content}</p>
                                    {m.role === 'assistant' && (
                                        <button
                                            className="text-button"
                                            disabled={disabled}
                                            onClick={() => vm.play(m)}
                                        >
                                            <Volume2 size={14} /> Ouvir
                                        </button>
                                    )}
                                </article>
                            ))
                        ) : (
                            <p>As mensagens aparecerão aqui quando a conversa começar.</p>
                        )}
                    </div>
                </aside>
            )}
        </main>
    );
}

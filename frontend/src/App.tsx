import { useEffect, useState } from 'react';
import { Check, Edit3, LoaderCircle, LogOut, ShieldCheck, Trash2 } from 'lucide-react';
import type { Conversation } from './models/types';
import { useAppViewModel } from './viewmodels/useAppViewModel';
import { Sidebar } from './components/Sidebar';
import { Modal } from './components/Modal';
import { Logo } from './components/Logo';
import { AuthView } from './views/AuthView';
import { HomeView } from './views/HomeView';
import { EditorView } from './views/EditorView';
import { ConversationView } from './views/ConversationView';

export default function App() {
    const vm = useAppViewModel();
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [managing, setManaging] = useState<Conversation | null>(null);
    const [title, setTitle] = useState('');
    const [deleting, setDeleting] = useState(false);
    const [modalBusy, setModalBusy] = useState(false);
    const [modalError, setModalError] = useState('');
    const [reduced, setReduced] = useState(
        () => localStorage.getItem('marai:reduced-motion') === 'true',
    );
    useEffect(() => {
        document.documentElement.classList.toggle('reduced-motion', reduced);
        localStorage.setItem('marai:reduced-motion', String(reduced));
    }, [reduced]);
    useEffect(() => {
        const handler = () => vm.setPage('home');
        window.addEventListener('marai:home', handler);
        return () => window.removeEventListener('marai:home', handler);
    }, [vm.setPage]);
    function manage(c: Conversation) {
        setManaging(c);
        setTitle(c.title);
        setDeleting(false);
        setModalError('');
    }
    async function saveManage() {
        if (!managing) return;
        setModalBusy(true);
        setModalError('');
        try {
            if (deleting) await vm.removeConversation(managing.id);
            else await vm.renameConversation(managing.id, title);
            setManaging(null);
        } catch (error) {
            setModalError((error as Error).message);
        } finally {
            setModalBusy(false);
        }
    }
    if (vm.loading && !vm.user)
        return (
            <div className="initial-loading">
                <Logo />
                <LoaderCircle className="spin" />
                <p>Preparando boas conversas…</p>
            </div>
        );
    if (!vm.user)
        return (
            <>
                {vm.error && (
                    <div className="startup-error" role="alert">
                        {vm.error}
                        <button onClick={() => location.reload()}>Tentar novamente</button>
                    </div>
                )}
                <AuthView onLogin={vm.setUser} config={vm.config} />
            </>
        );
    return (
        <div className={`app-shell ${vm.page === 'conversation' ? 'immersive' : ''}`}>
            <Sidebar
                user={vm.user}
                conversations={vm.conversations}
                current={vm.conversation?.id}
                page={vm.page}
                onHome={() => vm.setPage('home')}
                onNew={() => vm.editCharacter()}
                onOpen={vm.openConversation}
                onManage={manage}
                onSettings={() => setSettingsOpen(true)}
                onLogout={vm.logout}
            />
            <div className="app-content">
                {vm.error && (
                    <div className="global-error" role="alert">
                        {vm.error}
                        <button onClick={() => vm.setError('')}>Fechar</button>
                    </div>
                )}
                {vm.loading && (
                    <div className="loading-overlay" role="status">
                        <LoaderCircle className="spin" /> Recuperando sua conversa…
                    </div>
                )}
                {vm.page === 'home' && (
                    <HomeView
                        user={vm.user}
                        conversations={vm.conversations}
                        characters={vm.characters}
                        onNew={vm.editCharacter}
                        onOpen={vm.openConversation}
                    />
                )}
                {vm.page === 'editor' && (
                    <EditorView
                        key={vm.editing?.id ?? 'new'}
                        initial={vm.editing}
                        onCreated={vm.openConversation}
                        onSaved={vm.refresh}
                        onBack={() => vm.setPage('home')}
                    />
                )}
                {vm.page === 'conversation' && vm.conversation && (
                    <ConversationView
                        key={vm.conversation.id}
                        conversation={vm.conversation}
                        onUpdate={vm.updateConversation}
                        onBack={() => vm.setPage('home')}
                        maxSeconds={vm.config?.max_audio_seconds}
                    />
                )}
            </div>
            {settingsOpen && (
                <Modal title="Seu espaço" onClose={() => setSettingsOpen(false)}>
                    <div className="settings-account">
                        <span className="account-avatar">{vm.user.name[0]}</span>
                        <div>
                            <strong>{vm.user.name}</strong>
                            <p>{vm.user.email}</p>
                        </div>
                    </div>
                    <label className="settings-toggle">
                        <div>
                            <strong>Reduzir animações</strong>
                            <small>Uma experiência com menos movimento.</small>
                        </div>
                        <input
                            type="checkbox"
                            checked={reduced}
                            onChange={(e) => setReduced(e.target.checked)}
                        />
                    </label>
                    <div className="settings-info">
                        <ShieldCheck size={21} />
                        <p>
                            Seu amigo é um personagem fictício. As conversas são de amizade, sem
                            paquera ou conteúdo sexual. Seu áudio é processado para transcrição e
                            não é salvo pelo Marai.
                        </p>
                    </div>
                    <p className="muted">
                        Para gravar, permita o microfone no navegador. Se preferir, use “Responder
                        por texto”.
                    </p>
                    <button
                        className="button secondary full"
                        onClick={async () => {
                            setSettingsOpen(false);
                            await vm.logout();
                        }}
                    >
                        <LogOut size={17} /> Sair da conta
                    </button>
                </Modal>
            )}
            {managing && (
                <Modal
                    title={deleting ? 'Excluir esta conversa?' : 'Sua conversa'}
                    onClose={() => {
                        if (!modalBusy) setManaging(null);
                    }}
                >
                    {deleting ? (
                        <p>
                            As mensagens de “{managing.title}” serão excluídas. Seu personagem
                            continuará salvo. Esta ação não pode ser desfeita.
                        </p>
                    ) : (
                        <label>
                            Nome da conversa
                            <input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                maxLength={100}
                            />
                        </label>
                    )}
                    {modalError && (
                        <p className="error" role="alert">
                            {modalError}
                        </p>
                    )}
                    <div className="modal-actions">
                        {!deleting && (
                            <button
                                className="text-button danger-text"
                                onClick={() => setDeleting(true)}
                            >
                                <Trash2 size={16} /> Excluir
                            </button>
                        )}
                        <button
                            className="button secondary"
                            disabled={modalBusy}
                            onClick={() => (deleting ? setDeleting(false) : setManaging(null))}
                        >
                            Cancelar
                        </button>
                        <button
                            className={`button ${deleting ? 'danger' : 'primary'}`}
                            disabled={modalBusy || !title.trim()}
                            onClick={saveManage}
                        >
                            {modalBusy ? (
                                <LoaderCircle className="spin" size={17} />
                            ) : deleting ? (
                                <Trash2 size={16} />
                            ) : (
                                <Check size={16} />
                            )}
                            {deleting ? 'Sim, excluir' : 'Salvar nome'}
                        </button>
                    </div>
                    {!deleting && (
                        <button
                            className="text-button edit-persona-link"
                            onClick={() => {
                                const character = vm.characters.find(
                                    (c) => c.id === managing.character_id,
                                );
                                if (character) {
                                    setManaging(null);
                                    vm.editCharacter(character);
                                }
                            }}
                        >
                            <Edit3 size={15} /> Editar aparência e personalidade do amigo
                        </button>
                    )}
                </Modal>
            )}
        </div>
    );
}

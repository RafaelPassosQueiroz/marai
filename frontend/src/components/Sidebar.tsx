import {
    Home,
    LogOut,
    Menu,
    MessageCircle,
    MoreHorizontal,
    Plus,
    Settings,
    Sparkles,
    X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Conversation, User } from '../models/types';
import { languages } from '../models/catalog';
import { Avatar } from './Avatar';
import { Logo } from './Logo';

export function Sidebar({
    user,
    conversations,
    current,
    page,
    onHome,
    onNew,
    onOpen,
    onManage,
    onSettings,
    onLogout,
}: {
    user: User;
    conversations: Conversation[];
    current?: string;
    page: string;
    onHome: () => void;
    onNew: () => void;
    onOpen: (id: string) => void;
    onManage: (conversation: Conversation) => void;
    onSettings: () => void;
    onLogout: () => void;
}) {
    const [pinned, setPinned] = useState(false);
    const [mobile, setMobile] = useState(false);
    const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 600px)').matches);
    useEffect(() => {
        const query = window.matchMedia('(max-width: 600px)');
        const update = () => {
            setIsMobile(query.matches);
            if (!query.matches) setMobile(false);
        };
        query.addEventListener('change', update);
        return () => query.removeEventListener('change', update);
    }, []);
    const collapsed = page === 'conversation' && !pinned;
    function navigate(action: () => void) {
        action();
        setMobile(false);
    }
    return (
        <>
            <button
                className="mobile-menu-button icon-button"
                onClick={() => setMobile(true)}
                aria-label="Abrir menu de conversas"
                aria-controls="marai-sidebar"
                aria-expanded={mobile}
            >
                <Menu size={22} />
            </button>
            {mobile && <div className="sidebar-backdrop" onClick={() => setMobile(false)} />}
            <aside
                id="marai-sidebar"
                inert={isMobile && !mobile}
                aria-hidden={isMobile && !mobile}
                className={`sidebar ${page === 'conversation' ? 'conversation-sidebar' : ''} ${collapsed ? 'collapsed' : ''} ${mobile ? 'mobile-open' : ''}`}
            >
                <div className="sidebar-logo">
                    <Logo />
                    <button
                        className="icon-button sidebar-pin"
                        onClick={() => {
                            if (mobile) setMobile(false);
                            else if (page === 'conversation') setPinned(!pinned);
                        }}
                        aria-label={
                            mobile ? 'Fechar menu' : pinned ? 'Recolher menu' : 'Fixar menu aberto'
                        }
                    >
                        {mobile ? <X size={18} /> : <Menu size={18} />}
                    </button>
                </div>
                <button
                    className="new-conversation-button"
                    onClick={() => navigate(onNew)}
                    aria-label="Nova conversa"
                >
                    <Plus size={19} />
                    <span>Nova conversa</span>
                    <span className="new-shortcut">+</span>
                </button>
                <nav className="sidebar-nav" aria-label="Navegação principal">
                    <button
                        className={page === 'home' ? 'active' : ''}
                        onClick={() => navigate(onHome)}
                        aria-label="Meu início"
                    >
                        <Home size={21} />
                        <span>Meu início</span>
                    </button>
                    <button
                        className={page === 'conversation' ? 'active' : ''}
                        aria-label="Minhas conversas"
                        onClick={() =>
                            navigate(conversations[0] ? () => onOpen(conversations[0].id) : onHome)
                        }
                    >
                        <MessageCircle size={21} />
                        <span>Minhas conversas</span>
                        {conversations.length > 0 && <small>{conversations.length}</small>}
                    </button>
                    <button onClick={() => navigate(onSettings)} aria-label="Configurações">
                        <Settings size={21} />
                        <span>Configurações</span>
                    </button>
                </nav>
                <div className="sidebar-history">
                    <div className="history-label">
                        <span>CONVERSAS SALVAS</span>
                        <MessageCircle size={14} />
                    </div>
                    {conversations.length ? (
                        conversations.map((c) => (
                            <div
                                key={c.id}
                                className={`history-item ${current === c.id && page === 'conversation' ? 'active' : ''}`}
                            >
                                <button
                                    className="history-open"
                                    aria-label={`Retomar conversa com ${c.snapshot.name}: ${c.title}`}
                                    onClick={() => navigate(() => onOpen(c.id))}
                                >
                                    <div className="history-avatar">
                                        <Avatar
                                            appearance={c.snapshot.appearance}
                                            name={c.snapshot.name}
                                        />
                                    </div>
                                    <span>
                                        <strong>
                                            {c.snapshot.name}
                                            <small>
                                                {' '}
                                                ·{' '}
                                                {
                                                    languages.find((l) => l.value === c.language)
                                                        ?.code
                                                }
                                            </small>
                                        </strong>
                                        <small>{c.title}</small>
                                    </span>
                                </button>
                                <button
                                    className="icon-button history-manage"
                                    onClick={() => onManage(c)}
                                    aria-label={`Gerenciar conversa com ${c.snapshot.name}`}
                                >
                                    <MoreHorizontal size={17} />
                                </button>
                            </div>
                        ))
                    ) : (
                        <p className="history-empty">
                            Suas próximas histórias
                            <br />
                            vão morar aqui.
                        </p>
                    )}
                </div>
                <div className="sidebar-bottom">
                    <div className="sidebar-note">
                        <Sparkles size={18} />
                        <p>
                            Sem medo de errar.
                            <br />
                            <strong>Só vontade de conversar.</strong>
                        </p>
                    </div>
                    <div className="sidebar-account">
                        <button
                            onClick={onSettings}
                            className="account-info"
                            aria-label="Minha conta e configurações"
                        >
                            <span className="account-avatar">{user.name[0]?.toUpperCase()}</span>
                            <span>
                                <strong>{user.name}</strong>
                                <small>Meu espaço</small>
                            </span>
                        </button>
                        <button
                            className="icon-button"
                            onClick={onLogout}
                            aria-label="Sair da conta"
                        >
                            <LogOut size={17} />
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
}

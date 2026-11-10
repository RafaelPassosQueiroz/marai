import { useState, type FormEvent } from 'react';
import {
    ArrowRight,
    Check,
    Globe2,
    Headphones,
    LoaderCircle,
    MessageCircle,
    ShieldCheck,
} from 'lucide-react';
import { api } from '../services/api';
import type { Config, User } from '../models/types';
import { defaultCharacter } from '../models/catalog';
import { Avatar } from '../components/Avatar';
import { Scene } from '../components/Scene';
import { Logo } from '../components/Logo';

export function AuthView({
    onLogin,
    config,
}: {
    onLogin: (user: User) => void;
    config: Config | null;
}) {
    const [mode, setMode] = useState<'login' | 'register'>('register');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const params = new URLSearchParams(location.search);
    const [error, setError] = useState(
        params.get('auth_error') === 'existing'
            ? 'Esse e-mail já tem uma conta. Entre com sua senha.'
            : params.has('auth_error')
              ? 'Não foi possível entrar com o Google. Tente novamente.'
              : '',
    );
    const [googleHelp, setGoogleHelp] = useState(false);

    async function submit(event: FormEvent) {
        event.preventDefault();
        setBusy(true);
        setError('');
        try {
            onLogin(
                mode === 'register'
                    ? await api.register(name, email, password)
                    : await api.login(email, password),
            );
        } catch (error) {
            setError((error as Error).message);
        } finally {
            setBusy(false);
        }
    }
    return (
        <main className="auth-layout">
            <section className="auth-story">
                <Logo />
                <div className="auth-copy">
                    <span className="eyebrow">
                        <span className="little-dot" /> Um novo jeito de conversar
                    </span>
                    <h1>
                        Seu próximo
                        <br />
                        mundo começa
                        <br />
                        com um <em>oi.</em>
                    </h1>
                    <p>
                        Um amigo feito do seu jeito.
                        <br />
                        Sete idiomas. Infinitos assuntos.
                    </p>
                </div>
                <div className="auth-illustration">
                    <Scene scene="park" />
                    <div className="auth-hello">
                        Hey! Ready for
                        <br />a little adventure? <span>✦</span>
                    </div>
                    <Avatar appearance={defaultCharacter.appearance} />
                </div>
                <div className="auth-footnote">
                    <ShieldCheck size={16} /> Amizades fictícias. Conversas de verdade.
                </div>
            </section>
            <section className="auth-form-area">
                <div className="auth-top-note">
                    Um espaço para ser você <span>✳</span>
                </div>
                <div className="auth-form-wrap">
                    <div className="round-illustration">
                        <MessageCircle size={29} />
                    </div>
                    <span className="eyebrow">BEM-VINDO AO MARAI</span>
                    <h2>
                        {mode === 'register'
                            ? 'Vamos abrir essa conversa?'
                            : 'Que bom ter você de volta.'}
                    </h2>
                    <p>
                        {mode === 'register'
                            ? 'Crie sua conta e encontre sua voz em outro idioma.'
                            : 'Seus amigos e suas histórias estão esperando.'}
                    </p>
                    <div className="auth-tabs" role="tablist" aria-label="Acesso">
                        <button
                            role="tab"
                            aria-selected={mode === 'register'}
                            className={mode === 'register' ? 'active' : ''}
                            onClick={() => {
                                setMode('register');
                                setError('');
                            }}
                        >
                            Criar conta
                        </button>
                        <button
                            role="tab"
                            aria-selected={mode === 'login'}
                            className={mode === 'login' ? 'active' : ''}
                            onClick={() => {
                                setMode('login');
                                setError('');
                            }}
                        >
                            Já tenho conta
                        </button>
                    </div>
                    <form onSubmit={submit}>
                        {mode === 'register' && (
                            <label>
                                Como podemos chamar você?
                                <input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Seu nome"
                                    autoComplete="given-name"
                                    maxLength={80}
                                    required
                                />
                            </label>
                        )}
                        <label>
                            E-mail
                            <input
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                type="email"
                                placeholder="voce@exemplo.com"
                                autoComplete="email"
                                required
                            />
                        </label>
                        <label>
                            Senha
                            <input
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                type="password"
                                placeholder="Pelo menos 10 caracteres"
                                minLength={10}
                                maxLength={128}
                                autoComplete={
                                    mode === 'register' ? 'new-password' : 'current-password'
                                }
                                required
                            />
                        </label>
                        {error && (
                            <p className="error" role="alert">
                                {error}
                            </p>
                        )}
                        <button className="button primary full" disabled={busy}>
                            {busy ? (
                                <LoaderCircle className="spin" size={19} />
                            ) : (
                                <>
                                    {mode === 'register'
                                        ? 'Começar minha história'
                                        : 'Entrar no Marai'}
                                    <ArrowRight size={19} />
                                </>
                            )}
                        </button>
                    </form>
                    <div className="divider">
                        <span>ou continue com</span>
                    </div>
                    <button
                        className="button google full"
                        onClick={() =>
                            config?.google_enabled
                                ? location.assign('/api/auth/google')
                                : setGoogleHelp(!googleHelp)
                        }
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                            <path
                                d="M22 12.3c0-.7 0-1.4-.2-2.1H12v4h5.6a4.9 4.9 0 0 1-2.1 3.2v2.7H19c2-1.9 3-4.5 3-7.8"
                                fill="#4285F4"
                            />
                            <path
                                d="M12 22c2.8 0 5.2-.9 7-2.5l-3.5-2.7c-1 .7-2.1 1-3.5 1-2.7 0-5-1.8-5.8-4.3H2.6v2.8A10 10 0 0 0 12 22"
                                fill="#34A853"
                            />
                            <path
                                d="M6.2 13.5a6 6 0 0 1 0-3.1V7.6H2.6a10 10 0 0 0 0 8.8z"
                                fill="#FBBC05"
                            />
                            <path
                                d="M12 6.2c1.5 0 2.9.5 4 1.5l3-3A10 10 0 0 0 2.6 7.6l3.6 2.8A6 6 0 0 1 12 6.2"
                                fill="#EA4335"
                            />
                        </svg>{' '}
                        Google{!config?.google_enabled && <small>Configurar</small>}
                    </button>
                    {googleHelp && (
                        <p className="info" role="status">
                            O acesso Google precisa ser habilitado pelo responsável pela instalação.
                            Por enquanto, crie sua conta com e-mail e senha.
                        </p>
                    )}
                    <div className="auth-benefits">
                        <span>
                            <Check size={14} /> Sem provas
                        </span>
                        <span>
                            <Check size={14} /> Sem julgamentos
                        </span>
                        <span>
                            <Check size={14} /> No seu ritmo
                        </span>
                    </div>
                </div>
                <div className="auth-bottom">
                    <Globe2 size={16} /> Um idioma conecta. Uma conversa aproxima.{' '}
                    <Headphones size={17} />
                </div>
            </section>
        </main>
    );
}

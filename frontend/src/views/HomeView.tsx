import {
    ArrowRight,
    ArrowUpRight,
    Clock3,
    Globe2,
    MessageCircle,
    Plus,
    Sparkles,
} from 'lucide-react';
import type { Character, Conversation, User } from '../models/types';
import { defaultCharacter, languages } from '../models/catalog';
import { Scene } from '../components/Scene';
import { Avatar } from '../components/Avatar';

export function HomeView({
    user,
    conversations,
    characters,
    onNew,
    onOpen,
}: {
    user: User;
    conversations: Conversation[];
    characters: Character[];
    onNew: (character?: Character) => void;
    onOpen: (id: string) => void;
}) {
    const latest = conversations[0];
    return (
        <main className="home-page">
            <header className="page-header">
                <div>
                    <span className="eyebrow">SEU CANTINHO NO MUNDO</span>
                    <h1>
                        Olá, {user.name.split(' ')[0]} <span className="greeting-star">✳</span>
                    </h1>
                    <p>Que tal uma boa conversa hoje?</p>
                </div>
                <div className="today-pill">
                    <span className="little-dot" /> No seu ritmo. Do seu jeito.
                </div>
            </header>
            <section className="home-hero">
                <div className="hero-copy">
                    <span className="pill">
                        <Sparkles size={14} /> MENOS PRESSÃO, MAIS CONEXÃO
                    </span>
                    <h2>
                        Todo assunto é<br />
                        um novo <em>começo.</em>
                    </h2>
                    <p>
                        Crie seu amigo, escolha um lugar especial
                        <br className="desktop-break" /> e deixe a conversa levar você mais longe.
                    </p>
                    <button className="button dark" onClick={() => onNew()}>
                        Criar meu amigo <ArrowRight size={18} />
                    </button>
                    <span className="hero-caption">Só precisa trazer a curiosidade.</span>
                </div>
                <div className="hero-world">
                    <Scene scene="park" />
                    <div className="hero-bubble">
                        So, what’s on
                        <br />
                        your mind today? <span>✦</span>
                    </div>
                    <Avatar appearance={defaultCharacter.appearance} />
                    <div className="world-label">
                        <span className="little-dot" /> Um mundo de possibilidades
                    </div>
                </div>
                <div className="hero-star">✳</div>
            </section>
            <div className="section-heading">
                <div>
                    <span className="eyebrow">CONEXÕES QUE CONTINUAM</span>
                    <h2>Suas conversas</h2>
                </div>
                <button className="text-button" onClick={() => onNew()}>
                    Nova conversa <Plus size={17} />
                </button>
            </div>
            {latest ? (
                <div className="conversation-cards">
                    {conversations.slice(0, 3).map((c) => (
                        <button
                            className="conversation-card"
                            key={c.id}
                            onClick={() => onOpen(c.id)}
                        >
                            <div className={`friend-portrait portrait-${c.scene}`}>
                                <Avatar appearance={c.snapshot.appearance} name={c.snapshot.name} />
                            </div>
                            <div>
                                <span className="mini-label">
                                    {languages.find((l) => l.value === c.language)?.label}{' '}
                                    <span>·</span> {c.level}
                                </span>
                                <h3>{c.snapshot.name}</h3>
                                <p>{c.title}</p>
                                <span className="card-time">
                                    <Clock3 size={12} />{' '}
                                    {new Date(c.updated_at).toLocaleDateString('pt-BR')}
                                </span>
                            </div>
                            <ArrowUpRight size={18} />
                        </button>
                    ))}
                </div>
            ) : (
                <div className="empty-conversations">
                    <div className="empty-icon">
                        <MessageCircle size={27} />
                    </div>
                    <div>
                        <h3>Uma boa história começa com um oi.</h3>
                        <p>
                            Sua primeira conversa vai aparecer aqui. Depois, é só voltar e
                            continuar.
                        </p>
                    </div>
                    <button className="button secondary" onClick={() => onNew()}>
                        Vamos conversar <ArrowRight size={17} />
                    </button>
                </div>
            )}
            {characters.length > 0 && (
                <>
                    <div className="section-heading">
                        <div>
                            <span className="eyebrow">DO SEU JEITO</span>
                            <h2>Seus amigos fictícios</h2>
                        </div>
                    </div>
                    <div className="friends-row">
                        {characters.map((c) => (
                            <button className="saved-friend" key={c.id} onClick={() => onNew(c)}>
                                <div className="friend-portrait">
                                    <Avatar appearance={c.appearance} name={c.name} />
                                </div>
                                <span>
                                    <strong>{c.name}</strong>
                                    <small>Editar ou começar outra conversa</small>
                                </span>
                                <ArrowRight size={17} />
                            </button>
                        ))}
                    </div>
                </>
            )}
            <section className="languages-section">
                <div>
                    <Globe2 size={19} />
                    <span>
                        Sete idiomas. <strong>Seu mundo, um pouco maior.</strong>
                    </span>
                </div>
                <div className="language-stamps">
                    {languages.map((l) => (
                        <span key={l.value} title={l.native}>
                            <b>{l.code}</b>
                            {l.label}
                        </span>
                    ))}
                </div>
            </section>
            <footer className="page-footer">
                <span>Feito para conversar, sem medo de errar.</span>
                <span>
                    marai <span className="green">✳</span>
                </span>
            </footer>
        </main>
    );
}

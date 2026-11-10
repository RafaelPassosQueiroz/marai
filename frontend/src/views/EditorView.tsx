import {
    ArrowLeft,
    ArrowRight,
    Check,
    CheckCheck,
    Dices,
    LoaderCircle,
    Save,
    Shuffle,
    Sparkles,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { Character } from '../models/types';
import { interests, languages, levels, scenes, traits } from '../models/catalog';
import { Avatar } from '../components/Avatar';
import { Scene } from '../components/Scene';
import { AppearanceEditor } from './AppearanceEditor';
import { useEditorViewModel } from '../viewmodels/useEditorViewModel';
import { characterText, professionSuggestions } from '../models/characterCopy';

export function EditorView({
    initial,
    onCreated,
    onSaved,
    onBack,
}: {
    initial: Character | null;
    onCreated: (id: string) => Promise<void>;
    onSaved: () => Promise<void>;
    onBack: () => void;
}) {
    const vm = useEditorViewModel(initial, onCreated, onSaved);
    const { character: c, step, busy } = vm;
    const t = (text: string) => characterText(vm.language, text);
    const panel = useRef<HTMLElement>(null);
    useEffect(() => {
        panel.current?.focus({ preventScroll: true });
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: 0, left: 0, behavior: reduced ? 'auto' : 'smooth' });
    }, [step]);
    const a = c.appearance;
    return (
        <main
            className={`editor-page ${step === 1 ? 'customizing-avatar' : ''}`}
            data-appearance-category={step === 1 ? vm.category : undefined}
        >
            <header className="editor-heading">
                <button className="text-button" onClick={onBack} disabled={busy}>
                    <ArrowLeft size={17} /> Voltar ao início
                </button>
                <span className="eyebrow">UM AMIGO, INFINITAS POSSIBILIDADES</span>
            </header>
            <div className="editor-title">
                <h1>
                    {initial
                        ? 'Um novo capítulo, o mesmo amigo.'
                        : 'Dê vida à sua próxima conversa.'}
                </h1>
                <p>Um pouco de imaginação. Um amigo do seu jeito.</p>
            </div>
            <nav className="steps" aria-label="Etapas de criação">
                {['Conversação', 'Aparência', 'Personalidade e identidade'].map((label, index) => (
                    <button
                        key={label}
                        className={step === index ? 'current' : step > index ? 'complete' : ''}
                        onClick={() => vm.setStep(index)}
                        disabled={busy}
                        aria-current={step === index ? 'step' : undefined}
                    >
                        <span>{step > index ? <Check size={15} /> : `0${index + 1}`}</span>
                        {label}
                    </button>
                ))}
            </nav>
            <div className="editor-layout">
                <section
                    className={`character-preview preview-step-${step}`}
                    aria-label="Prévia do personagem"
                >
                    {step === 0 ? (
                        <Scene scene={vm.scene} />
                    ) : (
                        <>
                            <div className="preview-orbit orbit-one" />
                            <div className="preview-orbit orbit-two" />
                            <span className="preview-spark spark-one">✳</span>
                            <span className="preview-spark spark-two">✦</span>
                        </>
                    )}
                    <div className="fictional-badge" lang={vm.language}>
                        <span className="little-dot" /> {t('Personagem fictício')}
                    </div>
                    <Avatar appearance={a} name={`Prévia de ${c.name || 'seu amigo'}`} />
                    <div className="preview-name" lang={vm.language}>
                        <h2>{c.name || t('Seu próximo amigo')}</h2>
                        <span>
                            {step === 0
                                ? `${languages.find((l) => l.value === vm.language)?.label} · ${vm.level}`
                                : c.persona.profession || t('Uma amizade começa aqui')}
                        </span>
                    </div>
                    {step > 0 && (
                        <button
                            className="shuffle-button"
                            aria-label="Variar aparência"
                            onClick={vm.randomAppearance}
                            disabled={busy}
                        >
                            <Shuffle size={17} /> Variar aparência
                        </button>
                    )}
                </section>
                <section
                    className="editor-panel"
                    ref={panel}
                    tabIndex={-1}
                    lang={step === 0 ? 'pt-BR' : vm.language}
                    aria-label="Configurações da etapa atual"
                >
                    {step === 1 && (
                        <AppearanceEditor
                            character={c}
                            language={vm.language}
                            category={vm.category}
                            onCategoryChange={vm.setCategory}
                            onAppearanceChange={vm.appearance}
                            onCharacterChange={vm.setCharacter}
                            busy={busy}
                        />
                    )}
                    {step === 2 && (
                        <>
                            <div className="panel-heading">
                                <div>
                                    <span className="eyebrow" lang="pt-BR">
                                        03 / PERSONALIDADE
                                    </span>
                                    <h2>{t('Mais que um rostinho.')}</h2>
                                </div>
                                <button
                                    className="button surprise"
                                    lang="pt-BR"
                                    disabled={busy}
                                    onClick={vm.surprise}
                                >
                                    {busy ? (
                                        <LoaderCircle className="spin" size={16} />
                                    ) : (
                                        <Dices size={17} />
                                    )}{' '}
                                    Surpreenda-me
                                </button>
                            </div>
                            <p className="optional-note">
                                {t(
                                    'Tudo aqui é opcional. Pode deixar em branco e seguir em frente.',
                                )}
                            </p>
                            <fieldset className="option-group">
                                <legend>
                                    {t('Como é o jeito dele?')}{' '}
                                    <span>{c.persona.traits.length}/3</span>
                                </legend>
                                <div className="chips">
                                    {traits.map((trait) => (
                                        <button
                                            key={trait}
                                            aria-pressed={c.persona.traits.includes(trait)}
                                            className={`chip ${c.persona.traits.includes(trait) ? 'selected' : ''}`}
                                            disabled={
                                                !c.persona.traits.includes(trait) &&
                                                c.persona.traits.length >= 3
                                            }
                                            onClick={() => vm.toggle('traits', trait)}
                                        >
                                            {t(trait)}
                                            {c.persona.traits.includes(trait) && (
                                                <Check size={12} />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </fieldset>
                            <datalist id="character-professions">
                                {professionSuggestions[vm.language].map((value) => (
                                    <option key={value} value={value} />
                                ))}
                            </datalist>
                            <div className="field-pair">
                                <label>
                                    {t('Profissão fictícia')}
                                    <input
                                        value={c.persona.profession}
                                        onChange={(e) => vm.persona('profession', e.target.value)}
                                        placeholder={t('Ex.: fotógrafo')}
                                        list="character-professions"
                                        maxLength={80}
                                    />
                                </label>
                                <label>
                                    {t('Idade fictícia')}
                                    <input
                                        type="number"
                                        min={13}
                                        max={120}
                                        value={c.persona.age ?? ''}
                                        onChange={(e) =>
                                            vm.persona(
                                                'age',
                                                e.target.value ? Number(e.target.value) : null,
                                            )
                                        }
                                        placeholder={t('Ex.: 25')}
                                    />
                                </label>
                            </div>
                            <label>
                                {t('De onde ele vem?')}
                                <input
                                    value={c.persona.origin}
                                    onChange={(e) => vm.persona('origin', e.target.value)}
                                    placeholder={t('Ex.: Manchester, Inglaterra')}
                                    maxLength={100}
                                />
                            </label>
                            <fieldset className="option-group">
                                <legend>{t('O que desperta a curiosidade dele?')}</legend>
                                <div className="chips">
                                    {interests.map((interest) => (
                                        <button
                                            key={interest}
                                            aria-pressed={c.persona.interests.includes(interest)}
                                            className={`chip ${c.persona.interests.includes(interest) ? 'selected' : ''}`}
                                            onClick={() => vm.toggle('interests', interest)}
                                        >
                                            {t(interest)}
                                        </button>
                                    ))}
                                </div>
                            </fieldset>
                            <fieldset className="option-group">
                                <legend>{t('Estilo de conversa')}</legend>
                                <div className="style-options">
                                    {(
                                        [
                                            ['talkative', 'Falante', 'Adora contar histórias'],
                                            [
                                                'balanced',
                                                'Equilibrado',
                                                'Comenta, escuta e pergunta',
                                            ],
                                            ['listener', 'Bom ouvinte', 'Mais espaço para você'],
                                        ] as const
                                    ).map(([value, label, detail]) => (
                                        <button
                                            key={value}
                                            aria-pressed={c.persona.style === value}
                                            className={`style-option ${c.persona.style === value ? 'selected' : ''}`}
                                            onClick={() => vm.persona('style', value)}
                                        >
                                            <strong>{t(label)}</strong>
                                            <small>{t(detail)}</small>
                                        </button>
                                    ))}
                                </div>
                            </fieldset>
                            <label>
                                {t('Uma pequena história de vida')}{' '}
                                <span className="label-optional">{t('opcional')}</span>
                                <textarea
                                    value={c.persona.biography}
                                    onChange={(e) => vm.persona('biography', e.target.value)}
                                    maxLength={1500}
                                    rows={3}
                                    placeholder={t(
                                        'Gostos, histórias e pequenos detalhes que tornam seu amigo único.',
                                    )}
                                />
                                <small>
                                    {t('Você pode escrever a história de vida em qualquer idioma.')}
                                </small>
                            </label>
                            {Object.keys(c.persona.preferences).length > 0 && (
                                <div className="persona-preferences">
                                    <strong>{t('Pequenos detalhes da identidade fictícia')}</strong>
                                    {Object.entries(c.persona.preferences).map(([key, value]) => (
                                        <p key={key}>
                                            <b>{key}:</b> {value}
                                        </p>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                    {step === 0 && (
                        <>
                            <div className="panel-heading">
                                <div>
                                    <span className="eyebrow">01 / CONVERSAÇÃO</span>
                                    <h2>Onde a conversa começa.</h2>
                                </div>
                                <Sparkles size={26} className="green" />
                            </div>
                            <fieldset className="option-group">
                                <legend>Em qual idioma vamos conversar?</legend>
                                <div className="language-picker">
                                    {languages.map((lang) => (
                                        <button
                                            key={lang.value}
                                            className={`language-option ${vm.language === lang.value ? 'selected' : ''}`}
                                            aria-pressed={vm.language === lang.value}
                                            onClick={() => vm.setLanguage(lang.value)}
                                        >
                                            <b>{lang.code}</b>
                                            <span>{lang.label}</span>
                                            {vm.language === lang.value && <Check size={14} />}
                                        </button>
                                    ))}
                                </div>
                            </fieldset>
                            <label>
                                Seu momento nesse idioma
                                <select
                                    value={vm.level}
                                    onChange={(e) => vm.setLevel(e.target.value as typeof vm.level)}
                                >
                                    {levels.map((level) => (
                                        <option key={level.value} value={level.value}>
                                            {level.value} — {level.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <fieldset className="option-group">
                                <legend>Escolha um lugar para se encontrar</legend>
                                <div className="scene-picker">
                                    {scenes.map((scene) => (
                                        <button
                                            key={scene.value}
                                            className={`scene-option ${vm.scene === scene.value ? 'selected' : ''}`}
                                            aria-pressed={vm.scene === scene.value}
                                            onClick={() => vm.setScene(scene.value)}
                                        >
                                            <div>
                                                <Scene scene={scene.value} />
                                                {vm.scene === scene.value && (
                                                    <span>
                                                        <Check size={14} />
                                                    </span>
                                                )}
                                            </div>
                                            <strong>{scene.label}</strong>
                                            <small>{scene.description}</small>
                                        </button>
                                    ))}
                                </div>
                            </fieldset>
                        </>
                    )}
                    {vm.error && (
                        <p className="error" role="alert">
                            {vm.error}
                        </p>
                    )}
                    {vm.saved && (
                        <p className="success" role="status">
                            <CheckCheck size={16} /> Personagem salvo. Conversas anteriores mantêm
                            sua configuração original.
                        </p>
                    )}
                    <div className="editor-actions" lang="pt-BR">
                        {step > 0 ? (
                            <button
                                className="text-button"
                                disabled={busy}
                                onClick={() => vm.setStep(step - 1)}
                            >
                                <ArrowLeft size={17} /> Anterior
                            </button>
                        ) : (
                            <span>Feito para ser único.</span>
                        )}
                        <div>
                            {initial && (
                                <button
                                    className="button secondary"
                                    onClick={() => vm.save(false)}
                                    disabled={busy}
                                >
                                    <Save size={16} /> Salvar
                                </button>
                            )}
                            {step < 2 ? (
                                <button
                                    className="button primary"
                                    disabled={busy}
                                    onClick={() => vm.setStep(step + 1)}
                                >
                                    Continuar <ArrowRight size={17} />
                                </button>
                            ) : (
                                <button
                                    className="button primary"
                                    disabled={busy}
                                    onClick={() => vm.save(true)}
                                >
                                    {busy ? (
                                        <LoaderCircle className="spin" size={18} />
                                    ) : (
                                        <>
                                            Tudo pronto, vamos lá <ArrowRight size={17} />
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </section>
            </div>
        </main>
    );
}

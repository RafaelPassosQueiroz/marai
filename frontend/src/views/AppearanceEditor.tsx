import { useEffect, useRef, useState } from 'react';
import { Check, Glasses, Scissors, Shirt, Smile, Volume2 } from 'lucide-react';
import type { Appearance, Character, Language } from '../models/types';
import { hairstyles, withVoicePresentation } from '../models/avatarOptions';
import type { AppearanceCategory, HairLength } from '../models/avatarOptions';
import { characterText } from '../models/characterCopy';
import { Avatar } from '../components/Avatar';

const categories = [
    { value: 'voice', label: 'Gênero e voz', icon: Volume2 },
    { value: 'face', label: 'Rosto', icon: Smile },
    { value: 'hair', label: 'Cabelo', icon: Scissors },
    { value: 'clothes', label: 'Roupas', icon: Shirt },
    { value: 'accessories', label: 'Acessórios', icon: Glasses },
] as const;
const crops = {
    head: '74 12 280 398',
    face: '108 85 210 233',
    eyes: '140 157 147 70',
    brows: '142 148 142 50',
    nose: '187 193 52 55',
    mouth: '178 241 77 47',
    body: '56 310 308 255',
};

export function AppearanceEditor({
    character,
    language,
    category,
    onCategoryChange,
    onAppearanceChange,
    onCharacterChange,
    busy,
}: {
    character: Character;
    language: Language;
    category: AppearanceCategory;
    onCategoryChange: (category: AppearanceCategory) => void;
    onAppearanceChange: <K extends keyof Appearance>(key: K, value: Appearance[K]) => void;
    onCharacterChange: (character: Character) => void;
    busy: boolean;
}) {
    const a = character.appearance;
    const t = (text: string) => characterText(language, text);
    const [hairFilter, setHairFilter] = useState<HairLength | 'all'>('all');
    const previousHair = useRef(a.hair);
    useEffect(() => {
        if (previousHair.current === a.hair) return;
        previousHair.current = a.hair;
        if (
            hairFilter !== 'all' &&
            hairstyles.find((style) => style.value === a.hair)?.length !== hairFilter
        ) {
            setHairFilter('all');
        }
    }, [a.hair, hairFilter]);
    const tabs = useRef<HTMLDivElement>(null);
    const choices = <K extends keyof Appearance>(
        key: K,
        label: string,
        values: readonly (readonly [Appearance[K], string])[],
        crop = crops.face,
    ) => (
        <fieldset className={`appearance-field options-${key}`}>
            <legend>{t(label)}</legend>
            <div className="visual-choice-grid">
                {values.map(([value, name]) => (
                    <button
                        key={String(value)}
                        type="button"
                        disabled={busy}
                        className={`visual-option ${a[key] === value ? 'is-selected' : ''}`}
                        aria-pressed={a[key] === value}
                        aria-label={t(name)}
                        onClick={() => onAppearanceChange(key, value)}
                    >
                        <span className="option-miniature" aria-hidden="true">
                            <Avatar
                                appearance={{
                                    ...a,
                                    ...(key === 'hair'
                                        ? { hat: 'none' as const, glasses: 'none' as const }
                                        : {}),
                                    [key]: value,
                                }}
                                viewBox={crop}
                            />
                        </span>
                        <span className="option-label">{t(name)}</span>
                        {a[key] === value && (
                            <span className="option-check">
                                <Check size={12} />
                            </span>
                        )}
                    </button>
                ))}
            </div>
        </fieldset>
    );
    const colors = (
        key: 'skin' | 'eye_color' | 'hair_color' | 'clothing_color',
        label: string,
        palette: string[],
    ) => (
        <fieldset className="appearance-field color-field">
            <legend>
                {t(label)} <code>{a[key].toUpperCase()}</code>
            </legend>
            <div className="swatches">
                {palette.map((color, index) => (
                    <button
                        type="button"
                        key={color}
                        disabled={busy}
                        className={`swatch ${a[key].toLowerCase() === color ? 'selected' : ''}`}
                        style={{ background: color }}
                        aria-label={`${t(label)}, ${t('opção')} ${index + 1}`}
                        aria-pressed={a[key].toLowerCase() === color}
                        onClick={() => onAppearanceChange(key, color)}
                    >
                        {a[key].toLowerCase() === color && <Check size={16} />}
                    </button>
                ))}
                <label className="custom-color" title={t('Escolher outra cor')}>
                    <span>+</span>
                    <input
                        type="color"
                        disabled={busy}
                        value={a[key]}
                        aria-label={`${t(label)}, ${t('Escolher outra cor')}`}
                        onChange={(event) => onAppearanceChange(key, event.target.value)}
                    />
                </label>
            </div>
        </fieldset>
    );
    const toggles = (
        values: readonly (readonly ['beard' | 'freckles' | 'earrings' | 'necklace', string])[],
    ) => (
        <div className="appearance-toggle-grid">
            {values.map(([key, name]) => (
                <button
                    type="button"
                    key={key}
                    role="switch"
                    aria-checked={a[key]}
                    disabled={busy}
                    className={`appearance-toggle ${a[key] ? 'is-selected' : ''}`}
                    onClick={() => onAppearanceChange(key, !a[key])}
                >
                    <span className="toggle-miniature" aria-hidden="true">
                        <Avatar
                            appearance={{ ...a, [key]: true }}
                            viewBox={key === 'necklace' ? '145 310 130 115' : crops.face}
                        />
                    </span>
                    <span>{t(name)}</span>
                    <span className="appearance-switch" aria-hidden="true">
                        <i />
                    </span>
                </button>
            ))}
        </div>
    );
    return (
        <div className="appearance-editor">
            <div className="panel-heading">
                <div>
                    <span className="eyebrow" lang="pt-BR">
                        02 / APARÊNCIA
                    </span>
                    <h2>{t('Olá, quem vem aí?')}</h2>
                </div>
                <span className="small-decoration">✳</span>
            </div>
            <label className="appearance-name">
                {t('Nome do seu amigo')}
                <input
                    value={character.name}
                    maxLength={60}
                    disabled={busy}
                    placeholder={t('Como ele vai se chamar?')}
                    onChange={(event) =>
                        onCharacterChange({ ...character, name: event.target.value })
                    }
                />
            </label>
            <div
                className="appearance-tabs"
                role="tablist"
                aria-label="Categorias de aparência"
                lang="pt-BR"
                ref={tabs}
                onKeyDown={(event) => {
                    const index = categories.findIndex((item) => item.value === category);
                    const next =
                        event.key === 'ArrowRight'
                            ? (index + 1) % categories.length
                            : event.key === 'ArrowLeft'
                              ? (index + categories.length - 1) % categories.length
                              : event.key === 'Home'
                                ? 0
                                : event.key === 'End'
                                  ? categories.length - 1
                                  : -1;
                    if (next < 0 || busy) return;
                    event.preventDefault();
                    onCategoryChange(categories[next].value);
                    tabs.current?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
                }}
            >
                {categories.map(({ value, label, icon: Icon }) => (
                    <button
                        type="button"
                        key={value}
                        role="tab"
                        disabled={busy}
                        id={`appearance-tab-${value}`}
                        aria-controls="appearance-tab-panel"
                        aria-selected={category === value}
                        tabIndex={category === value ? 0 : -1}
                        className={category === value ? 'active' : ''}
                        onClick={() => onCategoryChange(value)}
                    >
                        <Icon size={19} />
                        <span>{label}</span>
                    </button>
                ))}
            </div>
            <div
                className="appearance-tab-panel"
                id="appearance-tab-panel"
                role="tabpanel"
                aria-labelledby={`appearance-tab-${category}`}
            >
                {category === 'voice' && (
                    <fieldset className="appearance-field">
                        <legend>{t('Gênero do personagem')}</legend>
                        <div className="appearance-voice-grid">
                            {(['male', 'female'] as const).map((voice) => (
                                <button
                                    key={voice}
                                    type="button"
                                    disabled={busy}
                                    aria-pressed={character.voice === voice}
                                    className={`voice-choice ${character.voice === voice ? 'is-selected' : ''}`}
                                    onClick={() =>
                                        onCharacterChange(
                                            withVoicePresentation({ ...character, voice }),
                                        )
                                    }
                                >
                                    <span className="gender-miniature" aria-hidden="true">
                                        <Avatar
                                            appearance={
                                                withVoicePresentation({ ...character, voice })
                                                    .appearance
                                            }
                                            viewBox={crops.face}
                                        />
                                    </span>
                                    <strong>
                                        {t(voice === 'female' ? 'Feminino' : 'Masculino')}
                                    </strong>
                                    {character.voice === voice && <Check size={15} />}
                                </button>
                            ))}
                        </div>
                        <p className="appearance-help">
                            {t(
                                'O gênero define automaticamente a voz e a aparência do personagem.',
                            )}
                        </p>
                    </fieldset>
                )}
                {category === 'face' && (
                    <>
                        {colors('skin', 'Tom de pele', [
                            '#f7d7bc',
                            '#f1c8a6',
                            '#e8ad7b',
                            '#cd966c',
                            '#bb815d',
                            '#8f5f48',
                            '#67483b',
                            '#49352e',
                        ])}
                        {choices('face', 'Formato do rosto', [
                            ['oval', 'Oval'],
                            ['round', 'Arredondado'],
                            ['angular', 'Marcado'],
                        ])}
                        <div className="appearance-feature-grid">
                            {choices(
                                'eyes',
                                'Olhos',
                                [
                                    ['almond', 'Amendoados'],
                                    ['round', 'Arredondados'],
                                    ['relaxed', 'Tranquilos'],
                                ],
                                crops.eyes,
                            )}
                            {choices(
                                'brows',
                                'Sobrancelhas',
                                [
                                    ['soft', 'Suaves'],
                                    ['bold', 'Marcantes'],
                                    ['arched', 'Arqueadas'],
                                ],
                                crops.brows,
                            )}
                            {choices(
                                'nose',
                                'Nariz',
                                [
                                    ['soft', 'Suave'],
                                    ['straight', 'Reto'],
                                    ['round', 'Arredondado'],
                                ],
                                crops.nose,
                            )}
                            {choices(
                                'mouth',
                                'Sorriso',
                                [
                                    ['smile', 'Animado'],
                                    ['gentle', 'Discreto'],
                                    ['wide', 'Aberto'],
                                ],
                                crops.mouth,
                            )}
                        </div>
                        {colors('eye_color', 'Cor dos olhos', [
                            '#604630',
                            '#315966',
                            '#60845b',
                            '#352b2b',
                            '#987740',
                            '#789caa',
                        ])}
                        {toggles([
                            ['freckles', 'Sardas'],
                            ['beard', 'Barba'],
                        ])}
                    </>
                )}
                {category === 'hair' && (
                    <>
                        <div
                            className="hair-filter"
                            role="group"
                            aria-label="Filtrar cabelos por comprimento"
                            lang="pt-BR"
                        >
                            {(
                                [
                                    ['all', 'Todos'],
                                    ['short', 'Curtos'],
                                    ['medium', 'Médios'],
                                    ['long', 'Longos'],
                                    ['tied', 'Presos'],
                                ] as const
                            ).map(([value, label]) => (
                                <button
                                    key={value}
                                    type="button"
                                    disabled={busy}
                                    aria-pressed={hairFilter === value}
                                    className={hairFilter === value ? 'active' : ''}
                                    onClick={() => setHairFilter(value)}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        {choices(
                            'hair',
                            'Um estilo que combina',
                            hairstyles
                                .filter(
                                    (style) => hairFilter === 'all' || style.length === hairFilter,
                                )
                                .map((style) => [style.value, style.label] as const),
                            crops.head,
                        )}
                        {colors('hair_color', 'Cor do cabelo', [
                            '#282831',
                            '#54382c',
                            '#784d36',
                            '#a2673a',
                            '#cba86a',
                            '#e3d5b8',
                            '#b8bab8',
                            '#7a526e',
                            '#577a8d',
                        ])}
                    </>
                )}
                {category === 'clothes' && (
                    <>
                        {choices(
                            'outfit',
                            'O que vamos vestir?',
                            [
                                ['jacket', 'Jaqueta'],
                                ['hoodie', 'Moletom'],
                                ['shirt', 'Camiseta'],
                                ['sweater', 'Suéter'],
                            ],
                            crops.body,
                        )}
                        {colors('clothing_color', 'Cor da roupa', [
                            '#31556d',
                            '#578e7a',
                            '#b16f79',
                            '#aa9059',
                            '#82769f',
                            '#dad0b6',
                            '#394856',
                            '#b9d5de',
                        ])}
                    </>
                )}
                {category === 'accessories' && (
                    <>
                        {choices('glasses', 'Óculos', [
                            ['none', 'Sem óculos'],
                            ['round', 'Redondos'],
                            ['square', 'Retangulares'],
                        ])}
                        {choices(
                            'hat',
                            'Na cabeça',
                            [
                                ['none', 'Sem adereço'],
                                ['cap', 'Boné'],
                                ['beanie', 'Gorro'],
                            ],
                            crops.head,
                        )}
                        {toggles([
                            ['earrings', 'Brincos'],
                            ['necklace', 'Colar'],
                        ])}
                    </>
                )}
            </div>
        </div>
    );
}

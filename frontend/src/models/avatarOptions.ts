import type { Appearance, Character } from './types';

export type AppearanceCategory = 'voice' | 'face' | 'hair' | 'clothes' | 'accessories';

export function withVoicePresentation(character: Character): Character {
    return {
        ...character,
        appearance: {
            ...character.appearance,
            presentation: character.voice === 'female' ? 'feminine' : 'masculine',
        },
    };
}

export type HairLength = 'short' | 'medium' | 'long' | 'tied';
export const hairstyles: { value: Appearance['hair']; label: string; length: HairLength }[] = [
    { value: 'swept', label: 'De lado', length: 'short' },
    { value: 'short', label: 'Curto', length: 'short' },
    { value: 'fade', label: 'Degradê', length: 'short' },
    { value: 'buzz', label: 'Raspado', length: 'short' },
    { value: 'pixie', label: 'Pixie', length: 'short' },
    { value: 'coils', label: 'Crespo curto', length: 'short' },
    { value: 'curly', label: 'Cacheado', length: 'medium' },
    { value: 'afro', label: 'Afro', length: 'medium' },
    { value: 'bob', label: 'Chanel', length: 'medium' },
    { value: 'long', label: 'Longo', length: 'long' },
    { value: 'waves', label: 'Ondas longas', length: 'long' },
    { value: 'locs', label: 'Locs', length: 'long' },
    { value: 'braids', label: 'Tranças', length: 'tied' },
    { value: 'ponytail', label: 'Rabo de cavalo', length: 'tied' },
    { value: 'bun', label: 'Coque alto', length: 'tied' },
    { value: 'bald', label: 'Sem cabelo', length: 'short' },
];

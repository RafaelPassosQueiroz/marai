import type { Language } from './types';

export const translationLanguages = [
    { value: 'pt-BR', label: 'Português (Brasil)' },
    { value: 'en', label: 'Inglês' },
    { value: 'es', label: 'Espanhol' },
    { value: 'fr', label: 'Francês' },
    { value: 'de', label: 'Alemão' },
    { value: 'it', label: 'Italiano' },
    { value: 'ja', label: 'Japonês' },
    { value: 'ko', label: 'Coreano' },
    { value: 'zh-CN', label: 'Chinês (simplificado)' },
    { value: 'ar', label: 'Árabe' },
    { value: 'ru', label: 'Russo' },
    { value: 'nl', label: 'Holandês' },
    { value: 'pl', label: 'Polonês' },
    { value: 'tr', label: 'Turco' },
    { value: 'hi', label: 'Hindi' },
    { value: 'sv', label: 'Sueco' },
] as const;

export type TranslationLanguage = (typeof translationLanguages)[number]['value'];
export interface TranslationResult {
    translated_text: string;
    source: TranslationLanguage;
    target: TranslationLanguage;
    provider: 'MyMemory';
}
export const translationTarget = (language: Language): TranslationLanguage =>
    language === 'pt' ? 'pt-BR' : language;
export const translationBytes = (text: string) => new TextEncoder().encode(text).length;

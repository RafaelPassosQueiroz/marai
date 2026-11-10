import { useState } from 'react';
import type { Appearance, Character, Language, Level, Persona, Scene } from '../models/types';
import { defaultCharacter } from '../models/catalog';
import { hairstyles, withVoicePresentation } from '../models/avatarOptions';
import type { AppearanceCategory } from '../models/avatarOptions';
import { api } from '../services/api';

export function useEditorViewModel(
    initial: Character | null,
    onCreated: (id: string) => Promise<void>,
    onSaved: () => Promise<void>,
) {
    const [character, setCharacter] = useState<Character>(() =>
        withVoicePresentation(structuredClone(initial ?? defaultCharacter)),
    );
    const [step, setStep] = useState(0);
    const [category, setCategory] = useState<AppearanceCategory>('voice');
    const [language, setLanguage] = useState<Language>(
        initial?.persona.description_language ?? 'en',
    );
    const [level, setLevel] = useState<Level>('B1');
    const [scene, setScene] = useState<Scene>('park');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);

    function appearance<K extends keyof Appearance>(key: K, value: Appearance[K]) {
        setSaved(false);
        setCharacter((c) =>
            withVoicePresentation({ ...c, appearance: { ...c.appearance, [key]: value } }),
        );
    }
    function persona<K extends keyof Persona>(key: K, value: Persona[K]) {
        setSaved(false);
        setCharacter((c) => ({ ...c, persona: { ...c.persona, [key]: value } }));
    }
    function toggle(key: 'traits' | 'interests', value: string) {
        const selected = character.persona[key];
        if (selected.includes(value))
            persona(
                key,
                selected.filter((i) => i !== value),
            );
        else if (key !== 'traits' || selected.length < 3) persona(key, [...selected, value]);
    }
    function randomAppearance() {
        const pick = <T>(list: T[]): T => list[Math.floor(Math.random() * list.length)];
        setSaved(false);
        setCharacter((c) => ({
            ...c,
            appearance: {
                ...c.appearance,
                skin: pick(['#f1c8a6', '#e8ad7b', '#bb815d', '#8f5f48', '#67483b']),
                hair: pick(hairstyles.map((style) => style.value)),
                hair_color: pick(['#54382c', '#282831', '#a2673a', '#cba86a', '#7a526e']),
                outfit: pick(['jacket', 'hoodie', 'shirt', 'sweater']),
                clothing_color: pick(['#31556d', '#578e7a', '#b16f79', '#aa9059', '#82769f']),
            },
        }));
    }
    async function surprise() {
        setBusy(true);
        setError('');
        try {
            const generated = await api.surprise(language);
            setCharacter((c) => ({ ...c, ...generated }));
            randomAppearance();
        } catch (error) {
            setError((error as Error).message);
        } finally {
            setBusy(false);
        }
    }
    async function save(start = false) {
        if (!character.name.trim()) {
            setError('Dê um nome ao seu amigo.');
            setStep(1);
            return;
        }
        setBusy(true);
        setError('');
        try {
            const result = await api.saveCharacter({
                ...character,
                persona: { ...character.persona, description_language: language },
            });
            setCharacter(result);
            setSaved(true);
            await onSaved();
            if (start) {
                const conversation = await api.createConversation(
                    result.id!,
                    language,
                    level,
                    scene,
                );
                await onCreated(conversation.id);
            }
        } catch (error) {
            setError((error as Error).message);
        } finally {
            setBusy(false);
        }
    }

    return {
        character,
        setCharacter: (value: Character) => {
            setSaved(false);
            setCharacter(withVoicePresentation(value));
        },
        step,
        setStep,
        category,
        setCategory,
        language,
        setLanguage,
        level,
        setLevel,
        scene,
        setScene,
        busy,
        error,
        saved,
        appearance,
        persona,
        toggle,
        randomAppearance,
        surprise,
        save,
    };
}

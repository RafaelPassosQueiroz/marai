// @vitest-environment happy-dom
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { AppearanceEditor } from './AppearanceEditor';
import { defaultCharacter } from '../models/catalog';
import type { AppearanceCategory } from '../models/avatarOptions';
import type { Character } from '../models/types';

it('uses visual options and keeps hair, colors, clothes, accessories and voice in the same character', async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const element = document.createElement('div');
    const root = createRoot(element);
    let current: Character;
    let randomize: () => void;
    function Harness() {
        const [value, setValue] = useState(structuredClone(defaultCharacter));
        const [category, setCategory] = useState<AppearanceCategory>('voice');
        current = value;
        randomize = () =>
            setValue((old) => ({ ...old, appearance: { ...old.appearance, hair: 'afro' } }));
        return (
            <AppearanceEditor
                character={value}
                language="fr"
                category={category}
                busy={false}
                onCategoryChange={setCategory}
                onCharacterChange={setValue}
                onAppearanceChange={(key, selected) =>
                    setValue((old) => ({
                        ...old,
                        appearance: { ...old.appearance, [key]: selected },
                    }))
                }
            />
        );
    }
    const button = (label: string) =>
        [...element.querySelectorAll<HTMLButtonElement>('button')].find(
            (b) => b.textContent?.trim() === label || b.getAttribute('aria-label') === label,
        )!;
    const click = async (label: string) => {
        expect(button(label)).toBeTruthy();
        await act(async () => {
            button(label).click();
        });
    };
    try {
        await act(async () => {
            root.render(<Harness />);
        });
        expect([...element.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent)).toEqual(
            ['Gênero e voz', 'Rosto', 'Cabelo', 'Roupas', 'Acessórios'],
        );
        expect(element.querySelectorAll('.voice-choice')).toHaveLength(2);
        expect(element.textContent).not.toContain('Neutre');
        await click('Féminin');
        expect(current!.voice).toBe('female');
        expect(current!.appearance.presentation).toBe('feminine');
        await click('Rosto');
        expect(element.querySelector('.options-presentation')).toBeNull();
        await click('Cabelo');
        expect(element.querySelectorAll('.options-hair .visual-option')).toHaveLength(16);
        const ids = [...element.querySelectorAll('clipPath')].map((path) => path.id);
        expect(new Set(ids).size).toBe(ids.length);
        await click('Chignon haut');
        expect(current!.appearance.hair).toBe('bun');
        await act(async () => {
            element.querySelector<HTMLButtonElement>('.swatch')!.click();
        });
        expect(current!.appearance.hair_color).toBe('#282831');
        await click('Presos');
        expect(element.querySelectorAll('.options-hair .visual-option')).toHaveLength(3);
        await act(async () => {
            randomize();
        });
        expect(element.querySelectorAll('.options-hair .visual-option')).toHaveLength(16);
        await click('Chignon haut');
        await click('Roupas');
        await click('Sweat à capuche');
        expect(current!.appearance.outfit).toBe('hoodie');
        await click('Acessórios');
        await click('Ronds');
        await click('Bonnet');
        await act(async () => {
            element.querySelector<HTMLButtonElement>('[role="switch"]')!.click();
        });
        expect(current!.appearance.glasses).toBe('round');
        expect(current!.appearance.hat).toBe('beanie');
        expect(current!.appearance.earrings).toBe(true);
        await click('Gênero e voz');
        await click('Masculin');
        expect(current!.voice).toBe('male');
        expect(current!.appearance.presentation).toBe('masculine');
        expect(current!.appearance.hair).toBe('bun');
        expect(current!.appearance.hair_color).toBe('#282831');
        expect(current!.appearance.hat).toBe('beanie');
        expect(current!.appearance.earrings).toBe(true);
    } finally {
        await act(async () => root.unmount());
    }
});

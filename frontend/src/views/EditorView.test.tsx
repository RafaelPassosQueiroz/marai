// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { EditorView } from './EditorView';
import { defaultCharacter } from '../models/catalog';
import { api } from '../services/api';

vi.mock('../services/api', () => ({
    api: { saveCharacter: vi.fn(), surprise: vi.fn(), createConversation: vi.fn() },
}));

it('configures language first, localizes descriptions, scrolls between steps and preserves the biography', async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const container = document.createElement('div');
    const root = createRoot(container);
    const character = structuredClone(defaultCharacter);
    character.id = 'existing-character';
    character.persona.biography = '日本の海の近くで育ちました。';
    vi.mocked(api.saveCharacter).mockImplementation(async (value) => value);
    const button = (text: string) =>
        [...container.querySelectorAll<HTMLButtonElement>('button')].find(
            (b) => b.textContent?.trim() === text,
        )!;
    const click = async (element: HTMLButtonElement) => {
        expect(element).toBeTruthy();
        await act(async () => {
            element.click();
        });
    };
    try {
        await act(async () => {
            root.render(
                <EditorView
                    initial={character}
                    onCreated={async () => {}}
                    onSaved={async () => {}}
                    onBack={() => {}}
                />,
            );
        });
        expect(
            [...container.querySelectorAll('.steps button')].map((b) => b.textContent?.trim()),
        ).toEqual(['01Conversação', '02Aparência', '03Personalidade e identidade']);
        expect(container.querySelector('.language-picker')).not.toBeNull();
        await click(
            [...container.querySelectorAll<HTMLButtonElement>('.language-option')].find((b) =>
                b.textContent?.includes('Francês'),
            )!,
        );
        const beforeNext = scroll.mock.calls.length;
        await click(button('Continuar'));
        expect(scroll.mock.calls.length).toBe(beforeNext + 1);
        expect(
            container.querySelector<HTMLInputElement>(
                'input[placeholder="Comment s’appellera ton ami ?"]',
            ),
        ).not.toBeNull();
        expect(container.textContent).toContain('Couleur des yeux');
        expect(container.querySelector('.steps')?.textContent).toContain(
            'Personalidade e identidade',
        );
        await click(button('Continuar'));
        expect(container.querySelector('input[placeholder="Ex. : photographe"]')).not.toBeNull();
        expect(
            [...container.querySelectorAll<HTMLOptionElement>('datalist option')].map(
                (o) => o.value,
            ),
        ).toContain('Photographe');
        expect(container.querySelector<HTMLTextAreaElement>('textarea')?.placeholder).toContain(
            'J’ai grandi près de la mer',
        );
        expect(container.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe(
            character.persona.biography,
        );
        await click(button('Curieux'));
        await click(button('Jeux'));
        await click(button('Salvar'));
        expect(api.saveCharacter).toHaveBeenCalledWith(
            expect.objectContaining({
                persona: expect.objectContaining({
                    description_language: 'fr',
                    traits: ['Curioso'],
                    interests: ['Jogos'],
                    biography: character.persona.biography,
                }),
            }),
        );
        const beforeBack = scroll.mock.calls.length;
        await click(button('Anterior'));
        expect(scroll.mock.calls.length).toBe(beforeBack + 1);
        await click(container.querySelector<HTMLButtonElement>('.steps button')!);
        expect(container.querySelector('.language-picker')).not.toBeNull();
    } finally {
        await act(async () => root.unmount());
        scroll.mockRestore();
    }
}, 15_000);

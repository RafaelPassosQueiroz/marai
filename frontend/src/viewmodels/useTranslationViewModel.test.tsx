// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useTranslationViewModel } from './useTranslationViewModel';
import { api } from '../services/api';
import type { Language } from '../models/types';
import type { TranslationResult } from '../models/translation';

vi.mock('../services/api', () => ({ api: { translate: vi.fn() } }));
let root: Root;
let vm: ReturnType<typeof useTranslationViewModel>;
let language: Language;
const translated: TranslationResult = { translated_text: 'Bonjour', source: 'pt-BR', target: 'fr', provider: 'MyMemory' };
function Harness() { vm = useTranslationViewModel(language); return null; }

beforeEach(async () => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.clearAllMocks();
    language = 'fr';
    vi.mocked(api.translate).mockResolvedValue(translated);
    root = createRoot(document.createElement('div'));
    await act(async () => { root.render(<Harness />); });
});
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals(); });

it('defaults to the conversation language and translates only on explicit request', async () => {
    expect(vm.source).toBe('pt-BR');
    expect(vm.target).toBe('fr');
    await act(async () => { vm.updateText('bom dia'); });
    expect(api.translate).not.toHaveBeenCalled();
    await act(async () => { await vm.translate(); });
    expect(api.translate).toHaveBeenCalledWith('bom dia', 'pt-BR', 'fr');
    expect(vm.result).toEqual(translated);
});

it('counts UTF-8 bytes and blocks multibyte text above 500 bytes', async () => {
    await act(async () => { vm.updateText('あ'.repeat(167)); });
    expect(vm.bytes).toBe(501);
    expect(vm.invalid).toBe(true);
    await act(async () => { await vm.translate(); });
    expect(api.translate).not.toHaveBeenCalled();
    await act(async () => { vm.updateText('é'.repeat(250)); });
    expect(vm.bytes).toBe(500);
    expect(vm.invalid).toBe(false);
});

it('swaps languages and the last result without making another request', async () => {
    await act(async () => { vm.updateText('olá'); });
    await act(async () => { await vm.translate(); });
    await act(async () => { vm.swap(); });
    expect(vm.source).toBe('fr');
    expect(vm.target).toBe('pt-BR');
    expect(vm.text).toBe('Bonjour');
    expect(vm.result).toBeNull();
    expect(api.translate).toHaveBeenCalledTimes(1);
});

it('copies the result and supports manual copying if clipboard permission is denied', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await act(async () => { vm.updateText('olá'); });
    await act(async () => { await vm.translate(); });
    await act(async () => { await vm.copy(); });
    expect(writeText).toHaveBeenCalledWith('Bonjour');
    expect(vm.copied).toBe(true);
    writeText.mockRejectedValueOnce(new Error('clipboard denied'));
    await act(async () => { await vm.copy(); });
    expect(vm.error).toContain('copie manualmente');
    expect(vm.result).toEqual(translated);
});

it('shows a provider error and does not retry automatically', async () => {
    vi.mocked(api.translate).mockRejectedValueOnce(new Error('Limite diário atingido.'));
    await act(async () => { vm.updateText('olá'); });
    await act(async () => { await vm.translate(); });
    expect(vm.error).toContain('Limite diário');
    expect(vm.busy).toBe(false);
    expect(vm.result).toBeNull();
    expect(api.translate).toHaveBeenCalledTimes(1);
});

it('ignores a stale translation after switching conversation language', async () => {
    let resolve!: (value: TranslationResult) => void;
    vi.mocked(api.translate).mockImplementationOnce(() => new Promise((finish) => { resolve = finish; }));
    await act(async () => { vm.updateText('olá'); });
    await act(async () => { void vm.translate(); });
    language = 'ja';
    await act(async () => { root.render(<Harness />); });
    await act(async () => { resolve(translated); });
    expect(vm.target).toBe('ja');
    expect(vm.result).toBeNull();
    expect(vm.busy).toBe(false);
});

it('blocks duplicate submits and rejects equal languages', async () => {
    await act(async () => { vm.updateText('olá'); });
    await act(async () => { await Promise.all([vm.translate(), vm.translate()]); });
    expect(api.translate).toHaveBeenCalledTimes(1);
    await act(async () => { vm.updateSource('fr'); });
    expect(vm.invalid).toBe(true);
    await act(async () => { await vm.translate(); });
    expect(api.translate).toHaveBeenCalledTimes(1);
});

import { useEffect, useRef, useState } from 'react';
import type { Language } from '../models/types';
import { translationBytes, translationTarget } from '../models/translation';
import type { TranslationLanguage, TranslationResult } from '../models/translation';
import { api } from '../services/api';

export function useTranslationViewModel(language: Language) {
    const initialTarget = translationTarget(language);
    const [text, setText] = useState('');
    const [source, setSource] = useState<TranslationLanguage>(initialTarget === 'pt-BR' ? 'en' : 'pt-BR');
    const [target, setTarget] = useState<TranslationLanguage>(initialTarget);
    const [result, setResult] = useState<TranslationResult | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);
    const alive = useRef(true);
    const request = useRef(0);
    const busyRef = useRef(false);
    const bytes = translationBytes(text);
    const invalid = !text.trim() || bytes > 500 || source === target;

    useEffect(() => {
        alive.current = true;
        return () => { alive.current = false; request.current += 1; };
    }, []);
    useEffect(() => {
        request.current += 1;
        busyRef.current = false;
        setBusy(false);
        setSource(language === 'pt' ? 'en' : 'pt-BR');
        setTarget(translationTarget(language));
        setText('');
        setResult(null);
        setError('');
        setCopied(false);
    }, [language]);

    function clearResult() {
        setResult(null);
        setError('');
        setCopied(false);
    }
    function updateText(value: string) {
        if (busyRef.current) return;
        setText(value);
        clearResult();
    }
    function updateSource(value: TranslationLanguage) {
        if (busyRef.current) return;
        setSource(value);
        clearResult();
    }
    function updateTarget(value: TranslationLanguage) {
        if (busyRef.current) return;
        setTarget(value);
        clearResult();
    }
    function swap() {
        if (busyRef.current) return;
        setSource(target);
        setTarget(source);
        if (result) setText(result.translated_text);
        clearResult();
    }
    async function translate() {
        if (busyRef.current || invalid) return;
        busyRef.current = true;
        setBusy(true);
        setError('');
        setCopied(false);
        const version = ++request.current;
        try {
            const translated = await api.translate(text, source, target);
            if (alive.current && request.current === version) setResult(translated);
        } catch (failure) {
            if (alive.current && request.current === version) {
                setResult(null);
                setError((failure as Error).message);
            }
        } finally {
            if (alive.current && request.current === version) {
                busyRef.current = false;
                setBusy(false);
            }
        }
    }
    async function copy() {
        if (!result) return;
        try {
            await navigator.clipboard.writeText(result.translated_text);
            if (alive.current) { setCopied(true); setError(''); }
        } catch {
            if (alive.current) {
                setCopied(false);
                setError('Não consegui copiar automaticamente. Selecione a tradução e copie manualmente.');
            }
        }
    }
    return { text, source, target, result, busy, error, copied, bytes, invalid,
        updateText, updateSource, updateTarget, swap, translate, copy };
}

export type TranslationViewModel = ReturnType<typeof useTranslationViewModel>;

import { describe, expect, it } from 'vitest';
import { revealedText, speechCues } from './reveal';

describe('audio-driven speech balloon', () => {
    it('uses word timestamps while retaining original punctuation', () => {
        const text = 'Hello, friend!';
        const cues = speechCues(text, [
            { start: 0.1, end: 0.5, text: 'Hello' },
            { start: 0.7, end: 1.2, text: 'friend' },
        ]);
        expect(revealedText(text, 0.099, 2, cues)).toBe('');
        expect(revealedText(text, 0.1, 2, cues)).toBe('Hello');
        expect(revealedText(text, 0.699, 2, cues)).toBe('Hello');
        expect(revealedText(text, 0.7, 2, cues)).toBe('Hello, friend');
        expect(revealedText(text, 1.99, 2, cues)).toBe('Hello, friend');
        expect(revealedText(text, 2, 2, cues)).toBe(text);
    });

    it('maps case and accent variants to the original text in the spoken order', () => {
        const text = '¡Sí, sí, amiga!';
        const cues = speechCues(text, [
            { start: 0, end: 0.2, text: 'si' },
            { start: 0.5, end: 0.8, text: 'SI' },
            { start: 1.2, end: 1.9, text: 'amiga!' },
        ]);
        expect(revealedText(text, 0.3, 2, cues)).toBe('¡Sí');
        expect(revealedText(text, 0.7, 2, cues)).toBe('¡Sí, sí');
    });

    it('reveals Japanese on word boundaries without requiring spaces', () => {
        const text = 'こんにちは。ゲームは好き？';
        const cues = speechCues(text, [
            { start: 0.2, end: 0.6, text: 'こんにちは' },
            { start: 1.5, end: 1.9, text: 'ゲーム' },
            { start: 2, end: 2.5, text: 'は好き' },
        ]);
        expect(revealedText(text, 1, 3, cues)).toBe('こんにちは');
        expect(revealedText(text, 1.5, 3, cues)).toBe('こんにちは。ゲーム');
        expect(revealedText(text, 3, 3, cues)).toBe(text);
    });

    it('shows the transcript without guessing times if alignment is missing or incomplete', () => {
        const text = 'A small story.';
        const cues = speechCues(text, [
            { start: 0.1, end: 0.2, text: 'A' },
            { start: 1, end: 2, text: 'story' },
        ]);
        expect(cues).toEqual([]);
        expect(revealedText(text, 0, 3, cues)).toBe(text);
        expect(revealedText(text, 2, 3, [])).toBe(text);
    });

    it('does not fabricate text before metadata arrives', () => {
        const cues = speechCues('Hi', [{ start: 0, end: 0.3, text: 'Hi' }]);
        expect(revealedText('Hi', 0, NaN, cues)).toBe('');
    });
});

import { describe, expect, it } from 'vitest';
import { revealedText } from './reveal';

describe('audio-driven speech balloon', () => {
    it('uses word timestamps while retaining original punctuation', () => {
        const timings = [
            { start: 0.1, end: 0.5, text: 'Hello' },
            { start: 0.7, end: 1.2, text: 'friend' },
        ];
        expect(revealedText('Hello, friend!', 0, 2, timings)).toBe('');
        expect(revealedText('Hello, friend!', 0.6, 2, timings)).toBe('Hello');
        expect(revealedText('Hello, friend!', 0.9, 2, timings)).toBe('Hello, friend');
        expect(revealedText('Hello, friend!', 2, 2, timings)).toBe('Hello, friend!');
    });
    it('uses audio time for the fallback instead of a wall-clock timer', () => {
        expect(revealedText('A small story.', 1, 3, [])).toBe('A ');
        expect(revealedText('A small story.', 2, 3, [])).toBe('A small ');
    });
    it('reveals Japanese progressively when only duration is known', () => {
        const text = 'こんにちは。ゲームは好きですか？';
        const partial = revealedText(text, 2, 5, []);
        expect(partial.length).toBeGreaterThan(0);
        expect(partial.length).toBeLessThan(text.length);
        expect(revealedText(text, 5, 5, [])).toBe(text);
    });
    it('does not fabricate text before metadata arrives', () => {
        expect(revealedText('Hi', 0, NaN, [])).toBe('');
    });
});

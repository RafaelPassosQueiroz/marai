import type { Speech } from '../models/types';

export function revealedText(
    text: string,
    time: number,
    duration: number,
    timings: Speech['timings'],
): string {
    if (!Number.isFinite(duration) || duration <= 0) return '';
    if (time >= duration - 0.08) return text;
    if (timings.length) {
        let cursor = 0;
        for (const word of timings) {
            if (word.start > time) break;
            const index = text.indexOf(word.text, cursor);
            if (index !== -1) cursor = index + word.text.length;
        }
        return text.slice(0, cursor);
    }
    // Duration-based segment approximation, also supports Japanese without spaces.
    const segments = text.match(/\S+\s*|\s+/gu) ?? [];
    const parts = segments.length < 3 ? Array.from(text) : segments;
    const count = Math.ceil(Math.max(0, Math.min(1, time / duration)) * parts.length);
    return parts.slice(0, count).join('');
}

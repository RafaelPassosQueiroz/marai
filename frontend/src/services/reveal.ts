import type { Speech } from '../models/types';

type SpeechCue = { start: number; endIndex: number };

function normalizeSpokenText(text: string): string {
    return text.normalize('NFKD').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

export function speechCues(text: string, timings: Speech['timings']): SpeechCue[] {
    if (!timings.length) return [];

    // Keep offsets into the displayed text, including any combining marks.
    let normalized = '';
    let end = 0;
    const offsets: number[] = [];
    for (const [original] of text.matchAll(/\P{M}\p{M}*|\p{M}+/gu)) {
        const segment = normalizeSpokenText(original);
        end += original.length;
        normalized += segment;
        for (let i = 0; i < segment.length; i++) offsets.push(end);
    }

    const cues: SpeechCue[] = [];
    let cursor = 0;
    let previousStart = 0;
    for (const timing of timings) {
        const word = normalizeSpokenText(timing.text);
        if (!word) continue;
        if (
            !Number.isFinite(timing.start) ||
            !Number.isFinite(timing.end) ||
            timing.start < previousStart ||
            timing.end < timing.start ||
            !normalized.startsWith(word, cursor)
        ) {
            return [];
        }

        cursor += word.length;
        cues.push({ start: timing.start, endIndex: offsets[cursor - 1] });
        previousStart = timing.start;
    }
    return cursor === normalized.length ? cues : [];
}

export function revealedText(
    text: string,
    time: number,
    duration: number,
    cues: SpeechCue[],
): string {
    if (!cues.length) return text;
    if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(time)) return '';
    if (time >= duration || cues[cues.length - 1].start >= duration) return text;

    let first = 0;
    let last = cues.length;
    while (first < last) {
        const middle = Math.floor((first + last) / 2);
        if (cues[middle].start <= time) first = middle + 1;
        else last = middle;
    }
    return text.slice(0, cues[first - 1]?.endIndex ?? 0);
}

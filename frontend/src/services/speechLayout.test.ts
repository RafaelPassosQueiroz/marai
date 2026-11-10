import { expect, it } from 'vitest';
import { fitSpeechFont } from './speechLayout';

it('fits a complete response with the largest readable font that fits', () => {
    expect(fitSpeechFont(20, 14, 170, (size) => size * 10)).toEqual({ size: 17, expanded: false });
});
it('expands the page instead of clipping copy or shrinking below readable type', () => {
    expect(fitSpeechFont(20, 14, 100, (size) => size * 10)).toEqual({ size: 14, expanded: true });
});

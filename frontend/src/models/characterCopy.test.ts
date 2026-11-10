import { expect, it } from 'vitest';
import { characterText, professionSuggestions } from './characterCopy';
import { languages, traits, interests } from './catalog';

it('provides descriptive choices, jobs and real biography examples in all seven languages', () => {
    for (const { value } of languages) {
        for (const text of [...traits, ...interests, 'Ex.: fotógrafo', 'Como ele vai se chamar?']) {
            expect(characterText(value, text).length).toBeGreaterThan(0);
        }
        expect(professionSuggestions[value].length).toBeGreaterThanOrEqual(3);
    }
    expect(characterText('fr', 'Curioso')).toBe('Curieux');
    expect(characterText('fr', 'Ex.: fotógrafo')).toBe('Ex. : photographe');
    expect(characterText('ja', 'Jogos')).toBe('ゲーム');
    expect(
        characterText('de', 'Gostos, histórias e pequenos detalhes que tornam seu amigo único.'),
    ).toContain('aufgewachsen');
});

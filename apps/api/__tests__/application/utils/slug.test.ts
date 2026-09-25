import { describe, expect, it } from 'vitest';
import { generateUniqueSlug, isValidSlug, slugify } from '../../../src/application/utils/slug.js';

/**
 * Ghanaian and Hausa letters such as ɛ, ɔ, ŋ, ɓ, ɗ and ƙ have no Unicode
 * decomposition, so they used to be replaced by hyphens: "Dɛnkyɛm Medical Fund"
 * became "d-nky-m-medical-fund".
 */
describe('slugify', () => {
  it.each([
    ['Dɛnkyɛm Medical Fund', 'denkyem-medical-fund'],
    ['Adɔmi', 'adomi'],
    ['Nana Akua Ɔpɔku', 'nana-akua-opoku'],
    ['Ŋkɔsoɔ Youth', 'ngkosoo-youth'],
    ['Ɗan ƙasa ɓangare', 'dan-kasa-bangare'],
    ['Eʋe ɣleti ɖevi', 'eve-gleti-devi'],
  ])('transliterates %s', (input, expected) => {
    expect(slugify(input)).toBe(expected);
    expect(isValidSlug(slugify(input))).toBe(true);
  });

  it('keeps decomposable accents and plain ASCII unchanged', () => {
    expect(slugify('Café Ségou')).toBe('cafe-segou');
    expect(slugify('Ọmọ Ṣadé')).toBe('omo-sade');
    expect(slugify('  Help Ama -- finish school!  ')).toBe('help-ama-finish-school');
  });

  it('keeps the length cap and reserved-slug rules', async () => {
    expect(slugify('ɛ'.repeat(80)).length).toBeLessThanOrEqual(60);
    expect(isValidSlug(slugify('Admin'))).toBe(false);
    expect(await generateUniqueSlug('Ɔdɔ', async () => false)).toBe('odo');
  });
});

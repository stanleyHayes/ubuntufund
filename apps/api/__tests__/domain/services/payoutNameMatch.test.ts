import { describe, expect, it } from 'vitest';
import { payoutNamesMatch, payoutNameTokens } from '../../../src/domain/services/payoutNameMatch.js';

describe('payout account name matching', () => {
  it.each([
    ['Kwame Mensah', 'KWAME MENSAH', 'case'],
    ['Kwame Mensah', 'MENSAH KWAME', 'surname first'],
    ['Kwame Mensah', 'Kwame Owusu Mensah', 'middle name on the provider side'],
    ['Kwame Owusu Mensah', 'MENSAH KWAME', 'middle name typed but not registered'],
    ['Kwame K. Mensah', 'Kwame Mensah', 'initial'],
    ['Ɔsei Bɛnyiwa', 'OSEI BENYIWA', 'Akan open vowels'],
    ['Adwoa Asantɛ', 'Adwoa Asante', 'lower-case open e'],
    ['Kwaku Ŋkansah', 'KWAKU NKANSAH', 'eng'],
    ['Akosua Agyemáng', 'AKOSUA AGYEMANG', 'accent'],
    ['Ama', 'AMA', 'identical single name'],
    ['Mary-Jane Owusu', 'MARYJANE OWUSU', 'hyphen folded like the previous exact check'],
    ['Ujimora Community Fund Ltd', 'UJIMORA COMMUNITY FUND LTD', 'organization'],
  ])('matches %s vs %s (%s)', (typed, resolved) => {
    expect(payoutNamesMatch(typed, resolved)).toBe(true);
  });

  it.each([
    ['Kwame Mensah', 'Kofi Mensah', 'different given name'],
    ['Kwame Mensah', 'Kwame Boateng', 'different surname'],
    ['Kwame', 'Kwame Mensah', 'a lone shared name'],
    ['Mensah', 'MENSAH KWAME', 'surname only'],
    ['Kwame Mensah', 'Ama Serwaa', 'different person'],
    ['K. Mensah', 'Kofi Mensah', 'initial is not a name'],
    ['Kwame Mensah', undefined, 'provider name unavailable'],
    ['', '', 'empty'],
  ])('does not match %s vs %s (%s)', (typed, resolved) => {
    expect(payoutNamesMatch(typed, resolved)).toBe(false);
  });

  it('tokenizes without diacritics, punctuation or initials', () => {
    expect(payoutNameTokens('  Ɔsei, K.  Bɛnyiwa-Asantɛ ')).toEqual(['osei', 'benyiwa', 'asante']);
  });
});

/**
 * Compare the account name a person typed with the name the bank or telco
 * holds for that account. Tolerates what differs for the same person in Ghana
 * without accepting a different person:
 *
 *  - order: "Mensah Kwame" ≡ "KWAME MENSAH" (surname-first registrations);
 *  - diacritics and Akan/Ewe letters: "Ɔsei Bɛnyiwa" ≡ "Osei Benyiwa", "Adwoa Asantɛ" ≡ "Adwoa Asante";
 *  - punctuation, spacing and initials: "Kwame K. Mensah" ≡ "Kwame Mensah";
 *  - a middle or extra name on one side: "Kwame Mensah" ≡ "Kwame Owusu Mensah",
 *    but only when the shorter name still has at least two full names, all of
 *    which appear in the longer one.
 *
 * Different given names or surnames ("Kwame Mensah" vs "Kofi Mensah"), and a
 * lone shared name ("Kwame" vs "Kwame Mensah"), never match.
 */

/** Letters with no Unicode decomposition that Ghanaian names commonly use. */
const FOLDED_LETTERS: Record<string, string> = { ɔ: 'o', ɛ: 'e', ŋ: 'n', ƒ: 'f', ʋ: 'v', ɖ: 'd', ɣ: 'g' }

function folded(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[ɔɛŋƒʋɖɣ]/g, (letter) => FOLDED_LETTERS[letter] ?? letter)
}

/** Full-name tokens (initials and single letters are ignored). */
export function payoutNameTokens(name: string): string[] {
  return folded(name)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(' ')
    .filter((token) => token.length >= 2)
}

export function payoutNamesMatch(typed: string | undefined, resolved: string | undefined): boolean {
  if (!typed || !resolved) return false
  // The exact comparison the check always made, now with diacritics folded:
  // it keeps single-name and hyphen/spacing variants ("Mary-Jane" / "MaryJane").
  const compact = (name: string) => folded(name).replace(/[^\p{L}\p{N}]/gu, '')
  if (compact(typed) && compact(typed) === compact(resolved)) return true
  const a = new Set(payoutNameTokens(typed))
  const b = new Set(payoutNameTokens(resolved))
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a]
  if (smaller.size < 2) return false
  for (const token of smaller) if (!larger.has(token)) return false
  return true
}

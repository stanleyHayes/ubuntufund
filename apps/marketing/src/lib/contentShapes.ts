/**
 * Runtime shape guards for CMS blocks.
 *
 * The API stores whatever an admin saves, and the pages map over the payload.
 * A block of the wrong shape (`{}` for marketing.stats, `items: null` for the
 * FAQ) used to throw during render and blank the whole page. useContent keeps
 * the built-in fallback whenever a payload fails its guard.
 */
type Guard = (value: unknown) => boolean

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isString = (value: unknown): value is string => typeof value === 'string'
const optionalString = (value: unknown) => value === undefined || value === null || isString(value)
const hasStrings = (value: unknown, keys: string[]) => isRecord(value) && keys.every((key) => isString(value[key]))
const arrayOf = (value: unknown, item: Guard) => Array.isArray(value) && value.every(item)

export const isStatsContent: Guard = (value) =>
  isRecord(value) && arrayOf(value.items, (item) => hasStrings(item, ['value', 'label']))

export const isFaqContent: Guard = (value) =>
  isRecord(value) && arrayOf(value.items, (item) => hasStrings(item, ['category', 'question', 'answer']))

const isTeamMember: Guard = (value) =>
  hasStrings(value, ['name', 'role', 'initials', 'bio']) &&
  isRecord(value) &&
  ['image', 'website', 'companyUrl'].every((key) => optionalString(value[key])) &&
  (value.socials === undefined || arrayOf(value.socials, (social) => hasStrings(social, ['label', 'href'])))

export const isAboutContent: Guard = (value) =>
  isRecord(value) &&
  hasStrings(value.hero, ['title', 'subtitle']) &&
  hasStrings(value.mission, ['eyebrow', 'title', 'body']) &&
  hasStrings(value.vision, ['eyebrow', 'title', 'body']) &&
  hasStrings(value.philosophy, ['eyebrow', 'quote', 'body']) &&
  (value.team === undefined || arrayOf(value.team, isTeamMember))

export const isContactContent: Guard = (value) =>
  isRecord(value) &&
  ['email', 'phone', 'address', 'hours'].every((key) => optionalString(value[key])) &&
  (value.socials === undefined || (isRecord(value.socials) && Object.values(value.socials).every(optionalString))) &&
  (value.responseTimes === undefined || arrayOf(value.responseTimes, (row) => hasStrings(row, ['label', 'time'])))

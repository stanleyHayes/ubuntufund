import { randomUUID } from 'expo-crypto'

/**
 * One Idempotency-Key per submitted version: resubmitting the same payload
 * after a lost response reuses it (the API returns the campaign it already
 * created); any change to the payload starts a new key.
 */
export function creationRequestKey(current: { payload: string; key: string } | null, payload: unknown): { payload: string; key: string } {
  const signature = JSON.stringify(payload)
  return current?.payload === signature ? current : { payload: signature, key: randomUUID() }
}

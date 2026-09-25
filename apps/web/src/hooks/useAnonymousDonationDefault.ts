import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

/**
 * The signed-in donor's "Make my donations anonymous by default" setting, or
 * undefined while unknown (guest, loading, or the profile could not be read).
 * Donation forms pre-select "Give anonymously" from it; the donor can still
 * change the box for a single donation.
 */
export function useAnonymousDonationDefault(userId: string | undefined): boolean | undefined {
  const [value, setValue] = useState<{ userId: string; anonymous: boolean }>()
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    api.get<{ anonymousDonations?: boolean }>('/profile')
      .then((profile) => { if (!cancelled) setValue({ userId, anonymous: profile.anonymousDonations === true }) })
      .catch(() => { /* Leave unknown; the server applies the setting when no choice is sent. */ })
    return () => { cancelled = true }
  }, [userId])
  return userId && value?.userId === userId ? value.anonymous : undefined
}

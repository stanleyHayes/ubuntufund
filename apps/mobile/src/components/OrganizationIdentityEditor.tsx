import { useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import { Button, Text } from 'react-native-paper'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { BrandedTextInput } from '@/components/BrandedTextInput'
import { GlassSurface } from '@/components/GlassSurface'
import { PublicationConsent } from '@/components/PublicationConsent'
import { PublicationReviews } from '@/components/PublicationReviews'
import { PublicationHeldNotice } from '@/components/PublicationHeldNotice'
import { isPublicationHeld } from '@/lib/publicationDrafts'

/** Organization identity is saved and reviewed separately from private account fields. */
export function OrganizationIdentityEditor() {
  const { user } = useAuth()
  return user?.role === 'organization' ? <IdentityForm key={user.id} organizationId={user.id} /> : null
}
function IdentityForm({ organizationId }: { organizationId: string }) {
  const live = useRef(true)
  const [name, setName] = useState(''), [website, setWebsite] = useState('')
  const [consent, setConsent] = useState(false), [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true), [retry, setRetry] = useState(0)
  const [loadError, setLoadError] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState('')
  // Held for safety review: a notice, not an error.
  const [held, setHeld] = useState(false)
  useEffect(() => { live.current = true; return () => { live.current = false } }, [])
  useEffect(() => {
    let active = true
    setLoading(true); setLoadError('')
    api.get<{ name: string; website: string }>(`/organization-team/${organizationId}`).then(data => {
      if (active) { setName(data.name); setWebsite(data.website) }
    }).catch(() => { if (active) setLoadError('Could not load organization details.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [organizationId, retry])
  async function save() {
    if (busy) return
    setBusy(true); setError(''); setHeld(false); setNotice('')
    try {
      await api.put(`/organization-team/${organizationId}/profile`, { organizationName: name, website, automatedReviewConsent: consent })
      if (live.current) setNotice('Organization profile updated.')
    } catch (cause) {
      if (!live.current) return
      if (isPublicationHeld(cause)) setHeld(true)
      else setError(cause instanceof Error ? cause.message : 'Could not save organization details.')
    }
    finally { if (live.current) setBusy(false) }
  }
  return <GlassSurface style={{ padding: 20 }}><View style={{ gap: 16 }}>
    <Text variant="titleLarge">Organization identity</Text>
    <Text>Changes to your public organization name and website need safety review.</Text>
    {loading ? <Text>Loading organization details…</Text> : loadError ? <><Text accessibilityRole="alert">{loadError}</Text><Button onPress={() => setRetry(value => value + 1)}>Retry organization details</Button></> : <>
      <BrandedTextInput label="Organization name" value={name} onChangeText={setName} disabled={busy} />
      <BrandedTextInput label="Website" value={website} onChangeText={setWebsite} disabled={busy} autoCapitalize="none" keyboardType="url" />
      <PublicationConsent value={consent} onChange={setConsent} />
      {error ? <><Text accessibilityRole="alert">{error}</Text><PublicationReviews /></> : null}
      {held ? <><PublicationHeldNotice retry="save it again unchanged" reviews="below" /><PublicationReviews /></> : null}
      {notice ? <Text accessibilityRole="alert">{notice}</Text> : null}
      <Button mode="contained" disabled={busy || name.trim().length < 2} loading={busy} onPress={() => void save()}>Save organization details</Button>
    </>}
  </View></GlassSurface>
}

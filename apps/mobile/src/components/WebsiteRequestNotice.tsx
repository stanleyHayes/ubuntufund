import { useEffect, useState } from 'react'
import { View, Linking } from 'react-native'
import { Text } from 'react-native-paper'
import { useAuth } from '@/context/AuthContext'
import { usePalette } from '@/context/ColorModeContext'
import { api } from '@/lib/api'
import { Button } from './Loading'

export function WebsiteRequestNotice() {
  const { user, isAuthenticated } = useAuth()
  if (!isAuthenticated || user?.role !== 'organization') return null
  return <RequestNotice key={user.id} />
}

function RequestNotice() {
  const p = usePalette()
  const [requested, setRequested] = useState(false)
  const [withdrawn, setWithdrawn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    void api.get<{ needsWebsite: boolean }>('/profile/website-request').then(result => { if (active) setRequested(result.needsWebsite) }).catch(() => {})
    return () => { active = false }
  }, [])
  async function withdraw() {
    setBusy(true); setError('')
    try { await api.post('/profile/website-request/withdraw'); setRequested(false); setWithdrawn(true) }
    catch { setError('Could not withdraw your request. Please try again.') }
    finally { setBusy(false) }
  }
  async function open(url: string) { try { await Linking.openURL(url) } catch { setError('Could not open the contact link.') } }
  if (!requested && !withdrawn) return null
  return <View style={{ padding: 12, backgroundColor: p.background, gap: 4 }}>
    <Text accessibilityRole="alert" style={{ color: p.text }}>{withdrawn ? 'Your website-contact request has been withdrawn.' : 'Our parent company, Neurodyne Corp Ltd, will contact you about a website for your organization.'}</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}><Button onPress={() => void open('https://neurodyne.dev')}>neurodyne.dev</Button><Button onPress={() => void open('mailto:info@neurodyne.dev')}>info@neurodyne.dev</Button></View>
    {error && <Text accessibilityRole="alert" style={{ color: p.error }}>{error}</Text>}
    {requested ? <Button disabled={busy} onPress={() => void withdraw()}>{busy ? 'Withdrawing…' : 'Withdraw website request'}</Button> : <Button onPress={() => setWithdrawn(false)}>Dismiss</Button>}
  </View>
}

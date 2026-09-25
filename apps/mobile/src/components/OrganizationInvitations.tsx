import { useCallback, useEffect, useState } from 'react'
import { Alert, Linking, View } from 'react-native'
import { Text } from 'react-native-paper'
import { api } from '@/lib/api'
import { Button } from '@/components/Loading'
import { usePalette, useNeu } from '@/context/ColorModeContext'
import { managesOrganizationTeam, organizationTeamUrl, pendingOrganizationInvitations, type OrganizationMembership } from '@/lib/organizationInvitations'

/**
 * Organization team invitations, which were only visible on the website.
 * Accepting needs a verified email (the API says so if not). Team management
 * itself stays on the website.
 */
export function OrganizationInvitations() {
  const p = usePalette(); const neu = useNeu()
  const [rows, setRows] = useState<OrganizationMembership[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const load = useCallback(async () => {
    try { const data = await api.get<OrganizationMembership[]>('/organization-team/mine'); setRows(Array.isArray(data) ? data : []); setError('') }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load organization invitations.') }
  }, [])
  useEffect(() => { void load() }, [load])
  const pending = pendingOrganizationInvitations(rows)
  async function accept(invitationId: string) {
    setBusy(invitationId)
    try { await api.post(`/organization-team/invitations/${invitationId}/accept`, {}); Alert.alert('Accepted', 'You joined the organization team.'); await load() }
    catch (e) { Alert.alert('Could not accept', e instanceof Error ? e.message : 'Please try again.') }
    finally { setBusy('') }
  }
  if (!pending.length && !managesOrganizationTeam(rows) && !error) return null
  const card = { ...neu.raised, backgroundColor: p.surface, borderRadius: 14, padding: 16, marginBottom: 12, gap: 8 }
  return <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
    <Text style={{ fontSize: 15, fontFamily: 'Outfit_700Bold', color: p.text, marginBottom: 8 }}>Organization teams</Text>
    {error ? <Text accessibilityRole="alert" style={{ color: p.error, marginBottom: 8 }}>{error}</Text> : null}
    {pending.map(invite => <View key={invite.invitationId} style={card}>
      <Text style={{ fontSize: 16, fontFamily: 'Outfit_700Bold', color: p.text }}>{invite.name ?? 'Organization'}</Text>
      <Text style={{ color: p.textSecondary }}>Invited as {invite.role}. Invitations expire after seven days.</Text>
      <Button mode="contained" loading={busy === invite.invitationId} disabled={!!busy} onPress={() => void accept(invite.invitationId)}>Accept invitation</Button>
    </View>)}
    {managesOrganizationTeam(rows) && <Button mode="outlined" onPress={() => void Linking.openURL(organizationTeamUrl())}>Manage your organization team on the website</Button>}
  </View>
}

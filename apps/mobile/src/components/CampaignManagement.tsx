import { useCallback, useEffect, useState } from 'react'
import { Alert, Image, Share, View } from 'react-native'
import { Text, Checkbox } from 'react-native-paper'
import * as Clipboard from 'expo-clipboard'
import type { CampaignCollaborator, CampaignSplitVersion, QrCodeResponse, QrKind, ShortLinkView } from '@ubuntu-fund/types'
import { api } from '@/lib/api'
import { GlassSurface } from './GlassSurface'
import { Button, PageSkeleton } from './Loading'
import { BrandedTextInput as TextInput } from './BrandedTextInput'
import { SelectionField } from './SelectionField'
import { usePalette } from '@/context/ColorModeContext'

function useResource<T>(path: string) {
  const [value, setValue] = useState<T | null>(null)
  const [error, setError] = useState(''); const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setValue(await api.get<T>(path)) } catch (e) { setError(e instanceof Error ? e.message : 'Could not load this section.') } finally { setLoading(false) }
  }, [path])
  useEffect(() => { void load() }, [load])
  return { value, load, error, loading, setError }
}
export function CollaboratorManager({ campaignId }: { campaignId: string }) {
  const resource = useResource<CampaignCollaborator[] | { items: CampaignCollaborator[] }>(`/campaigns/${campaignId}/collaborators`)
  const [email, setEmail] = useState(''); const [role, setRole] = useState('editor'); const [share, setShare] = useState('0'); const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState(''); const p = usePalette()
  const collaborators = Array.isArray(resource.value) ? resource.value : resource.value?.items ?? []
  async function change(operation: () => Promise<unknown>, success: string) {
    setBusy(true); resource.setError(''); setNotice('')
    try { await operation(); setNotice(success); await resource.load() } catch (e) { resource.setError(e instanceof Error ? e.message : 'Could not update collaborators.') } finally { setBusy(false) }
  }
  return <GlassSurface style={{ padding: 20, borderRadius: 24, gap: 12 }}>
    <Text variant="titleLarge">Collaborators</Text>
    {resource.error ? <><Text accessibilityRole="alert" style={{ color: p.error }}>{resource.error}</Text><Button onPress={() => void resource.load()}>Reload collaborators</Button></> : null}
    {notice ? <Text accessibilityLiveRegion="polite">{notice}</Text> : null}
    {resource.loading ? <PageSkeleton /> : collaborators.filter(item => item.status !== 'removed').map(item => <View key={item.id} style={{ gap: 6 }}><Text>{item.displayName} · {item.role.replaceAll('_', ' ')} · {item.status}</Text><Button disabled={busy} onPress={() => Alert.alert('Remove collaborator?', `Remove ${item.displayName} from this campaign?`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => void change(() => api.delete(`/campaigns/${campaignId}/collaborators/${item.id}`), 'Collaborator removed.') }])}>Remove</Button></View>)}
    <TextInput label="Collaborator email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
    <SelectionField label="Role" value={role} onChange={setRole} options={[{ value: 'editor', label: 'Editor' }, { value: 'co_owner', label: 'Co-owner' }, { value: 'featured_partner', label: 'Featured partner' }]} />
    <TextInput label="Revenue share (%)" value={share} onChangeText={setShare} keyboardType="decimal-pad" />
    <TextInput label="Invitation message (optional)" value={message} onChangeText={setMessage} multiline />
    <Button mode="contained" loading={busy} disabled={busy || !/^\S+@\S+\.\S+$/.test(email.trim()) || !Number.isFinite(Number(share)) || Number(share) < 0 || Number(share) > 100} onPress={() => void change(async () => { await api.post(`/campaigns/${campaignId}/collaborators/invite`, { userEmail: email.trim(), role, revenueSharePercent: Number(share), inviteMessage: message.trim() || undefined }); setEmail(''); setMessage('') }, 'Invitation sent.')}>Send invitation</Button>
  </GlassSurface>
}
export function SplitManager({ campaignId }: { campaignId: string }) {
  const resource = useResource<CampaignSplitVersion[]>(`/campaigns/${campaignId}/split/versions`)
  const version = [...(resource.value ?? [])].sort((a, b) => b.version - a.version)[0]
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({}); const [busy, setBusy] = useState(false); const p = usePalette()
  async function change(path: string, input: object) {
    setBusy(true); resource.setError('')
    try { await api.post(path, input); await resource.load(); setConfirmed({}) } catch (e) { resource.setError(e instanceof Error ? e.message : 'Could not update split.') } finally { setBusy(false) }
  }
  return <GlassSurface style={{ padding: 20, borderRadius: 24, gap: 12 }}><Text variant="titleLarge">Split proceeds</Text>
    {resource.error ? <><Text accessibilityRole="alert" style={{ color: p.error }}>{resource.error}</Text><Button onPress={() => void resource.load()}>Reload split</Button></> : resource.loading ? <PageSkeleton /> : !version ? <SplitDraftForm campaignId={campaignId} onSaved={resource.load} /> : <>
      <Text>Version {version.version} · {version.status}{version.locked ? ' · Locked' : ''}</Text><Text>Record acceptance only after the named beneficiary has agreed. Every beneficiary must accept before activation.</Text>
      {version.allocations.map(item => <View key={item.beneficiaryId} style={{ gap: 8 }}><Text>{item.name} · {item.shareBps / 100}% · {item.consent}</Text>{version.status === 'draft' && !version.locked && item.consent !== 'accepted' && <><Checkbox.Item label={`I have received ${item.name}’s acceptance`} status={confirmed[item.beneficiaryId] ? 'checked' : 'unchecked'} disabled={busy} onPress={() => setConfirmed(state => ({ ...state, [item.beneficiaryId]: !state[item.beneficiaryId] }))} /><Button disabled={busy || !confirmed[item.beneficiaryId]} onPress={() => void change(`/campaigns/${campaignId}/split/${version.version}/consent`, { beneficiaryId: item.beneficiaryId, status: 'accepted' })}>Record acceptance</Button></>}</View>)}
      {version.status === 'draft' && <Button mode="contained" loading={busy} disabled={busy || version.locked || !version.allocations.every(item => item.consent === 'accepted')} onPress={() => void change(`/campaigns/${campaignId}/split/${version.version}/activate`, {})}>Activate agreed split</Button>}
    </>}
  </GlassSurface>
}
export function QrManager({ campaignId, liveSessionId }: { campaignId: string; liveSessionId?: string }) {
  const resource = useResource<ShortLinkView[]>(`/campaigns/${campaignId}/qr-codes`)
  const [kind, setKind] = useState<QrKind>('campaign'); const [amount, setAmount] = useState(''); const [label, setLabel] = useState('')
  const [created, setCreated] = useState<QrCodeResponse | null>(null); const [busy, setBusy] = useState(false); const [copied, setCopied] = useState(''); const p = usePalette()
  async function create() {
    setBusy(true); resource.setError('')
    try { setCreated(await api.post<QrCodeResponse>(`/campaigns/${campaignId}/qr-codes`, { kind, presetAmount: kind === 'amount' ? Number(amount) : undefined, liveSessionId: kind === 'live' ? liveSessionId : undefined, label: label.trim() || undefined })); await resource.load() } catch (e) { resource.setError(e instanceof Error ? e.message : 'Could not create QR code.') } finally { setBusy(false) }
  }
  return <GlassSurface style={{ padding: 20, borderRadius: 24, gap: 12 }}><Text variant="titleLarge">Share with a QR code</Text>
    {resource.error ? <><Text accessibilityRole="alert" style={{ color: p.error }}>{resource.error}</Text><Button onPress={() => void resource.load()}>Reload QR codes</Button></> : null}
    <SelectionField label="Link destination" value={kind} onChange={value => setKind(value as QrKind)} options={[{ value: 'campaign', label: 'Campaign' }, { value: 'amount', label: 'Preset donation amount' }, { value: 'creator', label: 'Creator profile' }, { value: 'event', label: 'Event or flyer' }, ...(liveSessionId ? [{ value: 'live', label: 'Current broadcast' }] : [])]} />
    {kind === 'amount' && <TextInput label="Preset amount (GHS)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />}
    <TextInput label="Label (optional)" value={label} onChangeText={setLabel} />
    <Button mode="contained" loading={busy} disabled={busy || (kind === 'amount' && (!Number.isFinite(Number(amount)) || Number(amount) <= 0))} onPress={() => void create()}>Create QR code</Button>
    {created && <><Image source={{ uri: created.pngDataUrl }} accessibilityLabel="Campaign QR code" style={{ width: 220, height: 220, alignSelf: 'center' }} /><Text selectable>{created.shortUrl}</Text><Button onPress={() => void Share.share({ message: created.shortUrl })}>Share link</Button></>}
    {resource.loading ? <PageSkeleton /> : resource.value?.map(item => <View key={item.code} style={{ gap: 6 }}><Text>{item.label || item.kind} · {item.scanCount} scans</Text><Text selectable>{item.shortUrl}</Text><Button onPress={() => void Clipboard.setStringAsync(item.shortUrl).then(() => setCopied(item.code))}>{copied === item.code ? 'Copied' : 'Copy link'}</Button></View>)}
  </GlassSurface>
}

function SplitDraftForm({ campaignId, onSaved }: { campaignId: string; onSaved: () => Promise<void> }) {
  const [rows, setRows] = useState([{ name: '', email: '', percent: '50' }, { name: '', email: '', percent: '50' }])
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const p = usePalette()
  const valid = rows.length >= 2 && rows.length <= 50 && rows.every(row => row.name.trim() && /^\S+@\S+\.\S+$/.test(row.email.trim()) && /^\d+(\.\d{1,2})?$/.test(row.percent) && Number(row.percent) > 0) && rows.reduce((total, row) => total + Math.round(Number(row.percent) * 100), 0) === 10000
  async function save() {
    setBusy(true); setError('')
    try { await api.post(`/campaigns/${campaignId}/split`, { allocations: rows.map(row => ({ name: row.name.trim(), email: row.email.trim(), shareBps: Math.round(Number(row.percent) * 100) })) }); await onSaved() } catch (e) { setError(e instanceof Error ? e.message : 'Could not save split.') } finally { setBusy(false) }
  }
  return <View style={{ gap: 12 }}><Text>No split allocation is configured. If your plan allows split proceeds, add at least two beneficiaries whose shares total 100%. Their acceptance is required before activation.</Text>
    {rows.map((row, index) => <View key={index} style={{ gap: 8 }}><Text>Beneficiary {index + 1}</Text>{(['name', 'email', 'percent'] as const).map(field => <TextInput key={field} label={field === 'percent' ? 'Share (%)' : field === 'email' ? 'Email' : 'Full name'} value={row[field]} onChangeText={value => setRows(items => items.map((item, i) => i === index ? { ...item, [field]: value } : item))} keyboardType={field === 'percent' ? 'decimal-pad' : field === 'email' ? 'email-address' : 'default'} autoCapitalize={field === 'email' ? 'none' : 'sentences'} />)}<Button disabled={busy || rows.length <= 2} onPress={() => setRows(items => items.filter((_, i) => i !== index))}>Remove beneficiary</Button></View>)}
    <Button disabled={busy || rows.length >= 50} onPress={() => setRows(items => [...items, { name: '', email: '', percent: '' }])}>Add beneficiary</Button>
    {error ? <Text accessibilityRole="alert" style={{ color: p.error }}>{error}</Text> : null}
    <Button mode="contained" loading={busy} disabled={busy || !valid} onPress={() => void save()}>Save split draft</Button>
  </View>
}

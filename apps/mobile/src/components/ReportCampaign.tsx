import { useState } from 'react'
import { ScrollView } from 'react-native'
import { Dialog, Portal, Text } from 'react-native-paper'
import { router } from 'expo-router'
import { useAuth } from '@/context/AuthContext'
import { usePalette } from '@/context/ColorModeContext'
import { CAMPAIGN_REPORT_DETAILS_MAX, campaignReportOptions, isCampaignReportReason, reportCampaign } from '@/lib/campaignReport'
import { signInHref } from '@/navigation/returnTo'
import { Button } from './Loading'
import { BrandedTextInput } from './BrandedTextInput'
import { SelectionField } from './SelectionField'

/**
 * "Report campaign" for signed-in viewers other than the creator (the API
 * requires sign-in and refuses self-reports). Signed-out viewers get a sign-in
 * prompt that returns them to this campaign.
 */
export function ReportCampaign({ campaignId, creatorId }: { campaignId: string; creatorId: string }) {
  const { user } = useAuth()
  const p = usePalette()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  if (user?.id === creatorId) return null
  if (!user) {
    return <Button mode="text" icon="flag-outline" textColor={p.error} style={{ alignSelf: 'flex-end', marginTop: 4 }}
      onPress={() => router.push(signInHref(`/campaign/${campaignId}`))}>Sign in to report this campaign</Button>
  }
  async function submit() {
    setBusy(true); setError('')
    try {
      await reportCampaign(campaignId, reason, description)
      setSent(true); setOpen(false); setReason(''); setDescription('')
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not send your report. Please try again.') }
    finally { setBusy(false) }
  }
  return <>
    {sent ? <Text accessibilityRole="alert" style={{ alignSelf: 'flex-end', marginTop: 4, color: p.textSecondary }}>Thank you. Our team will review this campaign.</Text>
      : <Button mode="text" icon="flag-outline" textColor={p.error} style={{ alignSelf: 'flex-end', marginTop: 4 }} onPress={() => { setError(''); setOpen(true) }}>Report Campaign</Button>}
    <Portal><Dialog visible={open} onDismiss={() => { if (!busy) setOpen(false) }}><Dialog.Title>Report campaign</Dialog.Title><Dialog.ScrollArea><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 16, paddingVertical: 16 }}>
      <Text>Reports are reviewed by Ujimora moderators. The campaign creator is not told who reported it. If someone is in immediate danger, contact local emergency services.</Text>
      {!!error && <Text accessibilityRole="alert" style={{ color: p.error }}>{error}</Text>}
      <SelectionField label="Reason" value={reason} onChange={setReason} options={campaignReportOptions} disabled={busy} />
      <BrandedTextInput label="Additional details (optional)" multiline value={description} onChangeText={setDescription} maxLength={CAMPAIGN_REPORT_DETAILS_MAX} disabled={busy} />
    </ScrollView></Dialog.ScrollArea><Dialog.Actions><Button disabled={busy} onPress={() => setOpen(false)}>Cancel</Button><Button disabled={busy || !isCampaignReportReason(reason)} onPress={() => void submit()}>{busy ? 'Sending…' : 'Send report'}</Button></Dialog.Actions></Dialog></Portal>
  </>
}

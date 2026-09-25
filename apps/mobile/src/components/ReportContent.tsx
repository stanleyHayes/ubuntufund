import { useState } from 'react'
import { ScrollView } from 'react-native'
import { Dialog, Portal, Text } from 'react-native-paper'
import { Button } from './Loading'
import { BrandedTextInput } from './BrandedTextInput'
import { SelectionField } from './SelectionField'
import { api } from '@/lib/api'
const reasons = ['harassment', 'hate', 'sexual_content', 'violence', 'child_safety', 'credible_threat', 'fraud', 'spam', 'intellectual_property', 'privacy', 'other']
export function ReportContent({ userId, commentId, updateId, liveSessionId, donationId, tipId, aiOutput }: { userId?: string; commentId?: string; updateId?: string; liveSessionId?: string; donationId?: string; tipId?: string; aiOutput?: { requestId: string; text: string } }) {
  const [open, setOpen] = useState(false), [target, setTarget] = useState(aiOutput ? 'ai_output' : updateId ? 'campaign_update' : donationId ? 'donation_message' : tipId ? 'tip_message' : liveSessionId ? 'live' : commentId ? 'comment' : 'user'), [reason, setReason] = useState('harassment'), [description, setDescription] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [sent, setSent] = useState(false)
  async function submit() {
    setBusy(true); setError('')
    try { await api.post('/safety/reports', { targetType: target, ...(target === 'ai_output' ? { generatedText: aiOutput?.text } : {}), targetId: target === 'ai_output' ? aiOutput?.requestId : target === 'campaign_update' ? updateId : target === 'donation_message' ? donationId : target === 'tip_message' ? tipId : target === 'live' ? liveSessionId : target === 'comment' ? commentId : userId, reason, description }); setSent(true); setOpen(false); setDescription('') }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not send your report. Please try again.') }
    finally { setBusy(false) }
  }
  return <>
    <Button onPress={() => { setOpen(true); setError('') }}>Report</Button>
    {sent && <Text accessibilityRole="alert">Report received for moderation review.</Text>}
    <Portal><Dialog visible={open} onDismiss={() => { if (!busy) setOpen(false) }}><Dialog.Title>Report a safety concern</Dialog.Title><Dialog.ScrollArea><ScrollView contentContainerStyle={{ gap: 16, paddingVertical: 16 }}>
      <Text>Your report and the reported content will be saved for review by Ujimora moderators. Your identity is not shown to the reported user. If someone is in immediate danger, contact local emergency services.</Text>
      {error && <Text accessibilityRole="alert">{error}</Text>}
      {commentId && <SelectionField label="Report about" value={target} onChange={setTarget} options={[{ label: 'This comment', value: 'comment' }, { label: 'This user', value: 'user' }]} />}
      <SelectionField label="Reason" value={reason} onChange={setReason} options={reasons.map(value => ({ value, label: value.replaceAll('_', ' ') }))} />
      <BrandedTextInput label="What happened? (10–2,000 characters)" multiline value={description} onChangeText={setDescription} maxLength={2000} disabled={busy} />
    </ScrollView></Dialog.ScrollArea><Dialog.Actions><Button disabled={busy} onPress={() => setOpen(false)}>Cancel</Button><Button disabled={busy || description.trim().length < 10} onPress={() => void submit()}>{busy ? 'Sending…' : 'Send report'}</Button></Dialog.Actions></Dialog></Portal>
  </>
}

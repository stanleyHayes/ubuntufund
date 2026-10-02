import { useState } from 'react'
import { ScrollView } from 'react-native'
import { Checkbox, Dialog, Portal, Text } from 'react-native-paper'
import { usePalette } from '@/context/ColorModeContext'
import { CAMPAIGN_UPDATE_TYPES, postCampaignUpdate } from '@/lib/campaignUpdates'
import { isPublicationHeld, publishesOnApproval } from '@/lib/publicationDrafts'
import { Button } from './Loading'
import { BrandedTextInput } from './BrandedTextInput'
import { PublicationConsent } from './PublicationConsent'
import { PublicationHeldNotice } from './PublicationHeldNotice'
import { SelectionField } from './SelectionField'

/** Owner-only "Post an update" dialog, mirroring the web CreateUpdateDialog. */
export function CampaignUpdateComposer({ campaignId, onPosted }: { campaignId: string; onPosted: () => void }) {
  const p = usePalette()
  const [open, setOpen] = useState(false)
  const [type, setType] = useState('general')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [isPinned, setIsPinned] = useState(false)
  const [automatedReviewConsent, setAutomatedReviewConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // Held for safety review: shown as a notice. `manual`: the fields are kept to
  // post it again after approval. `automatic`: its approval posts it by itself,
  // so the fields are cleared and the dialog only says so.
  const [held, setHeld] = useState<'' | 'manual' | 'automatic'>('')
  const [posted, setPosted] = useState(false)
  // Nothing more to post: its approval will post it.
  const done = held === 'automatic'
  function clearFields() { setType('general'); setTitle(''); setContent(''); setIsPinned(false); setAutomatedReviewConsent(false) }
  function reset() { clearFields(); setError(''); setHeld('') }
  function close() {
    setOpen(false)
    // The next update starts afresh; a manual hold keeps its fields to post again.
    if (done) setHeld('')
  }
  async function submit() {
    setBusy(true); setError(''); setHeld('')
    try {
      await postCampaignUpdate(campaignId, { title, content, type, isPinned, automatedReviewConsent })
      reset(); setOpen(false); setPosted(true); onPosted()
    } catch (e) {
      if (!isPublicationHeld(e)) setError(e instanceof Error ? e.message : 'Could not post the update. Please try again.')
      // Nothing to post again: the approval posts it, pinned if it was pinned.
      else if (publishesOnApproval(e)) { clearFields(); setHeld('automatic') }
      else setHeld('manual')
    }
    finally { setBusy(false) }
  }
  return <>
    <Button mode="contained-tonal" icon="bullhorn-outline" onPress={() => { setPosted(false); setError(''); setOpen(true) }}>Post an update</Button>
    {posted && <Text accessibilityRole="alert" style={{ color: p.success, marginTop: 6 }}>Update posted.</Text>}
    <Portal><Dialog visible={open} onDismiss={() => { if (!busy) close() }}><Dialog.Title>Post an update</Dialog.Title><Dialog.ScrollArea><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14, paddingVertical: 16 }}>
      {done ? <PublicationHeldNotice publishesOnApproval /> : <>
        <SelectionField label="Update type" value={type} onChange={setType} options={CAMPAIGN_UPDATE_TYPES} disabled={busy} />
        <BrandedTextInput label="Title" value={title} onChangeText={setTitle} maxLength={200} disabled={busy} />
        <BrandedTextInput label="Update" value={content} onChangeText={setContent} maxLength={5000} multiline disabled={busy} />
        <PublicationConsent value={automatedReviewConsent} onChange={setAutomatedReviewConsent} />
        <Checkbox.Item label="Pin this update to the top" status={isPinned ? 'checked' : 'unchecked'} onPress={() => setIsPinned(v => !v)} disabled={busy} />
        {!!error && <Text accessibilityRole="alert" style={{ color: p.error }}>{error}</Text>}
        {held === 'manual' && <PublicationHeldNotice retry="post it again unchanged" />}
      </>}
    </ScrollView></Dialog.ScrollArea><Dialog.Actions>
      <Button disabled={busy} onPress={close}>{done ? 'Close' : 'Cancel'}</Button>
      {!done && <Button disabled={busy || title.trim().length < 3 || !content.trim()} onPress={() => void submit()}>{busy ? 'Posting…' : 'Post update'}</Button>}
    </Dialog.Actions></Dialog></Portal>
  </>
}

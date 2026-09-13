import { ReportContent } from './ReportContent'
import { useEffect, useState } from 'react'
import { Linking, View } from 'react-native'
import { Checkbox, Text } from 'react-native-paper'
import { AiWritingAction, type AiWritingResponse } from '@ubuntu-fund/types'
import { api } from '@/lib/api'
import { SelectionField } from './SelectionField'
import { BrandedTextInput as TextInput } from './BrandedTextInput'
import { Button, Skeleton } from './Loading'
import { usePalette, useNeu } from '@/context/ColorModeContext'

export function AiWritingAssistant({ text, onApply }: { text: string; onApply: (value: string) => void }) {
  const p = usePalette(); const neu = useNeu()
  const [config, setConfig] = useState<{ enabled: boolean; remainingRequests: number } | null>(null)
  const [action, setAction] = useState(AiWritingAction.IMPROVE_CLARITY)
  const [language, setLanguage] = useState('English')
  const [prompt, setPrompt] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [preview, setPreview] = useState<{ original: string; result: string; requestId?: string } | null>(null)
  useEffect(() => { let active = true; api.get<{ enabled: boolean; remainingRequests: number }>('/ai-writing/config').then(v => { if (active) setConfig(v) }).catch(e => { if (active) setError(e.message) }); return () => { active = false } }, [retry])
  async function generate() {
    if (busy || !consent) return
    setBusy(true); setError(''); setPreview(null)
    const original = text
    try {
      const response = await api.post<AiWritingResponse>('/ai-writing', { consentToExternalProcessing: true, text: original || prompt, action, prompt: prompt || undefined, targetLanguage: action === AiWritingAction.TRANSLATE ? language : undefined })
      setPreview({ original, result: response.result, requestId: response.requestId })
      setConfig(c => c ? { ...c, remainingRequests: response.remainingRequests ?? Math.max(0, c.remainingRequests - 1) } : c)
    } catch (e) { setError(e instanceof Error ? e.message : 'Writing assistance failed.') } finally { setBusy(false); setConsent(false) }
  }
  return <View style={{ ...neu.inset, backgroundColor: p.surface, borderRadius: 20, padding: 16, gap: 12 }}>
    <Text variant="titleMedium">Writing assistant</Text>
    {error ? <Text accessibilityRole="alert" style={{ color: p.error }}>{error}</Text> : null}
    {!config && !error && <Skeleton height={64} />}
    {!config && error && <Button onPress={() => { setError(''); setRetry(value => value + 1) }}>Retry connection</Button>}
    {config?.enabled ? <>
      <Text style={{ color: p.textSecondary }}>Your text is sent to OpenAI. Requests and drafts are checked by OpenAI for safety; flagged drafts are withheld. Review any suggestion before applying it. {config.remainingRequests} requests remaining today.</Text>
      <Checkbox.Item label="I agree to send this text and instructions to OpenAI for this suggestion." status={consent ? 'checked' : 'unchecked'} disabled={busy} onPress={() => setConsent(value => !value)} />
      <Text style={{ color: p.textSecondary }}>Optional: you can write without AI. Remove sensitive information and obtain permission before sharing someone else’s details.</Text>
      <Button onPress={() => void Linking.openURL('https://ujimora.com/privacy').catch(() => setError('Could not open the privacy policy.'))}>Privacy policy</Button>
      <SelectionField label="Writing action" value={action} options={Object.values(AiWritingAction).map(value => ({ value, label: value.toLowerCase().replaceAll('_', ' ') }))} onChange={value => setAction(value as AiWritingAction)} />
      <TextInput label="Instructions (optional)" value={prompt} onChangeText={setPrompt} maxLength={1000} />
      {action === AiWritingAction.TRANSLATE && <TextInput label="Target language" value={language} onChangeText={setLanguage} />}
      <Button loading={busy} disabled={!consent || busy || !config.remainingRequests || !(text || prompt).trim() || (text || prompt).length > 12000} onPress={() => void generate()}>Generate preview</Button>
      {preview && <>
        <Text selectable>{preview.result}</Text>
        {preview.requestId && <ReportContent key={preview.requestId} aiOutput={{ requestId: preview.requestId, text: preview.result }} />}
        {preview.original !== text && <Text style={{ color: p.warningText }}>Your story changed. Generate a new preview to keep your latest edits.</Text>}
        <Button mode="contained" disabled={preview.original !== text} onPress={() => { onApply(preview.result); setPreview(null) }}>Apply to story</Button>
        <Button onPress={() => setPreview(null)}>Discard</Button>
      </>}
    </> : config && <Text>Writing assistance is not currently available.</Text>}
  </View>
}

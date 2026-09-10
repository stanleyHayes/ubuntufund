import { CampaignCashout } from '@/components/CampaignCashout'
import { useAuth } from '@/context/AuthContext'
import { SignInRequired } from '@/components/SignInRequired'
import { useEffect, useState } from 'react'
import { View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native'
import { Text, Snackbar, Switch, ProgressBar } from 'react-native-paper'
import { Stack, router } from 'expo-router'
import { CampaignCategory, CampaignPriority, type SubscriptionPlan } from '@ubuntu-fund/types'
import { api } from '@/lib/api'
import { usePalette, useNeu } from '@/context/ColorModeContext'
import { BrandedTextInput as TextInput } from '@/components/BrandedTextInput'
import { BrandedDateField } from '@/components/BrandedDateField'
import { SelectionField } from '@/components/SelectionField'
import { MediaUploadField } from '@/components/MediaUploadField'
import { AiWritingAssistant } from '@/components/AiWritingAssistant'
import { Button, PageSkeleton } from '@/components/Loading'

interface Options { plan: SubscriptionPlan; maxGoal: number | null; canCreate: boolean; canSplit: boolean; splitEnabled: boolean; creationBlockReason?: string }
interface Allocation { name: string; email: string; percent: string }
const labels = ['Basics', 'Story and media', 'Goal and timeline', 'Review']
export default function CreateCampaignScreen() {
  const { user } = useAuth()
  const p = usePalette(); const neu = useNeu()
  const [options, setOptions] = useState<Options | null>(null)
  const [loadError, setLoadError] = useState('')
  const [retry, setRetry] = useState(0)
  const [step, setStep] = useState(0)
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<CampaignCategory>(CampaignCategory.COMMUNITY)
  const [priority, setPriority] = useState<CampaignPriority>(CampaignPriority.NORMAL)
  const [beneficiaries, setBeneficiaries] = useState('')
  const [cover, setCover] = useState('')
  const [amount, setAmount] = useState('')
  const [end, setEnd] = useState('')
  const [invites, setInvites] = useState('')
  const [split, setSplit] = useState(false)
  const [allocations, setAllocations] = useState<Allocation[]>([{ name: '', email: '', percent: '100' }])
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState<{ id: string; status: string } | null>(null)
  const [setupErrors, setSetupErrors] = useState<string[]>([])
  useEffect(() => { if (!user) return; let active = true; setLoadError(''); api.get<Options>('/campaigns/creation-options').then(v => { if (active) setOptions(v) }).catch(e => { if (active) setLoadError(e.message) }); return () => { active = false } }, [retry, user])
  const emails = [...new Set(invites.split(',').map(s => s.trim()).filter(Boolean))]
  function validate(stage: number) {
    if (stage === 0 && (title.trim().length < 5 || summary.trim().length < 10 || summary.length > 140)) return 'Enter a title of at least 5 characters and a summary of 10–140 characters.'
    if (stage === 1 && (description.trim().length < 20 || description.length > 5000 || !beneficiaries.trim())) return 'Enter a story of 20–5,000 characters and name at least one beneficiary.'
    if (stage === 2) {
      if (!Number.isFinite(Number(amount)) || Number(amount) <= 0 || (options?.maxGoal != null && Number(amount) > options.maxGoal)) return 'Enter a positive goal within your current campaign limit.'
      if (!end || Date.parse(end) <= Date.now()) return 'Choose a future end date.'
      if (emails.length && (!options?.plan.campaignCollaboration || emails.some(e => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) || (options.plan.maxCollaboratorsPerCampaign >= 0 && emails.length > options.plan.maxCollaboratorsPerCampaign))) return 'Check collaborator emails and your plan’s collaborator allowance.'
      if (split && (!options?.canSplit || allocations.length < 2 || allocations.length > 50 || allocations.some(a => !a.name.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email) || !/^\d+(\.\d{1,2})?$/.test(a.percent) || Number(a.percent) <= 0) || allocations.reduce((n, a) => n + Math.round(Number(a.percent) * 100), 0) !== 10000)) return 'Add 2–50 split recipients with names, emails and positive shares adding to 100%.'
    }
    return null
  }
  async function submit() {
    for (let i = 0; i < 3; i++) { const issue = validate(i); if (issue) { setStep(i); setError(issue); return } }
    if (!options?.canCreate || created) return
    setBusy(true); setError('')
    try {
      const campaign = await api.post<{ id: string; status: string }>('/campaigns', { title: title.trim(), summary: summary.trim(), description: description.trim(), category, priority, beneficiaries: beneficiaries.split(',').map(s => s.trim()).filter(Boolean), imageUrls: cover ? [cover] : [], goalAmount: Number(amount), currency: 'GHS', endDate: new Date(end).toISOString() })
      setCreated(campaign)
      const failures: string[] = []
      for (const email of emails) { try { await api.post(`/campaigns/${campaign.id}/collaborators/invite`, { userEmail: email, role: 'editor', revenueSharePercent: 0 }) } catch (e) { failures.push(`${email}: ${e instanceof Error ? e.message : 'Invitation failed'}`) } }
      if (split) { try { await api.post(`/campaigns/${campaign.id}/split`, { allocations: allocations.map(a => ({ name: a.name.trim(), email: a.email.trim(), shareBps: Math.round(Number(a.percent) * 100) })) }) } catch (e) { failures.push(`Split draft: ${e instanceof Error ? e.message : 'Could not save'}`) } }
      setSetupErrors(failures)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create campaign.') }
    finally { setBusy(false) }
  }
  const card = { ...neu.raised, backgroundColor: p.surface, borderRadius: 24, padding: 20, gap: 16 }
  if (!user) return <SignInRequired what="campaign creation" />
  if (!options && !loadError) return <PageSkeleton />
  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: p.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <Stack.Screen options={{ title: 'Start a campaign' }} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 60 }}>
      <Text style={{ fontSize: 28, fontFamily: 'Outfit_800ExtraBold', color: p.text }}>Rally your community</Text>
      {created ? <View style={card}><Text variant="titleLarge">Campaign created</Text><Text>Status: {created.status}</Text>{!split && <><Text>Next: set up your payout account for review.</Text><CampaignCashout campaignId={created.id} /></>}{setupErrors.map(e => <Text key={e} style={{ color: p.error }}>{e}</Text>)}{setupErrors.length > 0 && <Text>Your campaign was saved. Complete the remaining invitations or split from campaign management; do not create it again.</Text>}<Button loading={busy} disabled={busy} mode="contained" onPress={() => router.replace(`/campaign/${created.id}`)}>View campaign</Button></View> : loadError ? <View><Text>{loadError}</Text><Button onPress={() => setRetry(n => n + 1)}>Retry</Button></View> : !options?.canCreate ? <View style={card}><Text>{options?.creationBlockReason?.startsWith('verification') ? 'Complete verification before creating another campaign.' : 'Your plan’s active campaign allowance is full.'}</Text><Button onPress={() => router.push(options?.creationBlockReason?.startsWith('verification') ? '/kyc' : '/(tabs)/subscription')}>Review eligibility</Button></View> : <>
        <Text style={{ color: p.textSecondary }}>Step {step + 1} of 4 · {labels[step]}</Text><ProgressBar progress={(step + 1) / 4} color={p.primary} />
        <View style={card}>
          {step === 0 && <><TextInput label="Campaign title" value={title} onChangeText={setTitle} maxLength={200} /><TextInput label="One-line summary" value={summary} onChangeText={setSummary} maxLength={140} /><SelectionField label="Category" value={category} options={Object.values(CampaignCategory).map(value => ({ value, label: value }))} onChange={v => setCategory(v as CampaignCategory)} /></>}
          {step === 1 && <><TextInput label="Your story" value={description} onChangeText={setDescription} multiline maxLength={5000} /><AiWritingAssistant text={description} onApply={setDescription} /><TextInput label="Beneficiaries (comma-separated)" value={beneficiaries} onChangeText={setBeneficiaries} />{options.plan.maxMediaPerCampaign !== 0 && <MediaUploadField label="Campaign cover" folder="campaigns" value={cover} onChange={setCover} crop aspect={[16, 9]} onBusyChange={setUploading} />}</>}
          {step === 2 && <>
            <Text>{options.plan.name} · {options.maxGoal === null ? 'No plan goal ceiling' : `Current goal limit: GH₵${options.maxGoal.toLocaleString()}`}</Text><Text>Account compliance limits may be lower than plan limits. Upgrading does not override a compliance cap.</Text>
            <TextInput label="Goal (GHS)" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} /><BrandedDateField label="Campaign end date" value={end} onChange={setEnd} />
            <SelectionField label="Urgency" value={priority} options={Object.values(CampaignPriority).map(value => ({ value, label: value }))} onChange={v => setPriority(v as CampaignPriority)} />
            {options.plan.campaignCollaboration && <TextInput label="Invite collaborators (emails, comma-separated)" value={invites} onChangeText={setInvites} autoCapitalize="none" />}
            {options.canSplit && <><Text>Share campaign proceeds between beneficiaries</Text><Switch value={split} onValueChange={setSplit} /></>}
            {split && allocations.map((a, i) => <View key={i} style={{ gap: 8 }}><Text>Beneficiary {i + 1}</Text>{(['name', 'email', 'percent'] as const).map(key => <TextInput key={key} label={key === 'percent' ? 'Share (%)' : key} value={a[key]} keyboardType={key === 'percent' ? 'decimal-pad' : key === 'email' ? 'email-address' : 'default'} onChangeText={v => setAllocations(rows => rows.map((row, index) => index === i ? { ...row, [key]: v } : row))} />)}<Button onPress={() => setAllocations(rows => rows.filter((_, index) => index !== i))}>Remove recipient</Button></View>)}
            {split && <Button onPress={() => setAllocations(rows => [...rows, { name: '', email: '', percent: '' }])}>Add recipient</Button>}
          </>}
          {step === 3 && <><Text variant="titleLarge">{title}</Text><Text>{summary}</Text><Text>{description}</Text><Text>Goal: GH₵{amount} · Ends {end}</Text><Text>Category: {category} · Urgency: {priority}</Text><Text>Beneficiaries: {beneficiaries}</Text><Text>Review everything before submitting. Your campaign follows the platform review process.</Text></>}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>{step > 0 && <Button disabled={busy || uploading} onPress={() => setStep(s => s - 1)}>Back</Button>}<Button mode="contained" loading={busy} disabled={busy || uploading} onPress={step === 3 ? () => void submit() : () => { const issue = validate(step); if (issue) setError(issue); else { setError(''); setStep(s => s + 1) } }}>{step === 3 ? 'Create campaign' : 'Continue'}</Button></View>
      </>}
    </ScrollView><Snackbar visible={!!error} duration={Infinity} onDismiss={() => setError('')} action={{ label: 'Dismiss', onPress: () => setError('') }}>{error}</Snackbar>
  </KeyboardAvoidingView>
}

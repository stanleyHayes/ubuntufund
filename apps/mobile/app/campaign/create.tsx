import { PublicationConsent } from '../../src/components/PublicationConsent'
import { PublicationReviews } from '../../src/components/PublicationReviews'
import { CampaignCashout } from '@/components/CampaignCashout'
import { useAuth } from '@/context/AuthContext'
import { SignInRequired } from '@/components/SignInRequired'
import { useEffect, useRef, useState } from 'react'
import { View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native'
import { Text, Snackbar, Switch, ProgressBar } from 'react-native-paper'
import { Stack, router } from 'expo-router'
import { CampaignCategory, CampaignPriority, type SubscriptionPlan } from '@ubuntu-fund/types'
import { api } from '@/lib/api'
import { clearCampaignDraft, loadCampaignDraft, saveCampaignDraft } from '@/lib/publicationDrafts'
import { creationRequestKey } from '@/lib/campaignCreationKey'
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
  return <CampaignFormForViewer key={user?.id ?? 'guest'} />
}
function CampaignFormForViewer() {
  const live = useRef(true)
  useEffect(() => { live.current = true; return () => { live.current = false } }, [])
  const { user } = useAuth()
  const p = usePalette(); const neu = useNeu()
  const [options, setOptions] = useState<Options | null>(null)
  const [loadError, setLoadError] = useState('')
  const [retry, setRetry] = useState(0)
  const [step, setStep] = useState(0)
  const [automatedReviewConsent, setAutomatedReviewConsent] = useState(false)
  const [title, setTitle] = useState('')
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
  const [draftRestored, setDraftRestored] = useState(false)
  const [draftLoaded, setDraftLoaded] = useState(false)
  const creationKey = useRef<{ payload: string; key: string } | null>(null)
  // Restore the unsent version once, then keep saving it, so a held campaign
  // can be resubmitted unchanged after approval even if the app was closed.
  useEffect(() => {
    if (!user) return
    let active = true
    void loadCampaignDraft(user.id).then(draft => {
      if (!active) return
      if (draft) {
        setTitle(draft.title); setDescription(draft.description); setBeneficiaries(draft.beneficiaries)
        setCover(draft.cover); setAmount(draft.amount); setEnd(draft.end)
        if ((Object.values(CampaignCategory) as string[]).includes(draft.category)) setCategory(draft.category as CampaignCategory)
        if ((Object.values(CampaignPriority) as string[]).includes(draft.priority)) setPriority(draft.priority as CampaignPriority)
        setDraftRestored(true)
      }
      setDraftLoaded(true)
    })
    return () => { active = false }
  }, [user])
  useEffect(() => {
    if (!user || !draftLoaded || created) return
    const draft = { title, description, category, priority, beneficiaries, cover, amount, end }
    if (![title, description, beneficiaries, cover, amount, end].some(Boolean)) void clearCampaignDraft(user.id)
    else void saveCampaignDraft(user.id, draft)
  }, [user, draftLoaded, created, title, description, category, priority, beneficiaries, cover, amount, end])
  function discardDraft() {
    setTitle(''); setDescription(''); setBeneficiaries(''); setCover(''); setAmount(''); setEnd('')
    setCategory(CampaignCategory.COMMUNITY); setPriority(CampaignPriority.NORMAL); setStep(0); setDraftRestored(false)
  }
  useEffect(() => { if (!user) return; let active = true; setLoadError(''); api.get<Options>('/campaigns/creation-options').then(v => { if (active) setOptions(v) }).catch(e => { if (active) setLoadError(e.message) }); return () => { active = false } }, [retry, user])
  const emails = [...new Set(invites.split(',').map(s => s.trim()).filter(Boolean))]
  function validate(stage: number) {
    // No separate summary: the API has no field for it, so it was silently dropped.
    if (stage === 0 && title.trim().length < 5) return 'Enter a title of at least 5 characters.'
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
      const payload = { title: title.trim(), description: description.trim(), category, priority, beneficiaries: beneficiaries.split(',').map(s => s.trim()).filter(Boolean), imageUrls: cover ? [cover] : [], goalAmount: Number(amount), currency: 'GHS', endDate: new Date(end).toISOString() }
      // Same version, same key: a retry after a lost response cannot create a duplicate.
      creationKey.current = creationRequestKey(creationKey.current, payload)
      const campaign = await api.post<{ id: string; status: string }>('/campaigns', { automatedReviewConsent, ...payload }, { 'Idempotency-Key': creationKey.current.key })
      if (!live.current) return
      if (user) void clearCampaignDraft(user.id)
      setCreated(campaign)
      const failures: string[] = []
      for (const email of emails) { if (!live.current) return; try { await api.post(`/campaigns/${campaign.id}/collaborators/invite`, { userEmail: email, role: 'editor', revenueSharePercent: 0 }) } catch (e) { failures.push(`${email}: ${e instanceof Error ? e.message : 'Invitation failed'}`) } }
      if (!live.current) return
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
        {draftRestored && <View style={card}><Text>We restored your unsent draft from this device. If it is waiting for safety review, submit this same version again once it is approved.</Text><Button onPress={discardDraft}>Start over</Button></View>}
        <Text style={{ color: p.textSecondary }}>Step {step + 1} of 4 · {labels[step]}</Text><ProgressBar progress={(step + 1) / 4} color={p.primary} />
        <View style={card}>
          {step === 0 && <><TextInput label="Campaign title" value={title} onChangeText={setTitle} maxLength={200} /><SelectionField label="Category" value={category} options={Object.values(CampaignCategory).map(value => ({ value, label: value }))} onChange={v => setCategory(v as CampaignCategory)} /></>}
          {step === 1 && <><TextInput label="Your story" value={description} onChangeText={setDescription} multiline maxLength={5000} /><AiWritingAssistant text={description} onApply={setDescription} /><TextInput label="Beneficiaries (comma-separated)" value={beneficiaries} onChangeText={setBeneficiaries} />{options.plan.maxMediaPerCampaign !== 0 && <MediaUploadField label="Campaign cover" folder="campaigns" value={cover} onChange={setCover} crop aspect={[16, 9]} onBusyChange={setUploading} />}</>}
          {step === 2 && <>
            <Text>Goals above GHS 250,000 need staff approval unless you have current approved identity verification (business verification for organizations) and an earlier published campaign. Plan, compliance and content-safety checks still apply.</Text>
            <Text>{options.plan.name} · {options.maxGoal === null ? 'No plan goal ceiling' : `Current goal limit: GH₵${options.maxGoal.toLocaleString()}`}</Text><Text>Account compliance limits may be lower than plan limits. Upgrading does not override a compliance cap.</Text>
            <TextInput label="Goal (GHS)" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} /><BrandedDateField label="Campaign end date" value={end} onChange={setEnd} />
            <SelectionField label="Urgency" value={priority} options={Object.values(CampaignPriority).map(value => ({ value, label: value }))} onChange={v => setPriority(v as CampaignPriority)} />
            {options.plan.campaignCollaboration && <TextInput label="Invite collaborators (emails, comma-separated)" value={invites} onChangeText={setInvites} autoCapitalize="none" />}
            {options.canSplit && <><Text>Share campaign proceeds between beneficiaries</Text><Switch value={split} onValueChange={setSplit} /></>}
            {split && allocations.map((a, i) => <View key={i} style={{ gap: 8 }}><Text>Beneficiary {i + 1}</Text>{(['name', 'email', 'percent'] as const).map(key => <TextInput key={key} label={key === 'percent' ? 'Share (%)' : key} value={a[key]} keyboardType={key === 'percent' ? 'decimal-pad' : key === 'email' ? 'email-address' : 'default'} onChangeText={v => setAllocations(rows => rows.map((row, index) => index === i ? { ...row, [key]: v } : row))} />)}<Button onPress={() => setAllocations(rows => rows.filter((_, index) => index !== i))}>Remove recipient</Button></View>)}
            {split && <Button onPress={() => setAllocations(rows => [...rows, { name: '', email: '', percent: '' }])}>Add recipient</Button>}
          </>}
          {step === 3 && <><Text variant="titleLarge">{title}</Text><Text>{description}</Text><Text>Goal: GH₵{amount} · Ends {end}</Text><Text>Category: {category} · Urgency: {priority}</Text><Text>Beneficiaries: {beneficiaries}</Text><Text>Safety checks and financial approval apply separately. Goals above GH₵250,000 need staff financial approval unless you are currently verified and have a previous published campaign.</Text><PublicationConsent value={automatedReviewConsent} onChange={setAutomatedReviewConsent} />{error && <PublicationReviews />}</>}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>{step > 0 && <Button disabled={busy || uploading} onPress={() => setStep(s => s - 1)}>Back</Button>}<Button mode="contained" loading={busy} disabled={busy || uploading} onPress={step === 3 ? () => void submit() : () => { const issue = validate(step); if (issue) setError(issue); else { setError(''); setStep(s => s + 1) } }}>{step === 3 ? 'Create campaign' : 'Continue'}</Button></View>
      </>}
    </ScrollView><Snackbar visible={!!error} duration={Infinity} onDismiss={() => setError('')} action={{ label: 'Dismiss', onPress: () => setError('') }}>{error}</Snackbar>
  </KeyboardAvoidingView>
}

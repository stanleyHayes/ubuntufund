import { BrandedTextInput as TextInput } from '@/components/BrandedTextInput'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { View, ScrollView, StyleSheet, ActivityIndicator, Share, useWindowDimensions } from 'react-native'
import { Text, Button, Switch, Portal, Dialog, Chip, SegmentedButtons, Snackbar } from 'react-native-paper'
import { Stack, router } from 'expo-router'
import {
  getMyCreator, saveCreatorProfile, requestWithdrawal, listMyPayouts,
  type CreatorProfile, type CreatorBalance, type CreatorPayout, type CreatorPolicy,
} from '@/lib/creators'
import { usePalette, useNeu } from '@/context/ColorModeContext'
import type { Palette, NeuRecipes } from '@/theme'

const WEB_BASE = process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, '') || 'https://app.ujimora.com'

function makeStyles(p: Palette, neu: NeuRecipes) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: p.background },
    content: { padding: 16, paddingBottom: 48 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    card: { ...neu.raised, backgroundColor: p.surface, borderRadius: 14, padding: 18, gap: 12, marginBottom: 16 },
    title: { fontSize: 20, fontFamily: 'Outfit_700Bold', color: p.text, marginBottom: 12 },
    cardTitle: { fontSize: 16, fontFamily: 'Outfit_700Bold', color: p.text },
    lbl: { fontSize: 11, fontFamily: 'Outfit_400Regular', color: p.textSecondary, textTransform: 'uppercase' },
    big: { fontSize: 30, fontFamily: 'Outfit_700Bold', color: p.primary },
    sub: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: p.textSecondary },
    linkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: p.skeleton, borderRadius: 10, padding: 10, marginTop: 8 },
    link: { flex: 1, fontSize: 13, fontFamily: 'Outfit_400Regular', color: p.text },
    switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    payoutRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', ...neu.subtle, backgroundColor: p.surface, borderRadius: 10, padding: 12, marginBottom: 8 },
    err: { color: p.error, fontFamily: 'Outfit_400Regular', fontSize: 13 },
  })
}

export default function CreatorDashboardScreen() {
  const { height } = useWindowDimensions()
  const p = usePalette()
  const neu = useNeu()
  const styles = useMemo(() => makeStyles(p, neu), [p, neu])

  const [loading, setLoading] = useState(true)
  const [policy, setPolicy] = useState<CreatorPolicy | null>(null)
  const [profile, setProfile] = useState<CreatorProfile | null>(null)
  const [balance, setBalance] = useState<CreatorBalance | null>(null)
  const [payouts, setPayouts] = useState<CreatorPayout[]>([])

  const [handle, setHandle] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [tagline, setTagline] = useState('')
  const [bio, setBio] = useState('')
  const [tipsEnabled, setTipsEnabled] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [snack, setSnack] = useState('')

  const [wOpen, setWOpen] = useState(false)
  const [wAmount, setWAmount] = useState('0')
  const [wType, setWType] = useState('mobile_money')
  const [wAccount, setWAccount] = useState('')
  const [wBank, setWBank] = useState('')
  const [wName, setWName] = useState('')
  const [wSubmitting, setWSubmitting] = useState(false)
  const [wError, setWError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      // getMyCreator returns { profile: null } for a genuine first-time creator,
      // so a thrown error here is a REAL failure (5xx, network, expired session) —
      // surface it instead of showing an empty claim form.
      const me = await getMyCreator()
      setPolicy(me.policy); setProfile(me.profile); setBalance(me.balance)
      if (me.profile) {
        setHandle(me.profile.handle); setDisplayName(me.profile.displayName)
        setTagline(me.profile.tagline ?? ''); setBio(me.profile.bio ?? ''); setTipsEnabled(me.profile.tipsEnabled)
        setPayouts(await listMyPayouts())
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'We couldn’t load your creator page.')
    }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  async function save() {
    setError(null); setSaving(true)
    try {
      await saveCreatorProfile({ handle, displayName, tagline, bio, tipsEnabled })
      setSnack('Your creator page is saved'); await load()
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save.') }
    finally { setSaving(false) }
  }

  async function withdraw() {
    if (!policy) return
    setWError(null); setWSubmitting(true)
    try {
      await requestWithdrawal({ amount: Number(wAmount), expectedFeePercent: policy.feePercent, recipient: { type: wType as 'mobile_money' | 'ghipss', accountNumber: wAccount, bankCode: wBank, accountName: wName || displayName } })
      setWOpen(false); setSnack('Withdrawal started'); await load()
    } catch (err) { setWError(err instanceof Error ? err.message : 'Could not start the withdrawal.') }
    finally { setWSubmitting(false) }
  }

  const fmt = (n: number) => `GH₵${(n ?? 0).toLocaleString()}`
  const pageUrl = profile ? `${WEB_BASE}/creators/${profile.handle}` : ''

  if (loading) return <View style={styles.center}><ActivityIndicator color={p.primary} /></View>

  if (loadError) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Creator page' }} />
        <View style={styles.center}>
          <Text style={[styles.err, { textAlign: 'center', marginBottom: 12 }]}>{loadError}</Text>
          <Button mode="contained" onPress={() => void load()} labelStyle={{ fontFamily: 'Outfit_700Bold' }}>Try again</Button>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Creator page' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Your creator page</Text>

        {profile && balance && (
          <View style={styles.card}>
            <Text style={styles.lbl}>Available to withdraw</Text>
            <Text style={styles.big}>{fmt(balance.availableBalance)}</Text>
            <Text style={styles.sub}>Received {fmt(balance.totalReceived)} · Withdrawn {fmt(balance.paidOutBalance)}</Text>
            <Button mode="contained" disabled={balance.availableBalance <= 0} onPress={() => { setWAmount(String(balance.availableBalance)); setWOpen(true) }} labelStyle={{ fontFamily: 'Outfit_700Bold' }}>
              Withdraw
            </Button>
            <View style={styles.linkRow}>
              <Text style={styles.link} numberOfLines={1}>{pageUrl}</Text>
              <Button compact mode="text" onPress={() => Share.share({ message: pageUrl })}>Share</Button>
            </View>
          </View>
        )}

        {!policy?.eligible && <View style={styles.card}>
          <Text style={styles.cardTitle}>Unlock creator donations</Text>
          <Text style={styles.sub}>An active paid plan is required to receive new tips. You can still withdraw your existing balance.</Text>
          <Button onPress={() => router.push('/(tabs)/subscription')}>View plans</Button>
        </View>}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{profile ? 'Edit your page' : 'Claim your page'}</Text>
          <TextInput label="Handle (your link)" value={handle} onChangeText={(t) => setHandle(t.toLowerCase())} autoCapitalize="none" disabled={!!profile || !policy?.eligible} />
          <TextInput disabled={!policy?.eligible} label="Display name" value={displayName} onChangeText={setDisplayName} />
          <TextInput disabled={!policy?.eligible} label="Tagline" value={tagline} onChangeText={setTagline} />
          <TextInput disabled={!policy?.eligible} label="About you" value={bio} onChangeText={setBio} multiline />
          <View style={styles.switchRow}>
            <Text style={styles.sub}>Accept tips</Text>
            <Switch disabled={!policy?.eligible} value={!!policy?.eligible && tipsEnabled} onValueChange={setTipsEnabled} />
          </View>
          {error ? <Text style={styles.err}>{error}</Text> : null}
          <Button mode="contained" loading={saving} disabled={saving || !policy?.eligible} onPress={save} labelStyle={{ fontFamily: 'Outfit_700Bold' }}>
            {profile ? 'Save changes' : 'Create my page'}
          </Button>
        </View>

        {payouts.length > 0 && (
          <View>
            <Text style={styles.cardTitle}>Withdrawals</Text>
            {payouts.map((po) => (
              <View key={po.id} style={styles.payoutRow}>
                <View style={{ flex: 1 }}><Text style={{ fontFamily: 'Outfit_700Bold', color: p.text }}>{fmt(po.amount)}</Text><Text style={styles.sub}>Fee {fmt(po.fee ?? 0)} · Net {fmt(po.netAmount ?? po.amount)}</Text></View>
                <Chip compact>{po.status}</Chip>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <Portal>
        <Dialog visible={wOpen} onDismiss={() => setWOpen(false)}>
          <Dialog.Title>Withdraw funds</Dialog.Title>
          <Dialog.ScrollArea style={{ maxHeight: height * 0.6, paddingHorizontal: 0 }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12, padding: 24 }}>
            <TextInput label="Amount" keyboardType="numeric" value={wAmount} onChangeText={setWAmount} />
            <SegmentedButtons value={wType} onValueChange={setWType} buttons={[{ value: 'mobile_money', label: 'Mobile money' }, { value: 'ghipss', label: 'Bank' }]} />
            <TextInput label={wType === 'mobile_money' ? 'Phone number' : 'Account number'} value={wAccount} onChangeText={setWAccount} />
            <TextInput label={wType === 'mobile_money' ? 'Network (e.g. MTN)' : 'Bank code'} value={wBank} onChangeText={setWBank} />
            <TextInput label="Account name" value={wName} onChangeText={setWName} placeholder={displayName} />
            {policy && <Text style={styles.sub}>{policy.planName} transfer fee: {policy.feePercent}%. Fee: {fmt(Math.round(Number(wAmount) * policy.feePercent) / 100)} · You receive: {fmt(Math.round((Number(wAmount) - Math.round(Number(wAmount) * policy.feePercent) / 100) * 100) / 100)}. The full requested amount is deducted from your creator balance.</Text>}
            {wError ? <Text style={styles.err}>{wError}</Text> : null}
          </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setWOpen(false)}>Cancel</Button>
            <Button mode="contained" loading={wSubmitting} disabled={wSubmitting || !policy || !Number.isFinite(Number(wAmount)) || Number(wAmount) <= 0} onPress={withdraw}>Withdraw</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar visible={!!snack} onDismiss={() => setSnack('')} duration={2200}>{snack}</Snackbar>
    </View>
  )
}

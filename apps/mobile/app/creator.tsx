import { useAuth } from '@/context/AuthContext'
import { PublicationConsent } from '@/components/PublicationConsent'
import { PublicationReviews } from '@/components/PublicationReviews'
import { PublicationHeldNotice } from '@/components/PublicationHeldNotice'
import { isPublicationHeld } from '@/lib/publicationDrafts'
import { payoutInstitutionName } from '@ubuntu-fund/types'
import { randomUUID } from 'expo-crypto'
import { SegmentedButtons } from '@/components/RoundedControls'
import { api } from '@/lib/api'
import { parseMoneyInput } from '@/lib/moneyInput'
import { SelectionField } from '@/components/SelectionField'
import type { SavedAccount } from '@/components/SavedPayoutAccounts'
import { Chip } from '@/components/Chip'
import { SkeletonLoader, Button } from '@/components/Loading'
import { BrandedTextInput as TextInput } from '@/components/BrandedTextInput'
import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { View, ScrollView, StyleSheet, Share, useWindowDimensions, Image } from 'react-native'
import { Text, Switch, Portal, Dialog, Snackbar } from 'react-native-paper'
import { Stack, router } from 'expo-router'
import {
  getMyCreator,
  saveCreatorProfile,
  requestWithdrawal,
  listMyPayouts,
  type CreatorProfile,
  type CreatorBalance,
  type CreatorPayout,
  type CreatorPolicy,
} from '@/lib/creators'
import { usePalette, useNeu } from '@/context/ColorModeContext'
import type { Palette, NeuRecipes } from '@/theme'
import { KeyboardAvoider } from '@/components/KeyboardAvoider'

const WEB_BASE = process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, '') || 'https://app.ujimora.com'

function makeStyles(p: Palette, neu: NeuRecipes) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: p.background },
    content: { padding: 16, paddingBottom: 48 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    card: {
      ...neu.raised,
      backgroundColor: p.surface,
      borderRadius: 14,
      padding: 18,
      gap: 12,
      marginBottom: 16,
    },
    title: { fontSize: 20, fontFamily: 'Outfit_700Bold', color: p.text, marginBottom: 12 },
    cardTitle: { fontSize: 16, fontFamily: 'Outfit_700Bold', color: p.text },
    lbl: {
      fontSize: 11,
      fontFamily: 'Outfit_400Regular',
      color: p.textSecondary,
      textTransform: 'uppercase',
    },
    big: { fontSize: 30, fontFamily: 'Outfit_700Bold', color: p.primary },
    sub: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: p.textSecondary },
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: p.skeleton,
      borderRadius: 10,
      padding: 10,
      marginTop: 8,
    },
    link: { flex: 1, fontSize: 13, fontFamily: 'Outfit_400Regular', color: p.text },
    switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    payoutRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      ...neu.subtle,
      backgroundColor: p.surface,
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
    },
    err: { color: p.error, fontFamily: 'Outfit_400Regular', fontSize: 13 },
  })
}

export default function CreatorDashboardScreen() {
  const { user } = useAuth()
  return <CreatorDashboardForViewer key={user?.id ?? 'guest'} />
}
function CreatorDashboardForViewer() {
  const live = useRef(true)
  useEffect(() => { live.current = true; return () => { live.current = false } }, [])
  const { height } = useWindowDimensions()
  const p = usePalette()
  const neu = useNeu()
  const styles = useMemo(() => makeStyles(p, neu), [p, neu])

  const [loading, setLoading] = useState(true)
  const [policy, setPolicy] = useState<CreatorPolicy | null>(null)
  const [profile, setProfile] = useState<CreatorProfile | null>(null)
  const [balance, setBalance] = useState<CreatorBalance | null>(null)
  const [payouts, setPayouts] = useState<CreatorPayout[]>([])

  const [accounts, setAccounts] = useState<SavedAccount[]>([])
  const [savedAccountId, setSavedAccountId] = useState('')
  useEffect(() => {
    let active = true
    api
      .get<{ accounts: SavedAccount[] }>('/payout-accounts')
      .then((d) => {
        if (active) setAccounts(d.accounts)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])
  const [handle, setHandle] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [automatedReviewConsent, setAutomatedReviewConsent] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(''), [coverUrl, setCoverUrl] = useState('')
  const [tagline, setTagline] = useState('')
  const [bio, setBio] = useState('')
  const [tipsEnabled, setTipsEnabled] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The page changes were held for safety review: a notice, not an error.
  const [held, setHeld] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [snack, setSnack] = useState('')

  const [destination, setDestination] = useState('paystack')
  const requestKey = useRef({ details: '', key: '' })
  const [wOpen, setWOpen] = useState(false)
  const [wAmount, setWAmount] = useState('0')
  // At most 2 decimals; a decimal comma ("100,50") is accepted, not NaN.
  const wValue = parseMoneyInput(wAmount)
  const [wType, setWType] = useState('mobile_money')
  const [wAccount, setWAccount] = useState('')
  const [wBank, setWBank] = useState('')
  const [wName, setWName] = useState('')
  const [wSubmitting, setWSubmitting] = useState(false)
  const [wError, setWError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!live.current) return
    setLoading(true)
    setLoadError(null)
    try {
      // getMyCreator returns { profile: null } for a genuine first-time creator,
      // so a thrown error here is a REAL failure (5xx, network, expired session) —
      // surface it instead of showing an empty claim form.
      const me = await getMyCreator()
      if (!live.current) return
      setPolicy(me.policy)
      setProfile(me.profile)
      setBalance(me.balance)
      if (me.profile) {
        setHandle(me.profile.handle)
        setDisplayName(me.profile.displayName)
        setTagline(me.profile.tagline ?? '')
        setBio(me.profile.bio ?? '')
        setAvatarUrl(me.profile.avatarUrl ?? '')
        setCoverUrl(me.profile.coverUrl ?? '')
        setTipsEnabled(me.profile.tipsEnabled)
        const payouts = await listMyPayouts()
        if (live.current) setPayouts(payouts)
      }
    } catch (err) {
      if (!live.current) return
      setLoadError(err instanceof Error ? err.message : 'We couldn’t load your creator page.')
    } finally {
      if (live.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function save() {
    setError(null)
    setHeld(false)
    setSaving(true)
    try {
      await saveCreatorProfile({ handle, displayName, tagline, bio, avatarUrl, coverUrl, tipsEnabled, automatedReviewConsent })
      if (!live.current) return
      setSnack('Your creator page is saved')
      await load()
    } catch (err) {
      if (!live.current) return
      if (isPublicationHeld(err)) setHeld(true)
      else setError(err instanceof Error ? err.message : 'Could not save.')
    } finally {
      if (live.current) setSaving(false)
    }
  }

  async function pauseTips() {
    setSaving(true); setError(null); setHeld(false)
    try {
      await api.post('/creators/profile', { tipsEnabled: false })
      if (live.current) { setTipsEnabled(false); setProfile(previous => previous ? { ...previous, tipsEnabled: false } : previous); setSnack('Tips paused. Your other draft changes are retained.') }
    } catch (cause) { if (live.current) setError(cause instanceof Error ? cause.message : 'Could not pause tips.') }
    finally { if (live.current) setSaving(false) }
  }
  async function selectAccountImages() {
    setError(null)
    try {
      const images = await api.get<{ avatarUrl?: string; coverUrl?: string }>('/profile')
      if (live.current) { setAvatarUrl(images.avatarUrl ?? ''); setCoverUrl(images.coverUrl ?? ''); setSnack('Account images selected. Save your creator page to submit them for review.') }
    } catch { if (live.current) setError('Could not load account images.') }
  }

  async function withdraw() {
    if (!policy) return
    setWError(null)
    setWSubmitting(true)
    try {
      const details = JSON.stringify({
        amount: wValue,
        destination,
        fee: policy.feePercent,
      })
      if (requestKey.current.details !== details)
        requestKey.current = { details, key: randomUUID() }
      await requestWithdrawal({
        amount: wValue,
        expectedFeePercent: policy.feePercent,
        // Both rails need the key: the bank rail has no other way to tell a
        // retry from a second intentional withdrawal.
        idempotencyKey: requestKey.current.key,
        ...(destination === 'ujimora_wallet'
          ? { destination: 'ujimora_wallet' }
          : savedAccountId
            ? { savedAccountId }
            : {
                recipient: {
                  type: wType as 'mobile_money' | 'ghipss',
                  accountNumber: wAccount,
                  bankCode: wBank,
                  accountName: wName || displayName,
                },
              }),
      })
      setWOpen(false)
      setSnack(
        destination === 'ujimora_wallet'
          ? 'Funds added to your Ujimora Wallet'
          : 'Withdrawal started',
      )
      requestKey.current = { details: '', key: '' }
      await load()
    } catch (err) {
      setWError(err instanceof Error ? err.message : 'Could not start the withdrawal.')
    } finally {
      setWSubmitting(false)
    }
  }

  const fmt = (n: number) => `GH₵${(n ?? 0).toLocaleString()}`
  const pageUrl = profile ? `${WEB_BASE}/creators/${profile.handle}` : ''

  if (loading)
    return (
      <View style={styles.center}>
        <SkeletonLoader color={p.primary} />
      </View>
    )

  if (loadError) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Creator page' }} />
        <View style={styles.center}>
          <Text style={[styles.err, { textAlign: 'center', marginBottom: 12 }]}>{loadError}</Text>
          <Button
            mode="contained"
            onPress={() => void load()}
            labelStyle={{ fontFamily: 'Outfit_700Bold' }}
          >
            Try again
          </Button>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Creator page' }} />
      <KeyboardAvoider>
      <ScrollView automaticallyAdjustKeyboardInsets contentContainerStyle={styles.content}>
        <Text style={styles.title}>Your creator page</Text>

        {profile && balance && (
          <View style={styles.card}>
            <Text style={styles.lbl}>Available to withdraw</Text>
            <Text style={styles.big}>{fmt(balance.availableBalance)}</Text>
            <Text style={styles.sub}>
              Received {fmt(balance.totalReceived)} · Withdrawn {fmt(balance.paidOutBalance)}
            </Text>
            <Button
              mode="contained"
              disabled={balance.availableBalance <= 0}
              onPress={() => {
                setWAmount(String(balance.availableBalance))
                setWOpen(true)
              }}
              labelStyle={{ fontFamily: 'Outfit_700Bold' }}
            >
              Withdraw
            </Button>
            <View style={styles.linkRow}>
              <Text style={styles.link}>{pageUrl}</Text>
              <Button compact mode="text" onPress={() => Share.share({ message: pageUrl })}>
                Share
              </Button>
            </View>
            <Button onPress={() => router.push(`/creators/${profile.handle}`)}>
              Preview public page
            </Button>
            <Text style={styles.sub}>
              Visitors see your profile and support form. Balance, payout details and editing
              controls stay private.
            </Text>
          </View>
        )}

        {!policy?.eligible && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Unlock creator donations</Text>
            <Text style={styles.sub}>
              An active paid plan is required to receive new tips. You can still withdraw your
              existing balance.
            </Text>
            <Button onPress={() => router.push('/(tabs)/subscription')}>View plans</Button>
          </View>
        )}

        <View style={styles.card}>
          <Button onPress={() => router.push('/profile/edit')}>Manage account images</Button>
          <Button disabled={saving} onPress={() => void selectAccountImages()}>Use account photo and cover</Button>
          {(avatarUrl || coverUrl) && <View style={{ flexDirection: 'row', gap: 8 }}>{[avatarUrl, coverUrl].map((url, index) => url && <Image key={`${index}:${url}`} source={{ uri: url }} accessibilityLabel={index === 0 ? 'Selected creator photo' : 'Selected creator cover'} style={{ width: 80, height: 64, borderRadius: 8 }} />)}<Button onPress={() => { setAvatarUrl(''); setCoverUrl('') }}>Clear images</Button></View>}
          <Text style={styles.cardTitle}>{profile ? 'Edit your page' : 'Claim your page'}</Text>
          <TextInput
            label="Handle (your link)"
            value={handle}
            onChangeText={(t) => setHandle(t.toLowerCase())}
            autoCapitalize="none"
            editable={!profile && !!policy?.eligible}
            disabled={!policy?.eligible}
          />
          <TextInput
            disabled={!policy?.eligible}
            label="Display name"
            value={displayName}
            onChangeText={setDisplayName}
          />
          <TextInput
            disabled={!policy?.eligible}
            label="Tagline"
            value={tagline}
            onChangeText={setTagline}
          />
          <TextInput
            disabled={!policy?.eligible}
            label="About you"
            value={bio}
            onChangeText={setBio}
            multiline
          />
          <View style={styles.switchRow}>
            <Text style={styles.sub}>Accept tips</Text>
            <Switch
              disabled={!policy?.eligible}
              value={!!policy?.eligible && tipsEnabled}
              onValueChange={setTipsEnabled}
            />
          </View>
          <PublicationConsent value={automatedReviewConsent} onChange={setAutomatedReviewConsent} />
          {error ? <><Text style={styles.err}>{error}</Text><PublicationReviews /></> : null}
          {held ? <><PublicationHeldNotice retry="save it again unchanged" reviews="below" /><PublicationReviews /></> : null}
          {profile?.tipsEnabled && <Button disabled={saving} onPress={() => void pauseTips()}>Pause tips now</Button>}
          <Button
            mode="contained"
            loading={saving}
            disabled={saving || !policy?.eligible}
            onPress={save}
            labelStyle={{ fontFamily: 'Outfit_700Bold' }}
          >
            {profile ? 'Save changes' : 'Create my page'}
          </Button>
        </View>

        {payouts.length > 0 && (
          <View>
            <Text style={styles.cardTitle}>Withdrawals</Text>
            {payouts.map((po) => (
              <View key={po.id} style={styles.payoutRow}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'Outfit_700Bold', color: p.text }}>
                    {fmt(po.amount)}
                  </Text>
                  <Text style={styles.sub}>
                    Fee {fmt(po.fee ?? 0)} · Net {fmt(po.netAmount ?? po.amount)}
                  </Text>
                </View>
                <Chip compact>{po.status}</Chip>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
      </KeyboardAvoider>

      <Portal>
        <Dialog visible={wOpen} onDismiss={() => setWOpen(false)}>
          <Dialog.Title>Withdraw funds</Dialog.Title>
          <Dialog.ScrollArea style={{ maxHeight: height * 0.6, paddingHorizontal: 0 }}>
            <ScrollView
              automaticallyAdjustKeyboardInsets
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 12, padding: 24 }}
            >
              <TextInput
                label="Amount"
                keyboardType="numeric"
                value={wAmount}
                onChangeText={setWAmount}
              />
              <SelectionField
                label="Receive funds in"
                value={destination}
                onChange={setDestination}
                options={[
                  { value: 'paystack', label: 'Bank or mobile money' },
                  { value: 'ujimora_wallet', label: 'Ujimora Wallet' },
                ]}
              />
              {destination === 'ujimora_wallet' ? (
                <Text>
                  The net amount is added to your GHS wallet. Your plan's withdrawal fee still
                  applies.
                </Text>
              ) : (
                <>
                  <SelectionField
                    label="Saved payout account"
                    value={savedAccountId}
                    onChange={setSavedAccountId}
                    options={[
                      { value: '', label: 'Use entered account' },
                      ...accounts.map((a) => ({
                        value: a.id,
                        label: `${a.accountName} · ${payoutInstitutionName(a.bankCode, a.bankCode)} · ${a.last4}`,
                      })),
                    ]}
                  />
                  {!savedAccountId && (
                    <>
                      <SegmentedButtons
                        value={wType}
                        onValueChange={setWType}
                        buttons={[
                          { value: 'mobile_money', label: 'Mobile money' },
                          { value: 'ghipss', label: 'Bank' },
                        ]}
                      />
                      <TextInput
                        label={wType === 'mobile_money' ? 'Phone number' : 'Account number'}
                        value={wAccount}
                        onChangeText={setWAccount}
                      />
                      <TextInput
                        label={wType === 'mobile_money' ? 'Network (e.g. MTN)' : 'Bank code'}
                        value={wBank}
                        onChangeText={setWBank}
                      />
                      <TextInput
                        label="Account name"
                        value={wName}
                        onChangeText={setWName}
                        placeholder={displayName}
                      />
                    </>
                  )}
                  <Text
                    onPress={() => {
                      setWOpen(false)
                      router.push('/payout-accounts')
                    }}
                    style={styles.sub}
                  >
                    Manage saved accounts ↗
                  </Text>
                </>
              )}
              {policy && (
                <Text style={styles.sub}>
                  {policy.planName} transfer fee: {policy.feePercent}%. Fee:{' '}
                  {fmt(Math.round(wValue * policy.feePercent) / 100)} · You receive:{' '}
                  {fmt(
                    Math.round(
                      (wValue - Math.round(wValue * policy.feePercent) / 100) *
                        100,
                    ) / 100,
                  )}
                  . The full requested amount is deducted from your creator balance.
                </Text>
              )}
              {wError ? <Text style={styles.err}>{wError}</Text> : null}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setWOpen(false)}>Cancel</Button>
            <Button
              mode="contained"
              loading={wSubmitting}
              disabled={
                wSubmitting || !policy || !Number.isFinite(wValue) || wValue <= 0
              }
              onPress={withdraw}
            >
              Withdraw
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Snackbar visible={!!snack} onDismiss={() => setSnack('')} duration={2200}>
        {snack}
      </Snackbar>
    </View>
  )
}

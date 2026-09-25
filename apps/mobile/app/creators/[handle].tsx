import { LEGAL_ACCEPTANCE_VERSION } from '@ubuntu-fund/types'
import { useFocusEffect } from 'expo-router'
import { AppState } from 'react-native'
import { ReportContent } from '@/components/ReportContent'
import { UserSafetyControls } from '@/components/UserSafetyControls'
import { useAuth } from '@/context/AuthContext'
import { SkeletonLoader, Button } from '@/components/Loading'
import { BrandedTextInput as TextInput } from '@/components/BrandedTextInput'
import { useState, useCallback, useMemo, useRef } from 'react'
import { View, Image, ScrollView, StyleSheet, Platform } from 'react-native'
import { Text, Avatar, Checkbox } from 'react-native-paper'
import { Link, Stack, useLocalSearchParams } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { DonationCelebration } from '@/components/DonationCelebration'
import { ApiError } from '@/lib/api'
import { getCreatorByHandle, createTip, verifyTip, type CreatorPage } from '@/lib/creators'
import { usePalette, useNeu } from '@/context/ColorModeContext'
import type { Palette, NeuRecipes } from '@/theme'
import { KeyboardAvoider } from '@/components/KeyboardAvoider'

function makeStyles(p: Palette, neu: NeuRecipes) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: p.background },
    content: { padding: 16, paddingBottom: 48 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    header: { alignItems: 'center', marginBottom: 20 },
    name: { fontSize: 22, fontFamily: 'Outfit_700Bold', color: p.text, marginTop: 12 },
    tagline: {
      fontSize: 14,
      fontFamily: 'Outfit_400Regular',
      color: p.textSecondary,
      marginTop: 4,
      textAlign: 'center',
    },
    statsRow: { flexDirection: 'row', gap: 28, marginTop: 16 },
    statVal: { fontSize: 18, fontFamily: 'Outfit_700Bold', color: p.text, textAlign: 'center' },
    statLbl: {
      fontSize: 11,
      fontFamily: 'Outfit_400Regular',
      color: p.textSecondary,
      textTransform: 'uppercase',
      textAlign: 'center',
    },
    card: {
      ...neu.raised,
      backgroundColor: p.surface,
      borderRadius: 14,
      padding: 18,
      gap: 12,
      marginBottom: 16,
    },
    cardTitle: { fontSize: 17, fontFamily: 'Outfit_700Bold', color: p.text, marginBottom: 4 },
    presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    bio: { fontSize: 14, fontFamily: 'Outfit_400Regular', color: p.textSecondary, lineHeight: 22 },
    tipRow: {
      ...neu.subtle,
      backgroundColor: p.surface,
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
    },
    tipName: { fontSize: 14, fontFamily: 'Outfit_700Bold', color: p.text },
    tipMsg: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: p.textSecondary, marginTop: 4 },
    err: { color: p.error, fontFamily: 'Outfit_400Regular', fontSize: 13 },
  })
}

export default function CreatorTipScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>()
  const { user } = useAuth()
  return <CreatorTipForViewer key={`${handle}:${user?.id ?? 'guest'}`} />
}

function CreatorTipForViewer() {
  const { handle } = useLocalSearchParams<{ handle: string }>()
  const p = usePalette()
  const neu = useNeu()
  const styles = useMemo(() => makeStyles(p, neu), [p, neu])

  const amountInput = useRef<{ focus(): void } | null>(null)
  const [custom, setCustom] = useState(false)
  const [failedCover, setFailedCover] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const [paymentRef, setPaymentRef] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('')
  const [contentReviewStatus, setContentReviewStatus] = useState('')
  async function checkPayment(reference: string) {
    try {
      const result = await verifyTip(String(handle), reference)
      setPaymentStatus(result.status)
      setContentReviewStatus(result.contentReviewStatus ?? '')
      if (result.status === 'SUCCEEDED') setReloadKey((k) => k + 1)
    } catch {
      setPaymentStatus('PENDING')
    }
  }
  const { user } = useAuth()
  const [blocked, setBlocked] = useState(false)
  const [page, setPage] = useState<CreatorPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [amount, setAmount] = useState('25')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [messageAccepted, setMessageAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const initialized = useRef(false)
  useFocusEffect(useCallback(() => {
    let active = true
    let inFlight = false
    const load = async () => {
      if (inFlight) return
      inFlight = true
      if (!initialized.current) setLoading(true)
      try {
        const data = await getCreatorByHandle(String(handle))
        if (!active) return
        setPage(data); setNotFound(false); setLoadError(false)
        if (!initialized.current && data.presetAmounts?.[0]) setAmount(String(data.presetAmounts[0]))
        initialized.current = true
      } catch (err) {
        if (!active) return
        setPage(null)
        if (err instanceof ApiError && err.status === 404) { setNotFound(true); setLoadError(false) }
        else { setLoadError(true); setNotFound(false) }
      } finally { inFlight = false; if (active) setLoading(false) }
    }
    void load()
    const timer = setInterval(() => { if (AppState.currentState === 'active') void load() }, 30000)
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void load() })
    return () => { active = false; clearInterval(timer); listener.remove() }
  }, [handle, reloadKey]))

  async function support() {
    setError(null)
    if ((message.trim() || (!anonymous && name.trim())) && !messageAccepted) { setError('Accept the content terms before posting your public name or message.'); return }
    const amt = Number(amount)
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Choose an amount.')
      return
    }
    if (!email) {
      setError('Enter your email for a receipt.')
      return
    }
    setSubmitting(true)
    try {
      const res = await createTip(String(handle), {
        amount: amt,
        supporterEmail: email,
        supporterName: name || undefined,
        message: message.trim() || undefined,
        legalAcceptance: (message.trim() || (!anonymous && name.trim())) && messageAccepted ? { version: LEGAL_ACCEPTANCE_VERSION, acceptedTerms: true, ageConfirmed: true } : undefined,
        isAnonymous: anonymous,
      })
      setPaymentRef(res.reference)
      if (!res.checkoutUrl.startsWith('/tip/callback?')) await WebBrowser.openBrowserAsync(res.checkoutUrl)
      await checkPayment(res.reference)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start checkout.')
    } finally {
      setSubmitting(false)
    }
  }

  const fmt = (n: number) => `${page?.currency === 'GHS' ? 'GH₵' : ''}${n.toLocaleString()}`

  if (blocked) return <View style={styles.center}><Stack.Screen options={{ title: 'Support a creator' }} /><Text>User blocked. Manage blocked users in Settings.</Text><Link href="/settings">Open settings</Link></View>

  if (loading)
    return (
      <View style={styles.center}><Stack.Screen options={{ title: 'Support a creator' }} />
        <SkeletonLoader color={p.primary} />
      </View>
    )
  if (notFound) {
    return (
      <View style={styles.center}><Stack.Screen options={{ title: 'Support a creator' }} />
        <Text style={styles.name}>Page not found</Text>
        <Text style={styles.tagline}>No creator at @{handle}.</Text>
      </View>
    )
  }
  if (loadError || !page) {
    return (
      <View style={styles.center}><Stack.Screen options={{ title: 'Support a creator' }} />
        <Text style={styles.name}>Something went wrong</Text>
        <Text style={[styles.tagline, { marginBottom: 16 }]}>
          We couldn’t load @{handle} just now.
        </Text>
        <Button
          mode="contained"
          onPress={() => setReloadKey((k) => k + 1)}
          labelStyle={{ fontFamily: 'Outfit_700Bold' }}
        >
          Try again
        </Button>
      </View>
    )
  }
  const initials = page.displayName
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: page.displayName }} />
      <KeyboardAvoider>
      <ScrollView automaticallyAdjustKeyboardInsets contentContainerStyle={styles.content}>
        {paymentStatus === 'SUCCEEDED' && (
          <>
            <DonationCelebration />
            <Text style={styles.cardTitle}>Thank you! Your support is confirmed.</Text>
            {contentReviewStatus === 'pending' && <Text style={styles.tagline}>Your public name and message are waiting for staff review.</Text>}
            {contentReviewStatus === 'approved' && <Text style={styles.tagline}>Your public name and message passed review. Your anonymity choice still applies.</Text>}
            {contentReviewStatus === 'rejected' && <Text style={styles.tagline}>Your public name and message were not approved for display. Contact support@ujimora.com with your payment reference to ask about the decision.</Text>}
          </>
        )}
        {paymentStatus === 'PENDING' && (
          <>
            <Text style={styles.tagline}>Confirmation is pending. Please do not pay again.</Text>
            <Button onPress={() => void checkPayment(paymentRef)}>Check payment</Button>
          </>
        )}
        {paymentStatus === 'FAILED' && (
          <Text style={styles.err}>
            Payment was not completed. Contact support if you see a debit before trying again.
          </Text>
        )}
        <View
          style={{
            height: 180,
            backgroundColor: p.primaryDark,
            borderRadius: 24,
            overflow: 'hidden',
            marginBottom: -36,
          }}
        >
          {page.coverUrl && failedCover !== page.coverUrl ? (
            <Image
              source={{ uri: page.coverUrl }}
              onError={() => setFailedCover(page.coverUrl || '')}
              accessibilityLabel={`${page.displayName}'s cover`}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          ) : (
            <View
              style={{
                position: 'absolute',
                right: 30,
                top: 30,
                width: 130,
                height: 130,
                borderRadius: 32,
                borderWidth: 2,
                borderColor: p.primary,
                transform: [{ rotate: '30deg' }],
              }}
            />
          )}
        </View>
        <View style={styles.header}>
          {page.avatarUrl ? (
            <Avatar.Image size={84} source={{ uri: page.avatarUrl }} />
          ) : (
            <Avatar.Text size={84} label={initials} />
          )}
          <Text style={styles.name}>{page.displayName}</Text>
          <UserSafetyControls userId={page.userId} onBlocked={() => { setPage(null); setBlocked(true) }} />
          {page.tagline ? <Text style={styles.tagline}>{page.tagline}</Text> : null}
          <View style={styles.statsRow}>
            <View>
              <Text style={styles.statVal}>{page.supporterCount}</Text>
              <Text style={styles.statLbl}>Supporters</Text>
            </View>
            <View>
              <Text style={styles.statVal}>{fmt(page.totalReceived)}</Text>
              <Text style={styles.statLbl}>Received</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Support {page.displayName.split(' ')[0]}</Text>
          {Platform.OS !== 'web' ? (
            <Text style={styles.tagline}>Creator tips are not available in this app yet.</Text>
          ) : !page.tipsEnabled ? (
            <Text style={styles.tagline}>This creator isn’t accepting tips right now.</Text>
          ) : (
            <>
              <Text style={styles.tagline}>
                Choose an amount, pay securely with Paystack, then receive confirmation. No Ujimora
                account needed.
              </Text>
              <View style={styles.presetRow}>
                {page.presetAmounts.map((a) => (
                  <Button
                    key={a}
                    mode={!custom && Number(amount) === a ? 'contained' : 'outlined'}
                    compact
                    onPress={() => {
                      setCustom(false)
                      setAmount(String(a))
                    }}
                    labelStyle={{ fontFamily: 'Outfit_700Bold' }}
                  >
                    {fmt(a)}
                  </Button>
                ))}
              </View>
              <Button
                mode={custom ? 'contained' : 'outlined'}
                onPress={() => {
                  setCustom(true)
                  amountInput.current?.focus()
                }}
              >
                Custom amount
              </Button>
              <TextInput
                inputRef={(input) => {
                  amountInput.current = input
                }}
                label="Your amount (GHS)"
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={(v) => {
                  setCustom(true)
                  setAmount(v)
                }}
              />
              <TextInput label="Your name (optional)" value={name} onChangeText={setName} />
              <TextInput
                label="Email (for your receipt)"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
              <TextInput
                label="Say something nice (optional)"
                value={message}
                onChangeText={setMessage}
                multiline
              />
              {(message.trim() || (!anonymous && name.trim())) ? <View>
                <Checkbox.Item label="I am at least 18 and agree to the terms for posting my public name and message." status={messageAccepted ? 'checked' : 'unchecked'} onPress={() => setMessageAccepted(value => !value)} />
                <Text style={styles.tagline}>Messages must follow our <Link href="/terms">Terms of Use</Link>. Do not include private information, threats or abusive content.</Text>
              </View> : null}
              <Checkbox.Item
                label="Show my support anonymously"
                status={anonymous ? 'checked' : 'unchecked'}
                onPress={() => setAnonymous((v) => !v)}
              />
              <Text style={styles.tagline}>
                Your name and message appear publicly only after staff review. Anonymous support hides your name. Your
                email stays private.
              </Text>
              {error ? <Text style={styles.err}>{error}</Text> : null}
              <Button
                mode="contained"
                loading={submitting}
                disabled={submitting || paymentStatus === 'PENDING'}
                onPress={support}
                icon="heart"
                labelStyle={{ fontFamily: 'Outfit_700Bold' }}
              >
                {submitting ? 'Starting…' : `Support ${fmt(Number(amount) || 0)}`}
              </Button>
            </>
          )}
        </View>

        {page.bio ? (
          <View style={styles.card}>
            <Text style={styles.bio}>{page.bio}</Text>
          </View>
        ) : null}

        {page.recentTips.length > 0 && (
          <View>
            <Text style={[styles.cardTitle, { marginBottom: 8 }]}>Recent supporters</Text>
            {page.recentTips.map((t, i) => (
              <View key={i} style={styles.tipRow}>
                <Text style={styles.tipName}>
                  {t.supporterName} · {fmt(t.amount)}
                </Text>
                {t.message ? <Text style={styles.tipMsg}>“{t.message}”</Text> : null}
                {user && t.message && <ReportContent tipId={t.id} />}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
      </KeyboardAvoider>
    </View>
  )
}

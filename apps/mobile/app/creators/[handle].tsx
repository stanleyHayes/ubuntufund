import { BrandedTextInput as TextInput } from '@/components/BrandedTextInput'
import { useState, useEffect, useMemo } from 'react'
import { View, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { Text, Button, Avatar } from 'react-native-paper'
import { Stack, useLocalSearchParams } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { ApiError } from '@/lib/api'
import { getCreatorByHandle, createTip, type CreatorPage } from '@/lib/creators'
import { usePalette, useNeu } from '@/context/ColorModeContext'
import type { Palette, NeuRecipes } from '@/theme'

function makeStyles(p: Palette, neu: NeuRecipes) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: p.background },
    content: { padding: 16, paddingBottom: 48 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
    header: { alignItems: 'center', marginBottom: 20 },
    name: { fontSize: 22, fontFamily: 'Outfit_700Bold', color: p.text, marginTop: 12 },
    tagline: { fontSize: 14, fontFamily: 'Outfit_400Regular', color: p.textSecondary, marginTop: 4, textAlign: 'center' },
    statsRow: { flexDirection: 'row', gap: 28, marginTop: 16 },
    statVal: { fontSize: 18, fontFamily: 'Outfit_700Bold', color: p.text, textAlign: 'center' },
    statLbl: { fontSize: 11, fontFamily: 'Outfit_400Regular', color: p.textSecondary, textTransform: 'uppercase', textAlign: 'center' },
    card: { ...neu.raised, backgroundColor: p.surface, borderRadius: 14, padding: 18, gap: 12, marginBottom: 16 },
    cardTitle: { fontSize: 17, fontFamily: 'Outfit_700Bold', color: p.text, marginBottom: 4 },
    presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    bio: { fontSize: 14, fontFamily: 'Outfit_400Regular', color: p.textSecondary, lineHeight: 22 },
    tipRow: { ...neu.subtle, backgroundColor: p.surface, borderRadius: 10, padding: 12, marginBottom: 8 },
    tipName: { fontSize: 14, fontFamily: 'Outfit_700Bold', color: p.text },
    tipMsg: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: p.textSecondary, marginTop: 4 },
    err: { color: p.error, fontFamily: 'Outfit_400Regular', fontSize: 13 },
  })
}

export default function CreatorTipScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>()
  const p = usePalette()
  const neu = useNeu()
  const styles = useMemo(() => makeStyles(p, neu), [p, neu])

  const [page, setPage] = useState<CreatorPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [amount, setAmount] = useState('25')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getCreatorByHandle(String(handle))
      .then((data) => { if (!cancelled) { setPage(data); if (data.presetAmounts?.[0]) setAmount(String(data.presetAmounts[0])) } })
      .catch((err) => { if (!cancelled) setNotFound(err instanceof ApiError && err.status === 404) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [handle])

  async function support() {
    setError(null)
    const amt = Number(amount)
    if (!amt || amt <= 0) { setError('Choose an amount.'); return }
    if (!email) { setError('Enter your email for a receipt.'); return }
    setSubmitting(true)
    try {
      const res = await createTip(String(handle), { amount: amt, supporterEmail: email, supporterName: name || undefined, message: message || undefined })
      await WebBrowser.openBrowserAsync(res.checkoutUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start checkout.')
    } finally { setSubmitting(false) }
  }

  const fmt = (n: number) => `${page?.currency === 'GHS' ? 'GH₵' : ''}${n.toLocaleString()}`

  if (loading) return <View style={styles.center}><ActivityIndicator color={p.primary} /></View>
  if (notFound || !page) {
    return (
      <View style={styles.center}>
        <Text style={styles.name}>Page not found</Text>
        <Text style={styles.tagline}>No creator at @{handle}.</Text>
      </View>
    )
  }
  const initials = page.displayName.split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase()

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: page.displayName }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          {page.avatarUrl ? <Avatar.Image size={84} source={{ uri: page.avatarUrl }} /> : <Avatar.Text size={84} label={initials} />}
          <Text style={styles.name}>{page.displayName}</Text>
          {page.tagline ? <Text style={styles.tagline}>{page.tagline}</Text> : null}
          <View style={styles.statsRow}>
            <View><Text style={styles.statVal}>{page.supporterCount}</Text><Text style={styles.statLbl}>Supporters</Text></View>
            <View><Text style={styles.statVal}>{fmt(page.totalReceived)}</Text><Text style={styles.statLbl}>Received</Text></View>
          </View>
        </View>

        {page.bio ? <View style={styles.card}><Text style={styles.bio}>{page.bio}</Text></View> : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Support {page.displayName.split(' ')[0]}</Text>
          {!page.tipsEnabled ? (
            <Text style={styles.tagline}>This creator isn’t accepting tips right now.</Text>
          ) : (
            <>
              <View style={styles.presetRow}>
                {page.presetAmounts.map((a) => (
                  <Button key={a} mode={Number(amount) === a ? 'contained' : 'outlined'} compact onPress={() => setAmount(String(a))} labelStyle={{ fontFamily: 'Outfit_700Bold' }}>
                    {fmt(a)}
                  </Button>
                ))}
              </View>
              <TextInput label="Amount" keyboardType="numeric" value={amount} onChangeText={setAmount} />
              <TextInput label="Your name (optional)" value={name} onChangeText={setName} />
              <TextInput label="Email (for your receipt)" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
              <TextInput label="Say something nice (optional)" value={message} onChangeText={setMessage} multiline />
              {error ? <Text style={styles.err}>{error}</Text> : null}
              <Button mode="contained" loading={submitting} disabled={submitting} onPress={support} icon="heart" labelStyle={{ fontFamily: 'Outfit_700Bold' }}>
                {submitting ? 'Starting…' : `Support ${fmt(Number(amount) || 0)}`}
              </Button>
            </>
          )}
        </View>

        {page.recentTips.length > 0 && (
          <View>
            <Text style={[styles.cardTitle, { marginBottom: 8 }]}>Recent supporters</Text>
            {page.recentTips.map((t, i) => (
              <View key={i} style={styles.tipRow}>
                <Text style={styles.tipName}>{t.supporterName} · {fmt(t.amount)}</Text>
                {t.message ? <Text style={styles.tipMsg}>“{t.message}”</Text> : null}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  )
}

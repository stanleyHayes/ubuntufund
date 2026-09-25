import { useState } from 'react'
import { ScrollView } from 'react-native'
import { Checkbox, Text } from 'react-native-paper'
import { router, type Href } from 'expo-router'
import { LEGAL_ACCEPTANCE_VERSION, type LegalAcceptanceRecord } from '@ubuntu-fund/types'
import { Linking } from 'react-native'
import { agreementNotice } from '@/lib/agreementStatus'
import { Button } from '@/components/Loading'
import { useAuth } from '@/context/AuthContext'
import { usePalette } from '@/context/ColorModeContext'
import { api } from '@/lib/api'
import { establishSession, sessionSnapshot } from '@/lib/session'
import { signInHref } from '@/navigation/returnTo'
export default function AccountAgreement() {
  const { user, isAuthenticated, legalStatus, refreshLegalStatus } = useAuth()
  const p = usePalette()
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function save() {
    setSaving(true); setError('')
    try {
      const legalAcceptance = await api.post<LegalAcceptanceRecord>('/profile/legal-acceptance', { version: LEGAL_ACCEPTANCE_VERSION, acceptedTerms, ageConfirmed })
      const session = sessionSnapshot()
      if (session && session.user.id === user?.id) await establishSession({ ...session.user, legalAcceptance }, session.tokens)
      await refreshLegalStatus()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your agreement. Please retry.')
      // The API may require a newer version than this build ships; show that path.
      void refreshLegalStatus()
    }
    finally { setSaving(false) }
  }
  const notice = agreementNotice(isAuthenticated, user?.legalAcceptance, legalStatus)
  return <ScrollView style={{ flex: 1, backgroundColor: p.background }} contentContainerStyle={{ padding: 24, gap: 16 }}>
    <Text accessibilityRole="header" style={{ color: p.text, fontSize: 26, fontFamily: 'Outfit_700Bold' }}>Your account agreement</Text>
    <Text style={{ color: p.textSecondary }}>Review the rules for using Ujimora and sharing content. Marketing and notifications are separate choices. You can still read policies, manage eligible funds or request deletion without accepting.</Text>
    {([['/terms', 'Terms of Use'], ['/acceptable-use', 'Acceptable Use'], ['/privacy', 'Privacy Notice'], ['/delete-account', 'Delete account']] as const).map(([path, label]) => <Button key={path} onPress={() => router.push(path as Href)}>{label}</Button>)}
    {!isAuthenticated ? <Button onPress={() => router.push(signInHref('/account-agreement'))}>Sign in to review your agreement</Button> : notice === 'hidden' ? <Text style={{ color: p.text }}>Your agreement has been saved.</Text> : notice === 'update-app' ? <>
      {/* This build ships older policy text than the version the API requires; never accept unseen terms. */}
      <Text accessibilityRole="alert" style={{ color: p.text }}>An updated account agreement is available. Update Ujimora from the App Store or Google Play to review and accept it, or review it on the Ujimora website.</Text>
      <Button mode="contained" onPress={() => { void Linking.openURL('https://app.ujimora.com/account-agreement') }}>Review on the website</Button>
      <Button onPress={() => { void refreshLegalStatus() }}>I have accepted it, check again</Button>
    </> : <>
      {!!error && <Text accessibilityRole="alert" style={{ color: p.error }}>{error}</Text>}
      <Checkbox.Item label="I agree to the Terms of Use and Acceptable Use Policy and have read the Privacy Notice." status={acceptedTerms ? 'checked' : 'unchecked'} onPress={() => setAcceptedTerms(!acceptedTerms)} labelStyle={{ color: p.text }} />
      <Checkbox.Item label="I confirm that I am at least 18 years old." status={ageConfirmed ? 'checked' : 'unchecked'} onPress={() => setAgeConfirmed(!ageConfirmed)} labelStyle={{ color: p.text }} />
      <Button mode="contained" disabled={!acceptedTerms || !ageConfirmed || saving} onPress={() => { void save() }}>{saving ? 'Saving…' : 'Save agreement'}</Button>
    </>}
  </ScrollView>
}

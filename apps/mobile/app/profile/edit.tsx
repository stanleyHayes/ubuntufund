import { useEffect, useState } from 'react'
import { ScrollView, View, Image, StyleSheet } from 'react-native'
import { Text, Snackbar } from 'react-native-paper'
import { Stack } from 'expo-router'
import { Country } from 'country-state-city'
import { api } from '@/lib/api'
import { sessionSnapshot, establishSession } from '@/lib/session'
import { usePalette, useNeu } from '@/context/ColorModeContext'
import { GlassSurface } from '@/components/GlassSurface'
import { UjimoraLogo } from '@/components/UjimoraLogo'
import { MediaUploadField } from '@/components/MediaUploadField'
import { BrandedTextInput as TextInput } from '@/components/BrandedTextInput'
import { SelectionField } from '@/components/SelectionField'
import { Button, PageSkeleton } from '@/components/Loading'
interface Profile { name: string; phone: string; bio: string; country: string; avatarUrl: string; coverUrl: string }
export default function EditProfile() {
  const p = usePalette(); const neu = useNeu()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [uploads, setUploads] = useState(0)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => { let active = true; setError(''); api.get<Partial<Profile>>('/profile').then(v => { if (active) setProfile({ name: v.name || '', phone: v.phone || '', bio: v.bio || '', country: v.country || '', avatarUrl: v.avatarUrl || '', coverUrl: v.coverUrl || '' }) }).catch(e => { if (active) setError(e.message) }); return () => { active = false } }, [retry])
  const update = (key: keyof Profile, value: string) => setProfile(v => v ? { ...v, [key]: value } : v)
  async function save() {
    if (!profile || !profile.name.trim()) return
    setBusy(true); setError('')
    try {
      await api.put('/profile', profile)
      const session = sessionSnapshot()
      if (session) await establishSession({ ...session.user, name: profile.name }, session.tokens)
      setNotice('Your profile has been updated')
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save profile.') } finally { setBusy(false) }
  }
  async function changePassword() {
    if (newPassword !== confirm) { setError('The new passwords do not match.'); return }
    setBusy(true); setError('')
    try { await api.put('/auth/change-password', { currentPassword, newPassword }); setCurrentPassword(''); setNewPassword(''); setConfirm(''); setNotice('Password updated') }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not update password.') } finally { setBusy(false) }
  }
  if (!profile && !error) return <PageSkeleton />
  return <View style={{ flex: 1, backgroundColor: p.background }}><Stack.Screen options={{ title: 'Edit profile' }} /><ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 60 }}>
    {profile ? <>
      <View style={{ gap: 6 }}>
        <Text variant="headlineMedium" style={{ color: p.text, fontFamily: 'Outfit_700Bold' }}>Make it yours</Text>
        <Text style={{ color: p.textSecondary }}>Your cover and photo, together as people see them.</Text>
      </View>
      <GlassSurface style={{ borderRadius: 28, padding: 12 }}>
        <View style={{ height: 168, borderRadius: 20, overflow: 'hidden', backgroundColor: p.primaryDark }}>
          <View style={{ position: 'absolute', right: -16, top: -20, opacity: 0.35 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><UjimoraLogo size={150} /></View>
          {profile.coverUrl ? <Image accessibilityLabel="Cover preview" source={{ uri: profile.coverUrl }} resizeMode="cover" style={StyleSheet.absoluteFill} /> : null}
        </View>
        <View style={{ alignItems: 'center', marginTop: -48 }}>
          <View style={{ width: 106, height: 106, borderRadius: 53, padding: 5, backgroundColor: p.surface }}>
            <View style={{ width: 96, height: 96, borderRadius: 48, overflow: 'hidden', backgroundColor: p.secondary, alignItems: 'center', justifyContent: 'center' }}>
              {profile.avatarUrl ? <Image accessibilityLabel="Profile photo preview" source={{ uri: profile.avatarUrl }} resizeMode="cover" style={StyleSheet.absoluteFill} /> : <UjimoraLogo size={46} />}
            </View>
          </View>
          <Text style={{ color: p.text, fontSize: 20, fontFamily: 'Outfit_700Bold', marginTop: 8, textAlign: 'center' }}>{profile.name || 'Your name'}</Text>
          <Text style={{ color: p.textSecondary, fontSize: 12, marginTop: 4, marginBottom: 18 }}>Profile preview</Text>
        </View>
        <View style={{ paddingHorizontal: 4, borderTopWidth: 1, borderTopColor: p.border, paddingTop: 8, gap: 4 }}>
          <MediaUploadField compact label="Cover image" folder="profiles" value={profile.coverUrl} onChange={v => update('coverUrl', v)} crop aspect={[16, 9]} onBusyChange={v => setUploads(n => n + (v ? 1 : -1))} />
          <View style={{ height: 1, backgroundColor: p.border }} />
          <MediaUploadField compact label="Profile photo" folder="profiles" value={profile.avatarUrl} onChange={v => update('avatarUrl', v)} crop onBusyChange={v => setUploads(n => n + (v ? 1 : -1))} />
          <Text style={{ color: p.textSecondary, fontSize: 12, paddingVertical: 8 }}>Images up to 4 MB. Tap Save profile below to apply your changes.</Text>
        </View>
      </GlassSurface>
      <View style={{ ...neu.raised, backgroundColor: p.surface, borderRadius: 24, padding: 20, gap: 16 }}>
        <Text variant="titleLarge" style={{ color: p.text }}>About you</Text>
        {(['name', 'phone', 'bio'] as const).map(key => <TextInput key={key} label={key} value={profile[key]} onChangeText={v => update(key, v)} multiline={key === 'bio'} />)}
        <SelectionField label="Country" value={profile.country} options={Country.getAllCountries().map(c => ({ value: c.name, label: c.name }))} onChange={v => update('country', v)} />
        <Button loading={busy} disabled={busy || uploads > 0 || !profile.name.trim()} mode="contained" onPress={() => void save()}>Save profile</Button>
      </View>
      <View style={{ ...neu.raised, backgroundColor: p.surface, borderRadius: 24, padding: 20, gap: 16 }}><Text variant="titleLarge">Change password</Text>
        <TextInput label="Current password" secureTextEntry value={currentPassword} onChangeText={setCurrentPassword} /><TextInput label="New password" secureTextEntry value={newPassword} onChangeText={setNewPassword} /><TextInput label="Confirm new password" secureTextEntry value={confirm} onChangeText={setConfirm} />
        <Button loading={busy} disabled={busy || !currentPassword || newPassword.length < 8} onPress={() => void changePassword()}>Update password</Button>
      </View>
    </> : <Button onPress={() => setRetry(n => n + 1)}>Retry loading profile</Button>}
  </ScrollView><Snackbar visible={!!error || !!notice} duration={error ? Infinity : 4000} onDismiss={() => { setError(''); setNotice('') }} action={{ label: 'Dismiss', onPress: () => { setError(''); setNotice('') } }}>{error || notice}</Snackbar></View>
}

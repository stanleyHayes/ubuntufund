import { useEffect, useState } from 'react'
import { Image, View } from 'react-native'
import { Text } from 'react-native-paper'
import * as Clipboard from 'expo-clipboard'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { usePalette } from '@/context/ColorModeContext'
import { downloadRecoveryCodes } from '@/lib/recoveryCodes'
import { withExternalActivity } from '@/lib/session'
import { BrandedTextInput as TextInput } from './BrandedTextInput'
import { Button } from './Loading'
import { OtpInput } from './OtpInput'
import { UjimoraLogo } from './UjimoraLogo'
type Status = { enabled: boolean; available: boolean; recoveryCodesRemaining: number }
type Setup = { enrollmentId: string; secret: string; qrCode: string; expiresAt: string }
export function MfaSettings() {
  const p = usePalette(), { user, replaceTokens } = useAuth()
  const [status, setStatus] = useState<Status | null>(null), [setup, setSetup] = useState<Setup | null>(null)
  const [password, setPassword] = useState(''), [code, setCode] = useState(''), [recoveryMode, setRecoveryMode] = useState(false)
  const [codes, setCodes] = useState<string[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('')
  useEffect(() => { let active = true; void api.get<Status>('/auth/mfa').then(value => { if (active) setStatus(value) }).catch(error => { if (active) setError(error.message) }); return () => { active = false } }, [])
  async function action(kind: 'setup' | 'enable' | 'disable' | 'recovery-codes') {
    setBusy(true); setError(''); setMessage('')
    try {
      if (kind === 'setup') { setSetup(await api.post<Setup>('/auth/mfa/setup', { password })); setCode(''); setRecoveryMode(false) }
      else {
        const result = await api.post<{ tokens: { accessToken: string; refreshToken: string }; recoveryCodes: string[] }>(`/auth/mfa/${kind}`, { password, code, enrollmentId: setup?.enrollmentId })
        setCodes(result.recoveryCodes); setSetup(null); setPassword(''); setCode(''); setRecoveryMode(false)
        setStatus(previous => ({ available: previous?.available ?? true, enabled: kind !== 'disable', recoveryCodesRemaining: result.recoveryCodes.length }))
        setMessage(kind === 'disable' ? 'Authenticator protection disabled. Other sessions have been signed out.' : 'Authenticator protection enabled. Save your recovery codes now. Other sessions have been signed out.')
        try { await replaceTokens(result.tokens, user?.id ?? '') } catch { setError('Your account protection was updated, but device sign-in could not be saved. Save your recovery codes, then sign in again before using biometric unlock.') }
      }
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not update authenticator protection.') } finally { setBusy(false) }
  }
  async function copy(text: string) { try { await Clipboard.setStringAsync(text); setMessage('Copied. Keep this information private.') } catch { setError('Could not copy. Select the text manually.') } }
  // The Android share sheet backgrounds the app; keep the codes on screen when it returns.
  async function download() { try { await withExternalActivity(() => downloadRecoveryCodes(codes)) } catch (error) { setError(error instanceof Error ? error.message : 'Could not save recovery codes.') } }
  return <View style={{ paddingVertical: 16, gap: 14 }}>
    <Text variant="titleMedium">Authenticator protection</Text><Text>Optional extra protection for sign-in. Use an authenticator app to generate a six-digit code after entering your password.</Text>
    {!!error && <Text accessibilityRole="alert" style={{ color: p.error }}>{error}</Text>}{!!message && <Text accessibilityRole="alert" style={{ color: p.success }}>{message}</Text>}
    {!status && !error && <Text>Loading security settings…</Text>}
    {status && <Text>{status.enabled ? `Enabled · ${status.recoveryCodesRemaining} recovery codes remaining` : 'Off — enable it when you are ready.'}</Text>}
    {status && !status.available && <Text>Authenticator setup is temporarily unavailable.</Text>}
    {!!codes.length && <View style={{ gap: 10 }}><Text>Save these private codes now. Each works once. They are not shown again.</Text><Text selectable style={{ fontSize: 12, lineHeight: 24 }}>{codes.join('\n')}</Text><Button onPress={() => void copy(codes.join('\n'))}>Copy recovery codes</Button><Button onPress={() => void download()}>Download recovery codes</Button><Button onPress={() => { setCodes([]); setMessage('Recovery codes hidden.') }}>I have saved my codes</Button></View>}
    {(status?.available || status?.enabled) && !codes.length && <>
      <TextInput label="Current password" secureTextEntry autoComplete="current-password" value={password} onChangeText={setPassword} disabled={busy} />
      {setup && <View style={{ gap: 10 }}><UjimoraLogo size={28} /><Text>Scan with your authenticator, then enter its code below. Setup expires in 10 minutes.</Text><Image source={{ uri: setup.qrCode }} accessibilityLabel="QR code to add Ujimora to your authenticator" style={{ width: 280, height: 280, maxWidth: '100%', alignSelf: 'center' }} resizeMode="contain" /><Text>Cannot scan? Enter this setup key manually:</Text><Text selectable>{setup.secret}</Text><Button onPress={() => void copy(setup.secret)}>Copy setup key</Button></View>}
      {(setup || status?.enabled) && <>
        {recoveryMode ? <TextInput label="Recovery code" value={code} onChangeText={setCode} autoCapitalize="none" autoCorrect={false} disabled={busy} /> : <OtpInput value={code} onChange={setCode} disabled={busy} />}
        {status?.enabled && <Button disabled={busy} onPress={() => { setRecoveryMode(value => !value); setCode('') }}>{recoveryMode ? 'Use authenticator code' : 'Use a recovery code'}</Button>}
      </>}
      {!status?.enabled && <Button mode="contained" disabled={busy || !password || (!!setup && code.length !== 6)} onPress={() => void action(setup ? 'enable' : 'setup')}>{busy ? 'Please wait…' : setup ? 'Confirm and enable MFA' : 'Set up authenticator'}</Button>}
      {setup && <Button disabled={busy} onPress={() => { setSetup(null); setCode(''); setPassword('') }}>Cancel setup</Button>}
      {status?.enabled && <><Button disabled={busy || !password || !code} onPress={() => void action('recovery-codes')}>Replace recovery codes</Button><Button disabled={busy || !password || !code} onPress={() => void action('disable')}>Disable authenticator</Button></>}
    </>}
  </View>
}

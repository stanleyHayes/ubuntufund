import { useEffect, useState } from 'react'
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material'
import { BrandLogo } from './BrandLogo'
import { OtpInput } from './OtpInput'
type Tokens = { accessToken: string; refreshToken: string }
type Status = { enabled: boolean; available: boolean; recoveryCodesRemaining: number }
type Setup = { enrollmentId: string; secret: string; qrCode: string; expiresAt: string }
interface Client { get<T>(path: string): Promise<T>; post<T>(path: string, body: unknown): Promise<T> }
export function MfaSettings({ client, onTokens }: { client: Client; onTokens: (tokens: Tokens) => void }) {
  const [status, setStatus] = useState<Status | null>(null), [setup, setSetup] = useState<Setup | null>(null)
  const [password, setPassword] = useState(''), [code, setCode] = useState(''), [recoveryMode, setRecoveryMode] = useState(false)
  const [codes, setCodes] = useState<string[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('')
  useEffect(() => { let active = true; client.get<Status>('/auth/mfa').then(value => { if (active) setStatus(value) }).catch(error => { if (active) setError(error.message) }); return () => { active = false } }, [client])
  async function action(kind: 'setup' | 'enable' | 'disable' | 'recovery-codes') {
    setBusy(true); setError(''); setMessage('')
    try {
      if (kind === 'setup') {
        setSetup(await client.post<Setup>('/auth/mfa/setup', { password })); setCode(''); setRecoveryMode(false)
      } else {
        const result = await client.post<{ tokens: Tokens; recoveryCodes: string[] }>(`/auth/mfa/${kind}`, { password, code, enrollmentId: setup?.enrollmentId })
        onTokens(result.tokens)
        setCodes(result.recoveryCodes); setSetup(null); setPassword(''); setCode(''); setRecoveryMode(false)
        setStatus(previous => ({ available: previous?.available ?? true, enabled: kind !== 'disable', recoveryCodesRemaining: result.recoveryCodes.length }))
        setMessage(kind === 'disable' ? 'Authenticator protection disabled. Other sessions have been signed out.' : 'Authenticator protection enabled. Save your recovery codes now. Other sessions have been signed out.')
      }
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not update authenticator protection.') } finally { setBusy(false) }
  }
  async function copy(text: string, label: string) {
    try { await navigator.clipboard.writeText(text); setMessage(`${label} copied.`) } catch { setError('Copy is unavailable. Select the text to copy it manually.') }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([`Ujimora recovery codes\nKeep these private. Each code can be used once.\n\n${codes.join('\n')}\n`], { type: 'text/plain;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = 'ujimora-recovery-codes.txt'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <Stack spacing={2} component="section" aria-label="Authenticator protection">
    <Typography variant="h6">Authenticator protection</Typography>
    <Typography variant="body2">Optional extra protection for sign-in. Use an authenticator app to generate a six-digit code after entering your password.</Typography>
    {error && <Alert severity="error">{error}</Alert>}{message && <Alert severity="success" role="status">{message}</Alert>}
    {!status && !error && <Typography>Loading security settings…</Typography>}
    {status && <Typography>{status.enabled ? `Enabled · ${status.recoveryCodesRemaining} recovery codes remaining` : 'Off — enable it when you are ready.'}</Typography>}
    {status && !status.available && <Alert severity="info">Authenticator setup is temporarily unavailable.</Alert>}
    {!!codes.length && <Stack spacing={1}>
      <Alert severity="warning">Store these codes somewhere safe. They are shown only now. Anyone with your password and a recovery code can sign in.</Alert>
      <Box component="pre" sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 2, overflowX: 'auto', fontSize: '0.8rem' }}>{codes.join('\n')}</Box>
      <Stack direction="row" useFlexGap flexWrap="wrap" gap={1}><Button onClick={() => void copy(codes.join('\n'), 'Recovery codes')}>Copy recovery codes</Button><Button onClick={download}>Download recovery codes</Button><Button onClick={() => { setCodes([]); setMessage('Recovery codes hidden.') }}>I have saved my codes</Button></Stack>
    </Stack>}
    {(status?.available || status?.enabled) && !codes.length && <>
      <TextField label="Current password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} disabled={busy} />
      {setup && <Stack spacing={1}>
        <BrandLogo size={28} /><Typography>Scan this QR code with your authenticator, then enter its code below. Setup expires in 10 minutes.</Typography>
        <Box component="img" src={setup.qrCode} alt="QR code to add Ujimora to your authenticator" sx={{ width: 280, maxWidth: '100%', alignSelf: 'center' }} />
        <Typography variant="body2">Cannot scan? Enter this setup key manually:</Typography>
        <Typography component="code" sx={{ overflowWrap: 'anywhere', userSelect: 'all' }}>{setup.secret}</Typography><Button onClick={() => void copy(setup.secret, 'Setup key')}>Copy setup key</Button>
      </Stack>}
      {(setup || status?.enabled) && <>
        {recoveryMode ? <TextField label="Recovery code" value={code} onChange={event => setCode(event.target.value)} autoComplete="off" disabled={busy} /> : <OtpInput value={code} onChange={setCode} disabled={busy} />}
        {status?.enabled && <Button onClick={() => { setRecoveryMode(value => !value); setCode('') }} disabled={busy}>{recoveryMode ? 'Use authenticator code' : 'Use a recovery code'}</Button>}
      </>}
      <Stack direction="row" gap={1} useFlexGap flexWrap="wrap">
        {!status?.enabled && <Button variant="contained" disabled={busy || !password || (!!setup && code.length !== 6)} onClick={() => void action(setup ? 'enable' : 'setup')}>{busy ? 'Please wait…' : setup ? 'Confirm and enable MFA' : 'Set up authenticator'}</Button>}
        {setup && <Button disabled={busy} onClick={() => { setSetup(null); setCode(''); setPassword('') }}>Cancel setup</Button>}
        {status?.enabled && <><Button disabled={busy || !password || !code} onClick={() => void action('recovery-codes')}>Replace recovery codes</Button><Button color="error" disabled={busy || !password || !code} onClick={() => void action('disable')}>Disable authenticator</Button></>}
      </Stack>
    </>}
  </Stack>
}

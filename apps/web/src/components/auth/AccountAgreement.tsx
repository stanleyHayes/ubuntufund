import { ArrowForwardRounded, OpenInNewRounded, GavelRounded, Diversity1Rounded, PrivacyTipOutlined, ManageAccountsOutlined, FactCheckOutlined, CheckCircleOutlineRounded, TuneRounded } from '@mui/icons-material'
import { PageBanner } from '@/components/layout/PageBanner'
import { useState } from 'react'
import { Alert, Box, Button, Checkbox, Container, FormControlLabel, Stack, Typography } from '@mui/material'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import { hasCurrentLegalAcceptance, LEGAL_ACCEPTANCE_VERSION, type LegalAcceptanceRecord } from '@ubuntu-fund/types'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'

export function AccountAgreementNotice() {
  const { user, isAuthenticated } = useAuth()
  const { pathname } = useLocation()
  if (pathname === '/account-agreement' || !isAuthenticated || hasCurrentLegalAcceptance(user?.legalAcceptance)) return null
  return <Alert severity="info" sx={{ m: 2 }} action={<Button component={RouterLink} to="/account-agreement">Review</Button>}>Please review the account agreement before publishing or uploading content.</Alert>
}

export function AccountAgreement() {
  const { user, isAuthenticated, updateLegalAcceptance } = useAuth()
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  async function save() {
    setSaving(true); setError('')
    try {
      const record = await api.post<LegalAcceptanceRecord>('/profile/legal-acceptance', { version: LEGAL_ACCEPTANCE_VERSION, acceptedTerms, ageConfirmed })
      updateLegalAcceptance(record)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save your agreement. Please retry.') }
    finally { setSaving(false) }
  }
  const policies = [
    { to: '/terms', title: 'Terms of Use', description: 'Your account, responsibilities and the rules for using Ujimora.', icon: GavelRounded },
    { to: '/acceptable-use', title: 'Acceptable Use', description: 'What you can share and how we keep the community safe.', icon: Diversity1Rounded },
    { to: '/privacy', title: 'Privacy Notice', description: 'How your information is used, protected and managed.', icon: PrivacyTipOutlined },
    { to: '/delete-account', title: 'Account deletion', description: 'Your options for closing your account and requesting data deletion.', icon: ManageAccountsOutlined },
  ]
  const saved = hasCurrentLegalAcceptance(user?.legalAcceptance)
  const surface = { bgcolor: 'var(--neu-surface)', boxShadow: 'var(--neu-raised)', borderRadius: 'var(--shape-card)' }
  return <Box>
    <PageBanner eyebrow="Your account · Your choices" title="Your account agreement" icon={<FactCheckOutlined />}
      subtitle="Understand the rules for using Ujimora and sharing with the community." />
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.15fr) minmax(0, 1fr)' }, gap: { xs: 3, md: 5 }, alignItems: 'start' }}>
        <Box component="section" aria-labelledby="agreement-policies">
          <Typography id="agreement-policies" component="h2" variant="h5" fontWeight={700}>Read before you agree</Typography>
          <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>Explore each policy at your own pace. Links open in a new tab so you can keep your place here.</Typography>
          <Stack component="nav" aria-label="Account policies" spacing={2}>
            {policies.map(({ to, title, description, icon: Icon }) => <Box key={to} component={RouterLink} to={to} target="_blank" rel="noopener noreferrer"
              sx={{ ...surface, display: 'flex', alignItems: 'center', gap: 2, p: { xs: 2, sm: 2.5 }, color: 'text.primary', textDecoration: 'none', border: '1px solid', borderColor: 'divider', '&:hover': { borderColor: 'primary.main' }, '&:focus-visible': { outline: '3px solid', outlineColor: 'primary.main', outlineOffset: 4 } }}>
              <Box sx={{ display: 'grid', placeItems: 'center', width: 44, height: 44, flexShrink: 0, color: 'primary.main', boxShadow: 'var(--neu-inset)', borderRadius: 'var(--shape-sm)' }}><Icon /></Box>
              <Box sx={{ flex: 1, minWidth: 0 }}><Typography component="span" fontWeight={700} sx={{ display: 'block', mb: .5 }}>{title}</Typography><Typography component="span" variant="body2" color="text.secondary">{description}</Typography></Box>
              <OpenInNewRounded sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0 }} />
            </Box>)}
          </Stack>
        </Box>
        <Box component="section" aria-labelledby="agreement-confirmation" sx={{ ...surface, p: { xs: 2.5, sm: 4 }, border: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            {saved ? <CheckCircleOutlineRounded color="success" /> : <FactCheckOutlined color="primary" />}
            <Typography id="agreement-confirmation" component="h2" variant="h5" fontWeight={700}>{saved ? 'You’re up to date' : 'Confirm your agreement'}</Typography>
          </Box>
          {!isAuthenticated ? <>
            <Typography color="text.secondary" sx={{ mb: 3 }}>Sign in to review and save the agreement for your account.</Typography>
            <Button variant="contained" fullWidth component={RouterLink} to="/login" endIcon={<ArrowForwardRounded />}>Sign in to continue</Button>
          </> : saved ? <Alert severity="success">Your agreement has been saved.</Alert> : <Box component="form" onSubmit={event => { event.preventDefault(); if (acceptedTerms && ageConfirmed && !saving) void save() }}>
            <Typography color="text.secondary" sx={{ mb: 2.5 }}>Please read the policies, then confirm both statements to continue publishing and uploading content.</Typography>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <Stack spacing={2} sx={{ mb: 3 }}>
              <FormControlLabel sx={{ m: 0, alignItems: 'flex-start', gap: .5, '& .MuiCheckbox-root': { pt: 0 }, '& .MuiFormControlLabel-label': { fontSize: '.95rem', lineHeight: 1.6 } }} control={<Checkbox disabled={saving} checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} />} label="I agree to the Terms of Use and Acceptable Use Policy and have read the Privacy Notice." />
              <FormControlLabel sx={{ m: 0, alignItems: 'flex-start', gap: .5, '& .MuiCheckbox-root': { pt: 0 }, '& .MuiFormControlLabel-label': { fontSize: '.95rem', lineHeight: 1.6 } }} control={<Checkbox disabled={saving} checked={ageConfirmed} onChange={e => setAgeConfirmed(e.target.checked)} />} label="I confirm that I am at least 18 years old." />
            </Stack>
            <Button type="submit" variant="contained" fullWidth disabled={!acceptedTerms || !ageConfirmed || saving} endIcon={!saving && <ArrowForwardRounded />} aria-busy={saving}>{saving ? 'Saving…' : 'Save agreement'}</Button>
          </Box>}
          <Box sx={{ mt: 3, pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}><TuneRounded sx={{ fontSize: 20, color: 'text.secondary' }} /><Typography variant="subtitle2" fontWeight={700}>Your other choices stay separate</Typography></Stack>
            <Typography variant="body2" color="text.secondary">This agreement does not opt you in to marketing or notifications. You can still read policies, manage eligible funds or request account deletion without accepting.</Typography>
          </Box>
        </Box>
      </Box>
    </Container>
  </Box>
}

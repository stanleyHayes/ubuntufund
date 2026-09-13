import { useState } from 'react'
import { Alert, Box, Button, Checkbox, Container, FormControlLabel, Link, Stack, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import { hasCurrentLegalAcceptance, LEGAL_ACCEPTANCE_VERSION, type LegalAcceptanceRecord } from '@ubuntu-fund/types'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'

export function AccountAgreementNotice() {
  const { user, isAuthenticated } = useAuth()
  if (!isAuthenticated || hasCurrentLegalAcceptance(user?.legalAcceptance)) return null
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
  return <Container maxWidth="sm" sx={{ py: 5 }}><Typography component="h1" variant="h4" fontWeight={700}>Your account agreement</Typography>
    <Typography sx={{ my: 2 }}>Review the rules for using Ujimora and sharing content. Your marketing and notification choices are separate. You can still read policies, manage eligible funds or request deletion without accepting.</Typography>
    <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 2, mb: 3 }}>{[['/terms', 'Terms of Use'], ['/acceptable-use', 'Acceptable Use'], ['/privacy', 'Privacy Notice'], ['/delete-account', 'Delete account']].map(([to, label]) => <Link key={to} component={RouterLink} to={to} target="_blank" rel="noopener noreferrer">{label}</Link>)}</Stack>
    {!isAuthenticated ? <Button component={RouterLink} to="/login">Sign in to review your agreement</Button> : hasCurrentLegalAcceptance(user?.legalAcceptance) ? <Alert severity="success">Your agreement has been saved.</Alert> : <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <FormControlLabel control={<Checkbox checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} />} label="I agree to the Terms of Use and Acceptable Use Policy and have read the Privacy Notice." />
      <FormControlLabel control={<Checkbox checked={ageConfirmed} onChange={e => setAgeConfirmed(e.target.checked)} />} label="I confirm that I am at least 18 years old." />
      <Button variant="contained" disabled={!acceptedTerms || !ageConfirmed || saving} onClick={() => { void save() }}>{saving ? 'Saving…' : 'Save agreement'}</Button>
    </Box>}
  </Container>
}

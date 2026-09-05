import { BrandedTextField as TextField } from '@ubuntu-fund/ui'
import { useState } from 'react'
import { Box, Button, Typography, Alert, CircularProgress } from '@mui/material'
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded'
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded'
import MarkEmailReadRounded from '@mui/icons-material/MarkEmailReadRounded'
import { Link as RouterLink } from 'react-router-dom'
import { api } from '@/lib/api'
import AuthLayout from '@/components/auth/AuthLayout'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError('')
    if (!email.trim()) { setError('Enter your email address.'); return }
    setSubmitting(true)
    try {
      await api.post('/auth/forgot-password', { email: email.trim() })
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send your request. Please try again.')
    } finally { setSubmitting(false) }
  }

  return (
    <AuthLayout recovery>
      {submitted ? <>
        <Box role="status" aria-live="polite">
          <MarkEmailReadRounded sx={{ color: 'secondary.light', fontSize: 42, mb: 2 }} />
          <Typography component="h1" className="admin-auth-title">Check your inbox.</Typography>
          <Typography className="admin-auth-copy">If an account exists for <Box component="strong" sx={{ color: 'text.primary', overflowWrap: 'anywhere' }}>{email.trim()}</Box>, you’ll receive a password reset link shortly.</Typography>
        </Box>
        <Button component={RouterLink} to="/login" variant="contained" fullWidth startIcon={<ArrowBackRounded />}>Back to sign in</Button>
        <Button fullWidth onClick={() => { setSubmitted(false); setError('') }} sx={{ mt: 2 }}>Use a different email</Button>
        <div className="admin-auth-form-note">Check your spam folder if the email hasn’t arrived.</div>
      </> : <>
        <Typography component="h1" className="admin-auth-title">Let’s get you back in.</Typography>
        <Typography className="admin-auth-copy">Enter your administrator email to request a password reset link.</Typography>
        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
        <Box component="form" className="admin-auth-form" onSubmit={handleSubmit} aria-busy={submitting}>
          <TextField label="Email address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth required autoComplete="email" disabled={submitting} />
          <Button type="submit" variant="contained" fullWidth disabled={submitting} endIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <ArrowForwardRounded />}>{submitting ? 'Sending request…' : 'Send reset link'}</Button>
          <Button component={RouterLink} to="/login" startIcon={<ArrowBackRounded />}>Back to sign in</Button>
        </Box>
        <div className="admin-auth-form-note">For your privacy, the response is the same whether or not the email is registered.</div>
      </>}
    </AuthLayout>
  )
}

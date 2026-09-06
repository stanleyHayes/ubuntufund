import { BrandedTextField as TextField, LoadingDots } from '@ubuntu-fund/ui'
import { useState } from 'react'
import { Box, Button, Typography, Alert, InputAdornment, IconButton } from '@mui/material'
import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded'
import { useNavigate, Link as RouterLink } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import AuthLayout from '@/components/auth/AuthLayout'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    setError('')
    if (!email.trim() || !password) { setError('Enter your email address and password.'); return }
    setLoading(true)
    try {
      await login(email.trim(), password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed. Please try again.')
    } finally { setLoading(false) }
  }

  return (
    <AuthLayout>
      <Typography component="h1" className="admin-auth-title">Welcome back.</Typography>
      <Typography className="admin-auth-copy">Sign in to your workspace and pick up where your community needs you.</Typography>
      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      <Box component="form" className="admin-auth-form" onSubmit={handleSubmit} aria-busy={loading}>
        <TextField label="Email address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} fullWidth required autoComplete="username" disabled={loading} />
        <TextField label="Password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} fullWidth required autoComplete="current-password" disabled={loading}
          slotProps={{ input: { endAdornment: <InputAdornment position="end"><IconButton type="button" onClick={() => setShowPassword(!showPassword)} edge="end" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} disabled={loading}>{showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}</IconButton></InputAdornment> } }} />
        <Box sx={{ textAlign: 'right', mt: -1 }}><RouterLink to="/forgot-password" className="admin-auth-link">Forgot password?</RouterLink></Box>
        <Button type="submit" variant="contained" fullWidth disabled={loading} endIcon={loading ? <LoadingDots size={6} /> : <ArrowForwardRounded />}>{loading ? 'Signing in…' : 'Sign in to workspace'}</Button>
      </Box>
      <div className="admin-auth-form-note">Use the email address associated with your administrator account.</div>
    </AuthLayout>
  )
}

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'

// The backend requires 8+ characters (min); the rest are strength boosters that
// make a password meaningfully harder to guess. We surface both — what's
// REQUIRED and what's recommended — so the member always knows what's missing.
export interface PasswordRule {
  label: string
  met: boolean
  required?: boolean
}

function passwordRules(pw: string): PasswordRule[] {
  return [
    { label: 'At least 8 characters', met: pw.length >= 8, required: true },
    { label: 'An uppercase letter (A–Z)', met: /[A-Z]/.test(pw) },
    { label: 'A lowercase letter (a–z)', met: /[a-z]/.test(pw) },
    { label: 'A number (0–9)', met: /\d/.test(pw) },
    { label: 'A symbol (!?@#…)', met: /[^A-Za-z0-9]/.test(pw) },
  ]
}

const LEVELS = [
  { label: 'Too weak', color: '#A5432F' }, // clay
  { label: 'Weak', color: '#A5432F' },
  { label: 'Fair', color: '#C7A24A' }, // gold
  { label: 'Good', color: '#6B8E5A' }, // sage-green
  { label: 'Strong', color: '#2E3D2F' }, // forest
]

function scoreOf(pw: string): number {
  if (!pw) return 0
  const rules = passwordRules(pw)
  let score = rules.filter((r) => r.met).length // 0–5
  if (pw.length >= 12 && score >= 3) score = Math.min(5, score + 1) // length bonus
  // Map 0–6 met-ish signal into 1–4 filled segments.
  return Math.max(1, Math.min(4, score - 1))
}

/**
 * A password strength meter + a live requirements checklist. Renders nothing
 * until the member starts typing, so it never clutters an empty field.
 */
export function PasswordStrength({
  value,
  showChecklist = true,
}: {
  value: string
  showChecklist?: boolean
}) {
  if (!value) return null
  const filled = scoreOf(value) // 1–4
  const level = LEVELS[Math.min(LEVELS.length - 1, filled)]
  const rules = passwordRules(value)

  return (
    <Box sx={{ mt: 1, mb: 0.5 }} aria-live="polite">
      <Box sx={{ display: 'flex', gap: 0.75, mb: 0.75 }}>
        {[0, 1, 2, 3].map((i) => (
          <Box
            key={i}
            sx={{
              flex: 1,
              height: 5,
              borderRadius: 999,
              bgcolor: i < filled ? level.color : 'rgba(46, 61, 47, 0.12)',
              transition: 'background-color 160ms ease',
            }}
          />
        ))}
      </Box>
      <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: level.color, mb: showChecklist ? 1 : 0 }}>
        Password strength: {level.label}
      </Typography>
      {showChecklist && (
        <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, display: 'grid', gap: 0.4 }}>
          {rules.map((r) => (
            <Box
              component="li"
              key={r.label}
              sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: '0.74rem' }}
            >
              {r.met ? (
                <CheckRoundedIcon sx={{ fontSize: 15, color: '#2E7D32' }} />
              ) : (
                <CloseRoundedIcon sx={{ fontSize: 15, color: r.required ? '#A5432F' : 'text.disabled' }} />
              )}
              <Typography
                component="span"
                sx={{
                  fontSize: '0.74rem',
                  color: r.met ? 'text.secondary' : r.required ? '#A5432F' : 'text.secondary',
                  textDecoration: r.met ? 'none' : 'none',
                }}
              >
                {r.label}
                {r.required && !r.met ? ' (required)' : ''}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}

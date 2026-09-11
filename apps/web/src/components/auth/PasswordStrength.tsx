import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import { passwordRules, passwordScore, passwordLevel } from '@ubuntu-fund/types'

// One distinct colour per reachable tier, each clearing AA in both modes.
// `warning.main` is the fill-grade ochre and reaches only 2.7:1 on parchment,
// so the label takes the text-grade token. Good and Strong are split across
// `main` and `dark` — previously both were `success.main`, so the meter showed
// no colour change at all across the top half of the scale.
const LEVEL_COLORS: Record<string, { bar: string; label: string }> = {
  Weak: { bar: 'error.main', label: 'error.main' },
  Fair: { bar: 'warning.dark', label: 'var(--text-warning)' },
  Good: { bar: 'success.main', label: 'success.main' },
  Strong: { bar: 'success.dark', label: 'success.dark' },
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
  const rules = passwordRules(value)
  const filled = passwordScore(value, rules) // 1–4
  const level = passwordLevel(filled)
  const { bar, label } = LEVEL_COLORS[level]

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
              bgcolor: i < filled ? bar : 'action.disabledBackground',
              transition: 'background-color 160ms ease',
              '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
            }}
          />
        ))}
      </Box>
      <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: label, mb: showChecklist ? 1 : 0 }}>
        Password strength: {level}
      </Typography>
      {showChecklist && (
        <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, display: 'grid', gap: 0.4 }}>
          {rules.map((r) => {
            const missing = !r.met && Boolean(r.required)
            return (
              <Box
                component="li"
                key={r.label}
                sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: '0.74rem' }}
              >
                {r.met ? (
                  <CheckRoundedIcon sx={{ fontSize: 15, color: 'success.main' }} />
                ) : (
                  <CloseRoundedIcon
                    sx={{ fontSize: 15, color: missing ? 'error.main' : 'text.disabled' }}
                  />
                )}
                <Typography
                  component="span"
                  sx={{ fontSize: '0.74rem', color: missing ? 'error.main' : 'text.secondary' }}
                >
                  {r.label}
                  {missing ? ' (required)' : ''}
                </Typography>
              </Box>
            )
          })}
        </Box>
      )}
    </Box>
  )
}

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import XIcon from '@mui/icons-material/X'
import FacebookIcon from '@mui/icons-material/Facebook'
import EmailRoundedIcon from '@mui/icons-material/EmailRounded'
import { SHAPE } from '@ubuntu-fund/ui'

const INVITE = 'Join me on Ujimora'

// The https link opens the website, so the code is spelled out for people who
// sign up in the app (its sign-up form has a referral field).
export function referralShareLinks(link: string, code: string) {
  const appLine = `Signing up in the Ujimora app? Enter referral code ${code}.`
  return [
    {
      name: 'WhatsApp',
      icon: WhatsAppIcon,
      color: '#25D366',
      href: `https://wa.me/?text=${encodeURIComponent(`${INVITE}: ${link}\n${appLine}`)}`,
    },
    {
      name: 'X',
      icon: XIcon,
      color: 'text.primary',
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(INVITE)}&url=${encodeURIComponent(link)}`,
    },
    {
      name: 'Facebook',
      icon: FacebookIcon,
      color: '#1877F2',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`,
    },
    {
      name: 'Email',
      icon: EmailRoundedIcon,
      color: 'var(--text-brand)',
      href: `mailto:?subject=${encodeURIComponent(INVITE)}&body=${encodeURIComponent(`${INVITE}: ${link}\r\n${appLine}`)}`,
    },
  ]
}

const labelSx = {
  fontSize: '0.72rem',
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'text.secondary',
  mb: 1,
} as const

export function ReferralShareShortcuts({ link, code }: { link: string; code: string }) {
  return (
    <Box sx={{ mt: 2 }}>
      <Typography sx={labelSx}>Share on</Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, max-content)' },
          gap: 1,
        }}
      >
        {referralShareLinks(link, code).map(({ name, icon: Icon, color, href }) => {
          const external = href.startsWith('https:')
          return (
            <Button
              key={name}
              component="a"
              href={href}
              {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              aria-label={`Share your referral link via ${name}`}
              startIcon={<Icon sx={{ color }} />}
              sx={{
                textTransform: 'none',
                fontFamily: '"Outfit", sans-serif',
                fontWeight: 700,
                fontSize: '0.8rem',
                color: 'text.primary',
                px: 1.75,
                py: 0.75,
                bgcolor: 'var(--neu-surface)',
                boxShadow: 'var(--neu-subtle)',
                transition: 'box-shadow 0.2s ease, transform 0.2s ease',
                '&:hover': { bgcolor: 'var(--neu-surface)', boxShadow: 'var(--neu-raised-hover)', transform: 'translateY(-1px)' },
                '&:active': { boxShadow: 'var(--neu-inset)', transform: 'none' },
                '@media (prefers-reduced-motion: reduce)': { transition: 'none', '&:hover': { transform: 'none' } },
              }}
            >
              {name}
            </Button>
          )
        })}
      </Box>
    </Box>
  )
}

export function ReferralHowItWorks({ code }: { code: string }) {
  const steps = [
    {
      title: 'Share your link',
      body: `People who sign up through it become your referrals. In the app, they can enter code ${code}.`,
    },
    {
      title: 'They buy a plan',
      body: 'You earn a one-time commission when a referral buys their first paid plan on the Ujimora website.',
    },
    {
      title: 'Withdraw',
      body: 'Commission becomes available after its hold window. Then request a payout.',
    },
  ]
  return (
    <Box sx={{ mt: 3 }}>
      <Typography sx={labelSx}>How it works</Typography>
      <Box
        component="ol"
        role="list"
        sx={{
          listStyle: 'none',
          m: 0,
          p: 0,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
          gap: { xs: 1.5, sm: 2 },
        }}
      >
        {steps.map((step, i) => (
          <Box component="li" key={step.title} sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
            <Box
              aria-hidden
              sx={{
                width: 26,
                height: 26,
                flexShrink: 0,
                borderRadius: SHAPE.sm,
                bgcolor: 'var(--neu-surface)',
                boxShadow: 'var(--neu-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: '"Outfit", sans-serif',
                fontWeight: 800,
                fontSize: '0.75rem',
                color: 'var(--text-brand)',
              }}
            >
              {i + 1}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', lineHeight: 1.3 }}>{step.title}</Typography>
              <Typography sx={{ fontSize: '0.74rem', color: 'text.secondary', mt: 0.25, lineHeight: 1.45, overflowWrap: 'anywhere' }}>
                {step.body}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

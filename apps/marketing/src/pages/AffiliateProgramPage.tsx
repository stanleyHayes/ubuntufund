import { MarketingFacts } from '../components/MarketingFacts'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import LoyaltyRoundedIcon from '@mui/icons-material/LoyaltyRounded'
import PercentRoundedIcon from '@mui/icons-material/PercentRounded'
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded'
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded'
import PersonAddAlt1RoundedIcon from '@mui/icons-material/PersonAddAlt1Rounded'
import ShareRoundedIcon from '@mui/icons-material/ShareRounded'
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded'
import LinkRoundedIcon from '@mui/icons-material/LinkRounded'
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded'
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded'
import PublicRoundedIcon from '@mui/icons-material/PublicRounded'
import VolunteerActivismRoundedIcon from '@mui/icons-material/VolunteerActivismRounded'
import { keyframes } from '@mui/material/styles'
import { NEUMORPHIC_FOREST_VARS, SHAPE } from '@ubuntu-fund/ui'
import { InternalPageHero } from '../components/InternalPageHero'

// ─── Animations ──────────────────────────────────────────────────────────────

const fadeSlide = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
`


const float = keyframes`
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-8px) rotate(1deg); }
`


// ─── Data ────────────────────────────────────────────────────────────────────

const STATS = [
  { value: '10%', label: 'Referral commission', icon: <PercentRoundedIcon /> },
  { value: 'One-time', label: 'Per referred member', icon: <LoyaltyRoundedIcon /> },
  { value: 'GHS', label: 'Payouts', icon: <AccountBalanceWalletRoundedIcon /> },
  { value: '14-day', label: 'Clearance window', icon: <ScheduleRoundedIcon /> },
]

const STEPS = [
  {
    icon: <PersonAddAlt1RoundedIcon />,
    step: '01',
    title: 'Enrol and get your link',
    description:
      'Create a free Ujimora account, open the affiliate dashboard, and generate a referral link that is uniquely tied to you — no application forms, no waiting.',
    color: '#2E3D2F',
  },
  {
    icon: <ShareRoundedIcon />,
    step: '02',
    title: 'Share it with your community',
    description:
      'Send your link to WhatsApp groups, church and association networks, alumni circles, and the diaspora — anyone raising for a cause or ready to back one.',
    color: '#C7A24A',
  },
  {
    icon: <PaymentsRoundedIcon />,
    step: '03',
    title: 'Earn when they subscribe',
    description:
      'When someone who joined through your link upgrades to a paid Ujimora plan, a 10% commission is recorded automatically and tracked in your dashboard.',
    color: '#C75B39',
  },
]

const BENEFITS = [
  {
    icon: <LinkRoundedIcon />,
    title: 'Your own referral link',
    description: 'A unique, trackable link tied to your account. Every sign-up and paid conversion is attributed to you automatically.',
    color: '#2E3D2F',
  },
  {
    icon: <InsightsRoundedIcon />,
    title: 'Real-time dashboard',
    description: 'Watch your referrals, pending commissions, and available balance update as your network grows.',
    color: '#1565C0',
  },
  {
    icon: <AccountBalanceWalletRoundedIcon />,
    title: 'Choose your payout destination',
    description: 'Register a payout destination and request your available balance in Ghana Cedis once commissions clear review.',
    color: '#C7A24A',
  },
  {
    icon: <VerifiedUserRoundedIcon />,
    title: 'Transparent by design',
    description: 'See exactly how each commission was calculated — real figures from settled subscriptions, never invented counters.',
    color: '#6A1B9A',
  },
  {
    icon: <PublicRoundedIcon />,
    title: 'Built for how Africa shares',
    description: 'Mobile-first links made to travel across WhatsApp, SMS, and social — the channels your community already uses every day.',
    color: '#C75B39',
  },
  {
    icon: <VolunteerActivismRoundedIcon />,
    title: 'Free to join, no cap',
    description: 'Enrolment costs nothing and is open to every Ujimora member. Refer as many people as you like.',
    color: '#00695C',
  },
]

const FAQS = [
  {
    question: 'Who can join the affiliate program?',
    answer:
      'Any Ujimora member with an account can enrol for free from the affiliate dashboard. It is open to individuals, creators, and community organisers alike — you do not need a large following to take part.',
  },
  {
    question: 'How much can I earn?',
    answer:
      'You earn a 10% commission on the first paid subscription of each member who joins Ujimora through your referral link. There is no limit on how many people you can refer.',
  },
  {
    question: 'When does a commission count?',
    answer:
      'A commission is recorded the one time a referred member first upgrades to a paid Ujimora plan. Later renewals or additional plans from the same person do not create new commissions — the reward is for bringing a new paying member on board.',
  },
  {
    question: 'Why is there a hold before I can withdraw?',
    answer:
      'New commissions are held for 14 days before they become available. This short window lets us account for refunds so your balance reflects settled earnings only. If a referred member is refunded within that time, the related commission is reversed.',
  },
  {
    question: 'How do I get paid?',
    answer:
      'Once a commission clears the 14-day hold it moves to your available balance. Register a payout destination in your dashboard and request a payout in Ghana Cedis.',
  },
  {
    question: 'Can I start referring today?',
    answer:
      'Yes. Enrol and start sharing your link straight away so every future sign-up is attributed to you. Commissions accrue as referred members take up paid plans, and everything is tracked from the moment your link goes out.',
  },
]

// ─── Component ───────────────────────────────────────────────────────────────

function AffiliateProgramPage() {
  const WEB_APP_URL = import.meta.env.VITE_WEB_APP_URL || 'https://app.ujimora.com'

  return (
    <Box component="main" sx={{ flex: 1 }}>
      <InternalPageHero
        eyebrow="Affiliate program"
        title="Turn your network into lasting impact"
        description="Share Ujimora with the causes and creators around you. When someone you refer upgrades to a paid plan, you earn a commission paid to your registered payout destination."
        icon={<LoyaltyRoundedIcon />}
        panelLabel="How you earn"
        panelTitle="A one-time 10% commission on every referred member's first paid subscription."
        panelBody="Commissions settle in Ghana Cedis after a short review window."
        primaryAction={{ label: 'Join the program', href: `${WEB_APP_URL}/register` }}
        secondaryAction={{ label: 'Affiliate dashboard', href: `${WEB_APP_URL}/affiliate` }}
      />

      <MarketingFacts items={STATS} label="Affiliate program at a glance" />

      {/* ═══ How it works — 3 steps ═══ */}
      <Box sx={{ py: { xs: 7, md: 10 }, position: 'relative', overflow: 'hidden' }}>
        <Box sx={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(46, 61, 47,0.03), transparent 70%)', top: -200, right: -100, pointerEvents: 'none' }} />
        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ textAlign: 'center', mb: 6, animation: `${fadeSlide} 0.4s ease both` }}>
            <Chip label="How it works" size="small" sx={{ mb: 2, bgcolor: 'rgba(46, 61, 47,0.08)', color: 'primary.dark', fontWeight: 700, fontSize: '0.72rem', letterSpacing: 1, textTransform: 'uppercase' }} />
            <Typography variant="h3" sx={{ fontWeight: 900, mb: 1, fontSize: { xs: '1.8rem', md: '2.4rem' } }}>
              Three steps to your first <Box component="span" sx={{ color: 'primary.main' }}>commission</Box>
            </Typography>
            <Typography sx={{ color: 'text.secondary', maxWidth: 520, mx: 'auto', fontSize: '1.02rem', lineHeight: 1.7 }}>
              Sharing Ujimora is simple — and every link you send is working for you from the start.
            </Typography>
          </Box>

          <Grid container spacing={3}>
            {STEPS.map((s, i) => (
              <Grid size={{ xs: 12, md: 4 }} key={s.step}>
                <Card
                  elevation={0}
                  sx={{
                    height: '100%',
                    borderRadius: SHAPE.card,
                    boxShadow: 'var(--neu-raised)',
                    position: 'relative',
                    overflow: 'hidden',
                    animation: `${fadeSlide} 0.4s ease ${0.05 + i * 0.08}s both`,
                    transition: 'transform 200ms ease, box-shadow 200ms ease',
                    '&:hover': { transform: 'translateY(-3px)', boxShadow: 'var(--neu-raised-hover)' },
                  }}
                >
                  <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${s.color}, transparent)` }} />
                  <CardContent sx={{ p: { xs: 3, md: 3.5 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
                      <Box
                        sx={{
                          width: 52,
                          height: 52,
                          borderRadius: SHAPE.sm,
                          bgcolor: `${s.color}10`,
                          color: s.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          '& svg': { fontSize: 26 },
                        }}
                      >
                        {s.icon}
                      </Box>
                      <Typography sx={{ fontWeight: 900, fontSize: '2.4rem', color: `${s.color}22`, lineHeight: 1 }}>{s.step}</Typography>
                    </Box>
                    <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', mb: 1 }}>{s.title}</Typography>
                    <Typography sx={{ fontSize: '0.88rem', color: 'text.secondary', lineHeight: 1.7 }}>{s.description}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ═══ Why join — Benefits grid ═══ */}
      <Box sx={{ py: { xs: 7, md: 10 }, bgcolor: 'background.default' }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Chip label="Why join" size="small" sx={{ mb: 2, bgcolor: 'rgba(21,101,192,0.08)', color: '#1565C0', fontWeight: 700, fontSize: '0.72rem', letterSpacing: 1, textTransform: 'uppercase' }} />
            <Typography variant="h3" sx={{ fontWeight: 900, mb: 1, fontSize: { xs: '1.8rem', md: '2.4rem' } }}>
              Everything you need to <Box component="span" sx={{ color: 'primary.main' }}>refer with confidence</Box>
            </Typography>
            <Typography sx={{ color: 'text.secondary', maxWidth: 520, mx: 'auto', fontSize: '1.02rem' }}>
              A clear link, honest tracking, and payouts you can rely on — the same standards Ujimora holds for every campaign.
            </Typography>
          </Box>

          <Grid container spacing={2.5}>
            {BENEFITS.map((b, i) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={b.title}>
                <Card
                  elevation={0}
                  sx={{
                    height: '100%',
                    borderRadius: SHAPE.card,
                    boxShadow: 'var(--neu-raised)',
                    position: 'relative',
                    overflow: 'visible',
                    animation: `${fadeSlide} 0.4s ease ${0.05 + i * 0.04}s both`,
                    transition: 'border-color 200ms ease',
                    '&:hover': {
                      borderColor: `${b.color}40`,
                      '& .benefit-icon': { bgcolor: b.color, color: '#fff' },
                    },
                  }}
                >
                  <Box sx={{ position: 'absolute', top: 16, left: 0, width: 3, height: 32, borderRadius: SHAPE.bar, bgcolor: b.color }} />
                  <CardContent sx={{ p: 3 }}>
                    <Box
                      className="benefit-icon"
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: SHAPE.sm,
                        bgcolor: `${b.color}10`,
                        color: b.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mb: 2,
                        transition: 'background-color 200ms ease, color 200ms ease',
                        '& svg': { fontSize: 22 },
                      }}
                    >
                      {b.icon}
                    </Box>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', mb: 0.75, lineHeight: 1.3 }}>{b.title}</Typography>
                    <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary', lineHeight: 1.65 }}>{b.description}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ═══ FAQ ═══ */}
      <Box sx={{ py: { xs: 7, md: 10 }, position: 'relative', overflow: 'hidden' }}>
        <Box sx={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(199, 162, 74,0.04), transparent 70%)', bottom: -200, left: -100, pointerEvents: 'none' }} />
        <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Chip label="Questions" size="small" sx={{ mb: 2, bgcolor: 'rgba(199,91,57,0.08)', color: '#C75B39', fontWeight: 700, fontSize: '0.72rem', letterSpacing: 1, textTransform: 'uppercase' }} />
            <Typography variant="h3" sx={{ fontWeight: 900, fontSize: { xs: '1.8rem', md: '2.4rem' } }}>
              Frequently asked <Box component="span" sx={{ color: 'primary.main' }}>questions</Box>
            </Typography>
          </Box>

          {FAQS.map((faq) => (
            <Accordion
              key={faq.question}
              elevation={0}
              sx={{
                boxShadow: 'var(--neu-raised)',
                mb: 1.5,
                '&:before': { display: 'none' },
                borderRadius: SHAPE.sm,
                '&.Mui-expanded': { mb: 1.5 },
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>{faq.question}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                  {faq.answer}
                </Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Container>
      </Box>

      {/* ═══ CTA — Immersive ═══ */}
      <Box
        sx={{
          ...NEUMORPHIC_FOREST_VARS,
          py: { xs: 10, md: 14 },
          background: 'linear-gradient(135deg, #0d1a0f 0%, #1C261D 50%, #0d1a0f 100%)',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ position: 'absolute', inset: 0, opacity: 0.04, backgroundImage: 'repeating-linear-gradient(90deg, #C7A24A 0px, #C7A24A 3px, transparent 3px, transparent 18px), repeating-linear-gradient(0deg, #C75B39 0px, #C75B39 3px, transparent 3px, transparent 18px)', pointerEvents: 'none' }} />
        <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(46, 61, 47,0.15), transparent 70%)', pointerEvents: 'none' }} />

        <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ animation: `${float} 6s ease infinite`, mb: 3 }}>
            <Box
              sx={{
                width: 72,
                height: 72,
                borderRadius: SHAPE.sm,
                background: 'linear-gradient(135deg, rgba(199, 162, 74,0.15), rgba(199, 162, 74,0.05))',
                border: '1px solid rgba(199, 162, 74,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
              }}
            >
              <LoyaltyRoundedIcon sx={{ fontSize: 36, color: '#C7A24A' }} />
            </Box>
          </Box>
          <Typography
            variant="h3"
            sx={{
              fontWeight: 900,
              color: '#fff',
              mb: 2,
              fontSize: { xs: '1.8rem', md: '2.6rem' },
              lineHeight: 1.15,
              animation: `${fadeSlide} 0.5s ease 0.1s both`,
            }}
          >
            Start earning while you{' '}
            <Box component="span" sx={{ color: '#DCC07E' }}>
              grow the movement
            </Box>
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.6)', mb: 5, fontSize: '1.05rem', lineHeight: 1.7, animation: `${fadeSlide} 0.5s ease 0.2s both` }}>
            Enrol in minutes, share your link, and turn the trust you already have in your community into commission — and more causes funded across Africa.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center" sx={{ animation: `${fadeSlide} 0.5s ease 0.3s both` }}>
            <Button
              variant="contained"
              color="secondary"
              size="large"
              endIcon={<ArrowForwardRoundedIcon />}
              href={`${WEB_APP_URL}/register`}
              sx={{ py: 1.5, px: 4, fontWeight: 700, fontSize: '0.95rem', borderRadius: SHAPE.sm }}
            >
              Join the affiliate program
            </Button>
            <Button
              variant="outlined"
              size="large"
              href="/contact"
              sx={{
                py: 1.5,
                px: 4,
                fontWeight: 700,
                fontSize: '0.95rem',
                borderRadius: SHAPE.sm,
                borderColor: 'rgba(255,255,255,0.2)',
                borderWidth: 1.5,
                color: '#fff',
                transition: 'border-color 200ms ease, background-color 200ms ease',
                '&:hover': { borderColor: 'rgba(255,255,255,0.5)', bgcolor: 'rgba(255,255,255,0.06)' },
              }}
            >
              Talk to our team
            </Button>
          </Stack>
        </Container>
      </Box>
    </Box>
  )
}

export default AffiliateProgramPage

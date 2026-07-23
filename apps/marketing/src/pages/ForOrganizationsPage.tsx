import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Avatar from '@mui/material/Avatar'
import Divider from '@mui/material/Divider'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded'
import PaletteRoundedIcon from '@mui/icons-material/PaletteRounded'
import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded'
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded'
import SyncRoundedIcon from '@mui/icons-material/SyncRounded'
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded'
import ApiRoundedIcon from '@mui/icons-material/ApiRounded'
import SupportAgentRoundedIcon from '@mui/icons-material/SupportAgentRounded'
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded'
import VolunteerActivismRoundedIcon from '@mui/icons-material/VolunteerActivismRounded'
import PublicRoundedIcon from '@mui/icons-material/PublicRounded'
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded'
import FormatQuoteRoundedIcon from '@mui/icons-material/FormatQuoteRounded'
import StarRoundedIcon from '@mui/icons-material/StarRounded'
import { keyframes } from '@mui/material/styles'
import { SHAPE } from '@ubuntu-fund/ui'

// ─── Animations ──────────────────────────────────────────────────────────────

const fadeSlide = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
`

const countIn = keyframes`
  from { opacity: 0; transform: scale(0.5); }
  to   { opacity: 1; transform: scale(1); }
`

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`

const float = keyframes`
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-8px) rotate(1deg); }
`

const pulse = keyframes`
  0%, 100% { opacity: 0.06; }
  50% { opacity: 0.14; }
`

// ─── Data (unchanged) ────────────────────────────────────────────────────────

const FEATURES = [
  { icon: <DashboardRoundedIcon />, title: 'Organization Dashboard', description: 'A dedicated control center for your team with role-based access, campaign management, and real-time analytics.', color: '#2E7D32' },
  { icon: <PaletteRoundedIcon />, title: 'Branded Campaign Pages', description: 'Customize campaigns with your logo, colors, and brand story. Your campaigns, your identity.', color: '#1565C0' },
  { icon: <BarChartRoundedIcon />, title: 'Advanced Analytics', description: 'Track donor demographics, campaign performance, conversion rates, and generate exportable reports.', color: '#F9A825' },
  { icon: <ReceiptLongRoundedIcon />, title: 'Automated Tax Receipts', description: 'Generate and send tax-compliant receipts automatically. Stay compliant in every country you operate.', color: '#C75B39' },
  { icon: <SyncRoundedIcon />, title: 'Recurring Donations', description: 'Enable monthly giving plans with automatic processing, donor retention tools, and smart reminders.', color: '#6A1B9A' },
  { icon: <VerifiedUserRoundedIcon />, title: 'Priority Verification', description: 'Fast-track trust verification with dedicated review, enhanced badges, and institutional endorsement.', color: '#00695C' },
  { icon: <ApiRoundedIcon />, title: 'API & Integrations', description: 'Connect UbuntuFund to your CRM, website, or payment systems with our RESTful API and webhooks.', color: '#424242' },
  { icon: <SupportAgentRoundedIcon />, title: 'Dedicated Support', description: 'A named account manager, priority email/phone support, and quarterly strategy review sessions.', color: '#AD1457' },
]

const ORG_TYPES = [
  { emoji: '🏥', label: 'Hospitals & Clinics' }, { emoji: '🎓', label: 'Schools & Universities' },
  { emoji: '🕌', label: 'Religious Institutions' }, { emoji: '🌍', label: 'NGOs & Nonprofits' },
  { emoji: '🏛️', label: 'Government Bodies' }, { emoji: '💼', label: 'Social Enterprises' },
  { emoji: '🎭', label: 'Arts & Culture' }, { emoji: '⚽', label: 'Sports Organizations' },
]

const STATS = [
  { value: '2,500+', label: 'Organizations', icon: <GroupsRoundedIcon />, color: '#2E7D32' },
  { value: '$8.2M', label: 'Raised for Orgs', icon: <VolunteerActivismRoundedIcon />, color: '#F9A825' },
  { value: '32', label: 'Countries', icon: <PublicRoundedIcon />, color: '#C75B39' },
  { value: '99.9%', label: 'Uptime SLA', icon: <SecurityRoundedIcon />, color: '#6A1B9A' },
]

const TESTIMONIALS = [
  { quote: 'UbuntuFund transformed how we connect with donors. Our monthly giving increased 340% in the first year.', name: 'Dr. Amina Osei', role: 'Director, Maji Foundation', org: 'Water & Sanitation NGO, Kenya', initials: 'AO', color: '#2E7D32', stat: '+340%', statLabel: 'Monthly giving' },
  { quote: 'The branded campaign pages and automated receipts saved our team hundreds of hours. It just works.', name: 'Pastor James Mensah', role: 'Administrator, Grace Cathedral', org: 'Religious Institution, Ghana', initials: 'JM', color: '#F9A825', stat: '400hrs', statLabel: 'Saved yearly' },
  { quote: 'We integrated UbuntuFund with our existing systems in days. The API is clean and well-documented.', name: 'Chidi Eze', role: 'CTO, Lagos Emergency Response', org: 'Medical NGO, Nigeria', initials: 'CE', color: '#C75B39', stat: '3 days', statLabel: 'To integrate' },
]

const PRICING_TIERS = [
  { name: 'Starter', price: 'Free', period: '', description: 'For small organizations getting started', features: ['Up to 5 active campaigns', 'Basic analytics', 'Email support', 'Standard verification'], cta: 'Get Started', highlighted: false },
  { name: 'Growth', price: '$49', period: '/month', description: 'For growing organizations with active fundraising', features: ['Unlimited campaigns', 'Advanced analytics & exports', 'Branded campaign pages', 'Priority verification', 'Recurring donations', 'Priority support'], cta: 'Start Free Trial', highlighted: true },
  { name: 'Enterprise', price: 'Custom', period: '', description: 'For large institutions with complex needs', features: ['Everything in Growth', 'API access & webhooks', 'Dedicated account manager', 'Custom integrations', 'SLA guarantee', 'Multi-team management'], cta: 'Contact Sales', highlighted: false },
]

// ─── Component ───────────────────────────────────────────────────────────────

function ForOrganizationsPage() {
  const WEB_APP_URL = import.meta.env.VITE_WEB_APP_URL || 'http://localhost:8200'

  return (
    <Box component="main" sx={{ flex: 1 }}>

      {/* ═══ Stats — Full-bleed dark strip ═══ */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #121218 0%, #1a1a28 100%)',
          py: { xs: 5, md: 6 },
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative grid */}
        <Box sx={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(76,175,80,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(76,175,80,0.03) 1px, transparent 1px)', backgroundSize: '60px 60px', pointerEvents: 'none', animation: `${pulse} 6s ease infinite` }} />
        {/* Glow orbs */}
        <Box sx={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(46,125,50,0.08), transparent 70%)', top: -200, left: '10%', pointerEvents: 'none' }} />
        <Box sx={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(249,168,37,0.06), transparent 70%)', bottom: -150, right: '15%', pointerEvents: 'none' }} />

        <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1 }}>
          <Grid container spacing={3}>
            {STATS.map((stat, i) => (
              <Grid size={{ xs: 6, sm: 3 }} key={stat.label}>
                <Box
                  sx={{
                    textAlign: 'center',
                    animation: `${countIn} 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 0.1}s both`,
                  }}
                >
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      borderRadius: SHAPE.sm,
                      background: `linear-gradient(135deg, ${stat.color}20, ${stat.color}08)`,
                      border: `1px solid ${stat.color}25`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 2,
                      color: stat.color,
                      '& svg': { fontSize: 26 },
                    }}
                  >
                    {stat.icon}
                  </Box>
                  <Typography
                    sx={{
                      fontWeight: 900,
                      fontSize: { xs: '1.6rem', md: '2rem' },
                      color: '#fff',
                      lineHeight: 1,
                      mb: 0.5,
                      background: `linear-gradient(135deg, ${stat.color}, #fff)`,
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    {stat.value}
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                    {stat.label}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ═══ Who Is This For — Horizontal scroll feel ═══ */}
      <Box sx={{ py: { xs: 7, md: 10 }, position: 'relative', overflow: 'hidden' }}>
        <Box sx={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(46,125,50,0.03), transparent 70%)', top: -200, right: -100, pointerEvents: 'none' }} />
        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ textAlign: 'center', mb: 5, animation: `${fadeSlide} 0.4s ease both` }}>
            <Chip label="Who We Serve" size="small" sx={{ mb: 2, bgcolor: 'rgba(46,125,50,0.08)', color: 'primary.dark', fontWeight: 700, fontSize: '0.72rem', letterSpacing: 1, textTransform: 'uppercase' }} />
            <Typography variant="h3" sx={{ fontWeight: 900, mb: 1, fontSize: { xs: '1.8rem', md: '2.4rem' } }}>
              Built for Every <Box component="span" sx={{ color: 'primary.main' }}>Organization</Box>
            </Typography>
            <Typography sx={{ color: 'text.secondary', maxWidth: 480, mx: 'auto', fontSize: '1.02rem', lineHeight: 1.7 }}>
              From grassroots NGOs to national institutions — tools that scale with your mission.
            </Typography>
          </Box>
          <Grid container spacing={2} justifyContent="center">
            {ORG_TYPES.map((type, i) => (
              <Grid size={{ xs: 6, sm: 4, md: 3 }} key={type.label}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 2,
                    borderRadius: SHAPE.card,
                    border: '1px solid',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                    animation: `${fadeSlide} 0.35s ease ${i * 0.04}s both`,
                    transition: 'all 0.25s cubic-bezier(0.22, 1, 0.36, 1)',
                    cursor: 'default',
                    '&:hover': {
                      borderColor: 'primary.main',
                      bgcolor: 'rgba(46,125,50,0.03)',
                      transform: 'translateY(-3px)',
                      boxShadow: '0 6px 20px rgba(46,125,50,0.08)',
                    },
                  }}
                >
                  <Typography sx={{ fontSize: '1.5rem', lineHeight: 1 }}>{type.emoji}</Typography>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.88rem' }}>{type.label}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ═══ Features — Alternating 2-col layout ═══ */}
      <Box sx={{ py: { xs: 7, md: 10 }, bgcolor: '#f8faf8' }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Chip label="Platform" size="small" sx={{ mb: 2, bgcolor: 'rgba(21,101,192,0.08)', color: '#1565C0', fontWeight: 700, fontSize: '0.72rem', letterSpacing: 1, textTransform: 'uppercase' }} />
            <Typography variant="h3" sx={{ fontWeight: 900, mb: 1, fontSize: { xs: '1.8rem', md: '2.4rem' } }}>
              Enterprise-Grade <Box component="span" sx={{ color: 'primary.main' }}>Features</Box>
            </Typography>
            <Typography sx={{ color: 'text.secondary', maxWidth: 520, mx: 'auto', fontSize: '1.02rem' }}>
              Everything you need to run professional fundraising campaigns at scale.
            </Typography>
          </Box>

          {/* Two rows of 4 — each card has a tall left-accent stripe */}
          <Grid container spacing={2.5}>
            {FEATURES.map((feature, i) => (
              <Grid size={{ xs: 12, sm: 6, md: 3 }} key={feature.title}>
                <Card
                  elevation={0}
                  sx={{
                    height: '100%',
                    borderRadius: SHAPE.card,
                    border: '1px solid',
                    borderColor: 'divider',
                    position: 'relative',
                    overflow: 'visible',
                    animation: `${fadeSlide} 0.4s ease ${0.05 + i * 0.04}s both`,
                    transition: 'all 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
                    '&:hover': {
                      transform: 'translateY(-6px)',
                      boxShadow: `0 12px 32px ${feature.color}12`,
                      borderColor: `${feature.color}40`,
                      '& .feat-icon': {
                        transform: 'scale(1.15) rotate(-5deg)',
                        bgcolor: feature.color,
                        color: '#fff',
                        boxShadow: `0 4px 16px ${feature.color}30`,
                      },
                    },
                  }}
                >
                  {/* Accent bar */}
                  <Box sx={{ position: 'absolute', top: 16, left: 0, width: 3, height: 32, borderRadius: SHAPE.bar, bgcolor: feature.color }} />
                  <CardContent sx={{ p: 3 }}>
                    <Box
                      className="feat-icon"
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: SHAPE.sm,
                        bgcolor: `${feature.color}10`,
                        color: feature.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mb: 2,
                        transition: 'all 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
                        '& svg': { fontSize: 22 },
                      }}
                    >
                      {feature.icon}
                    </Box>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.92rem', mb: 0.75, lineHeight: 1.3 }}>{feature.title}</Typography>
                    <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', lineHeight: 1.65 }}>{feature.description}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ═══ Testimonials — Magazine-style with pull-quote + stat ═══ */}
      <Box sx={{ py: { xs: 7, md: 10 }, position: 'relative', overflow: 'hidden' }}>
        <Box sx={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(249,168,37,0.04), transparent 70%)', bottom: -200, left: -100, pointerEvents: 'none' }} />
        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Chip label="Social Proof" size="small" sx={{ mb: 2, bgcolor: 'rgba(199,91,57,0.08)', color: '#C75B39', fontWeight: 700, fontSize: '0.72rem', letterSpacing: 1, textTransform: 'uppercase' }} />
            <Typography variant="h3" sx={{ fontWeight: 900, fontSize: { xs: '1.8rem', md: '2.4rem' } }}>
              Trusted by Leaders Across <Box component="span" sx={{ color: 'primary.main' }}>Africa</Box>
            </Typography>
          </Box>

          <Grid container spacing={3}>
            {TESTIMONIALS.map((t, i) => (
              <Grid size={{ xs: 12, md: 4 }} key={t.name}>
                <Card
                  elevation={0}
                  sx={{
                    height: '100%',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: SHAPE.card,
                    animation: `${fadeSlide} 0.45s ease ${0.1 + i * 0.1}s both`,
                    transition: 'all 0.3s ease',
                    '&:hover': { borderColor: `${t.color}50`, boxShadow: `0 8px 24px ${t.color}10` },
                  }}
                >
                  <CardContent sx={{ p: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
                    {/* Impact stat strip */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        px: 3,
                        py: 2,
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        background: `linear-gradient(135deg, ${t.color}06, transparent)`,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <StarRoundedIcon sx={{ fontSize: 16, color: t.color }} />
                        <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                          {t.statLabel}
                        </Typography>
                      </Box>
                      <Typography sx={{ fontWeight: 900, fontSize: '1.1rem', color: t.color }}>
                        {t.stat}
                      </Typography>
                    </Box>

                    {/* Quote */}
                    <Box sx={{ flex: 1, px: 3, pt: 2.5, pb: 2 }}>
                      <FormatQuoteRoundedIcon sx={{ fontSize: 28, color: t.color, opacity: 0.3, mb: 1 }} />
                      <Typography sx={{ fontSize: '0.92rem', color: 'text.primary', lineHeight: 1.75, fontStyle: 'italic' }}>
                        {t.quote}
                      </Typography>
                    </Box>

                    {/* Author */}
                    <Box sx={{ px: 3, pb: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Avatar sx={{ width: 42, height: 42, bgcolor: t.color, fontWeight: 700, fontSize: '0.88rem' }}>{t.initials}</Avatar>
                      <Box>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', lineHeight: 1.3 }}>{t.name}</Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1.3 }}>{t.role}</Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ═══ Pricing — Elevated center card ═══ */}
      <Box
        sx={{
          py: { xs: 7, md: 10 },
          background: 'linear-gradient(180deg, #f8faf8 0%, #fff 100%)',
          position: 'relative',
        }}
      >
        <Container maxWidth="md">
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Chip label="Pricing" size="small" sx={{ mb: 2, bgcolor: 'rgba(106,27,154,0.08)', color: '#6A1B9A', fontWeight: 700, fontSize: '0.72rem', letterSpacing: 1, textTransform: 'uppercase' }} />
            <Typography variant="h3" sx={{ fontWeight: 900, mb: 1, fontSize: { xs: '1.8rem', md: '2.4rem' } }}>
              Simple, Transparent <Box component="span" sx={{ color: 'primary.main' }}>Pricing</Box>
            </Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: '1.02rem' }}>Start free. Scale as you grow.</Typography>
          </Box>

          <Grid container spacing={3} alignItems="center">
            {PRICING_TIERS.map((tier, i) => (
              <Grid size={{ xs: 12, md: 4 }} key={tier.name}>
                <Card
                  elevation={0}
                  sx={{
                    border: '1px solid',
                    borderColor: tier.highlighted ? 'primary.main' : 'divider',
                    borderRadius: SHAPE.card,
                    position: 'relative',
                    overflow: 'visible',
                    animation: `${fadeSlide} 0.4s ease ${0.15 + i * 0.08}s both`,
                    transition: 'all 0.3s cubic-bezier(0.22, 1, 0.36, 1)',
                    ...(tier.highlighted && {
                      transform: { md: 'scale(1.05)' },
                      zIndex: 2,
                      boxShadow: '0 16px 48px rgba(46,125,50,0.15)',
                      borderWidth: 2,
                    }),
                    '&:hover': {
                      transform: tier.highlighted ? { md: 'scale(1.07)' } : 'translateY(-6px)',
                      boxShadow: tier.highlighted ? '0 20px 56px rgba(46,125,50,0.2)' : '0 12px 32px rgba(0,0,0,0.08)',
                    },
                  }}
                >
                  {tier.highlighted && (
                    <Chip
                      label="Most Popular"
                      size="small"
                      sx={{
                        position: 'absolute',
                        top: -14,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        bgcolor: 'primary.main',
                        color: '#fff',
                        fontWeight: 700,
                        fontSize: '0.72rem',
                        px: 1,
                        height: 28,
                      }}
                    />
                  )}
                  <CardContent sx={{ p: { xs: 3, md: 3.5 }, display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', mb: 1, color: 'text.secondary' }}>{tier.name}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, mb: 0.5 }}>
                      <Typography sx={{ fontWeight: 900, fontSize: '2.2rem', color: 'text.primary', lineHeight: 1 }}>{tier.price}</Typography>
                      {tier.period && <Typography sx={{ color: 'text.secondary', fontSize: '0.88rem' }}>{tier.period}</Typography>}
                    </Box>
                    <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary', mb: 3 }}>{tier.description}</Typography>
                    <Divider sx={{ mb: 2.5 }} />
                    <Stack spacing={1.5} sx={{ flex: 1, mb: 3 }}>
                      {tier.features.map((f) => (
                        <Box key={f} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                          <CheckCircleRoundedIcon sx={{ fontSize: 18, color: 'primary.main', mt: '2px', flexShrink: 0 }} />
                          <Typography sx={{ fontSize: '0.85rem', lineHeight: 1.4 }}>{f}</Typography>
                        </Box>
                      ))}
                    </Stack>
                    <Button
                      variant={tier.highlighted ? 'contained' : 'outlined'}
                      color="primary"
                      fullWidth
                      sx={{
                        borderRadius: SHAPE.sm,
                        py: 1.4,
                        fontWeight: 700,
                        textTransform: 'none',
                        fontSize: '0.92rem',
                        ...(tier.highlighted && { boxShadow: '0 4px 16px rgba(46,125,50,0.25)' }),
                      }}
                    >
                      {tier.cta}
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ═══ CTA — Immersive ═══ */}
      <Box
        sx={{
          py: { xs: 10, md: 14 },
          background: 'linear-gradient(135deg, #0d1a0f 0%, #1B5E20 50%, #0d1a0f 100%)',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Kente weave */}
        <Box sx={{ position: 'absolute', inset: 0, opacity: 0.04, backgroundImage: 'repeating-linear-gradient(90deg, #F9A825 0px, #F9A825 3px, transparent 3px, transparent 18px), repeating-linear-gradient(0deg, #C75B39 0px, #C75B39 3px, transparent 3px, transparent 18px)', pointerEvents: 'none' }} />
        {/* Glow */}
        <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(46,125,50,0.15), transparent 70%)', pointerEvents: 'none' }} />

        <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ animation: `${float} 6s ease infinite`, mb: 3 }}>
            <Box
              sx={{
                width: 72,
                height: 72,
                borderRadius: SHAPE.sm,
                background: 'linear-gradient(135deg, rgba(249,168,37,0.15), rgba(249,168,37,0.05))',
                border: '1px solid rgba(249,168,37,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
              }}
            >
              <GroupsRoundedIcon sx={{ fontSize: 36, color: '#F9A825' }} />
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
            Ready to Supercharge Your{' '}
            <Box
              component="span"
              sx={{
                background: 'linear-gradient(135deg, #F9A825, #FDD835)',
                backgroundSize: '200% auto',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                animation: `${shimmer} 3s ease infinite`,
              }}
            >
              Impact?
            </Box>
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.6)', mb: 5, fontSize: '1.05rem', lineHeight: 1.7, animation: `${fadeSlide} 0.5s ease 0.2s both` }}>
            Join 2,500+ organizations already using UbuntuFund to connect with donors, scale their missions, and transform communities.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center" sx={{ animation: `${fadeSlide} 0.5s ease 0.3s both` }}>
            <Button
              variant="contained"
              color="secondary"
              size="large"
              endIcon={<ArrowForwardRoundedIcon />}
              href={`${WEB_APP_URL}/register?role=organization`}
              sx={{
                py: 1.5,
                px: 4,
                fontWeight: 700,
                fontSize: '0.95rem',
                borderRadius: SHAPE.sm,
                boxShadow: '0 4px 20px rgba(249,168,37,0.3)',
                transition: 'all 0.3s ease',
                '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 8px 28px rgba(249,168,37,0.4)' },
              }}
            >
              Create Organization Account
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
                transition: 'all 0.3s ease',
                '&:hover': { borderColor: 'rgba(255,255,255,0.5)', bgcolor: 'rgba(255,255,255,0.06)', transform: 'translateY(-2px)' },
              }}
            >
              Talk to Sales
            </Button>
          </Stack>
        </Container>
      </Box>
    </Box>
  )
}

export default ForOrganizationsPage

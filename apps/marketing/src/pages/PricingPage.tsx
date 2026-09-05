import { useState } from 'react'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import Alert from '@mui/material/Alert'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { SHAPE } from '@ubuntu-fund/ui'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded'
import { InternalPageHero } from '../components/InternalPageHero'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import {
  SubscriptionTier,
  SUBSCRIPTION_PLANS,
} from '@ubuntu-fund/types'

const TIER_ORDER = [SubscriptionTier.FREE, SubscriptionTier.STARTER, SubscriptionTier.PRO, SubscriptionTier.ENTERPRISE]

const WEB_APP_REGISTER = '/register' // adjust to actual web app URL in production

// ─── Comparison table data ───────────────────────────────────────────────────

interface FeatureRow {
  label: string
  key: keyof (typeof SUBSCRIPTION_PLANS)[SubscriptionTier.FREE]
  format?: 'boolean' | 'fee' | 'goal' | 'unlimited'
}

const FEATURE_SECTIONS: { title: string; rows: FeatureRow[] }[] = [
  {
    title: 'Campaigns',
    rows: [
      { label: 'Active campaigns', key: 'maxActiveCampaigns', format: 'unlimited' },
      { label: 'Max campaign goal', key: 'maxCampaignGoal', format: 'goal' },
      { label: 'Media uploads per campaign', key: 'maxMediaPerCampaign', format: 'unlimited' },
      { label: 'Featured listing', key: 'featuredListing', format: 'boolean' },
    ],
  },
  {
    title: 'Pricing',
    rows: [
      { label: 'Platform fee', key: 'platformFeePercent', format: 'fee' },
    ],
  },
  {
    title: 'Features',
    rows: [
      { label: 'Priority support', key: 'prioritySupport', format: 'boolean' },
      { label: 'Advanced analytics', key: 'advancedAnalytics', format: 'boolean' },
      { label: 'Custom branding', key: 'customBranding', format: 'boolean' },
      { label: 'Escrow & milestones', key: 'escrowSupport', format: 'boolean' },
      { label: 'Live streaming', key: 'liveStreaming', format: 'boolean' },
    ],
  },
  {
    title: 'Team',
    rows: [
      { label: 'Team members', key: 'maxTeamMembers', format: 'unlimited' },
      { label: 'Campaign collaboration', key: 'campaignCollaboration', format: 'boolean' },
      { label: 'Collaborators per campaign', key: 'maxCollaboratorsPerCampaign', format: 'unlimited' },
    ],
  },
]

const TIER_ACCENTS: Record<SubscriptionTier, { color: string; bg: string; gradient: string }> = {
  [SubscriptionTier.FREE]: { color: '#78909C', bg: 'rgba(120,144,156,0.05)', gradient: 'linear-gradient(135deg, #90A4AE, #78909C)' },
  [SubscriptionTier.STARTER]: { color: '#1565C0', bg: 'rgba(21,101,192,0.04)', gradient: 'linear-gradient(135deg, #74909A, #1565C0)' },
  [SubscriptionTier.PRO]: { color: '#2E3D2F', bg: 'rgba(46, 61, 47,0.04)', gradient: 'linear-gradient(135deg, #A8B5A0, #2E3D2F)' },
  [SubscriptionTier.ENTERPRISE]: { color: '#6A1B9A', bg: 'rgba(106,27,154,0.04)', gradient: 'linear-gradient(135deg, #AB47BC, #6A1B9A)' },
}

function formatCellValue(value: unknown, format?: string): React.ReactNode {
  if (format === 'boolean') {
    return value ? (
      <CheckRoundedIcon sx={{ fontSize: 18, color: '#2E3D2F' }} />
    ) : (
      <CloseRoundedIcon sx={{ fontSize: 18, color: 'rgba(0,0,0,0.12)' }} />
    )
  }
  if (typeof value === 'number') {
    if (value === -1) return <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#2E3D2F' }}>Unlimited</Typography>
    if (value === 0 && format === 'unlimited') return <CloseRoundedIcon sx={{ fontSize: 18, color: 'rgba(0,0,0,0.12)' }} />
    if (format === 'fee') return <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{value}%</Typography>
    if (format === 'goal') return <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>GH₵ {value.toLocaleString()}</Typography>
    return <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{value}</Typography>
  }
  return String(value)
}

const CTA_LABELS: Record<SubscriptionTier, string> = {
  [SubscriptionTier.FREE]: 'Get Started Free',
  [SubscriptionTier.STARTER]: 'Billing unavailable',
  [SubscriptionTier.PRO]: 'Billing unavailable',
  [SubscriptionTier.ENTERPRISE]: 'Contact support',
}

const faqs = [
  {
    question: 'When are platform fees charged?',
    answer: 'The Free plan currently defines a platform fee in product configuration. Self-service external disbursement is not available during launch readiness.',
  },
  {
    question: 'What payment methods are supported?',
    answer: 'Ujimora Wallet is the only active launch method. External payment and payout providers remain disabled until their adapters and compliance checks are complete.',
  },
  {
    question: 'Can I switch plans at any time?',
    answer: 'Paid plan activation is disabled until a verified billing integration is available. Existing Free accounts can continue without entering payment details.',
  },
  {
    question: 'Is there a free trial?',
    answer: 'The Free plan does not require a card. Paid trials are not offered while paid billing is unavailable.',
  },
  {
    question: 'How does yearly billing work?',
    answer: 'Yearly prices are planning references only. Ujimora does not currently collect monthly or yearly subscription payments.',
  },
  {
    question: 'What happens if I cancel my subscription?',
    answer: 'There is no paid billing cycle to cancel during launch readiness. Account deletion is separate and uses soft deletion to preserve required operational records.',
  },
  {
    question: 'Are there any hidden fees?',
    answer: 'No external processing fees are charged while external methods are disabled. Any future fee schedule must be shown before a payment is confirmed.',
  },
]

function PricingPage() {
  const [yearly, setYearly] = useState(false)

  return (
    <Box component="main" sx={{ flex: 1, pb: 10 }}>
      <InternalPageHero
        eyebrow="Plans and limits"
        title="Clear pricing without hidden promises"
        description="Start with the available Free plan. Paid tiers remain previews until verified billing and entitlement flows are connected."
        icon={<PaymentsRoundedIcon />}
        panelLabel="Launch status"
        panelTitle="No card required and no paid checkout active today."
        panelBody="Any future fee is shown before payment confirmation."
        primaryAction={{ label: 'Create a free account', href: WEB_APP_REGISTER }}
      />
      <Container maxWidth="lg">
        {/* Header */}
        <Box sx={{ textAlign: 'center', mt: 7, mb: 6 }}>
          <Typography variant="h3" sx={{ fontWeight: 800, mb: 2 }}>
            Simple, Transparent Pricing
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 400, maxWidth: 600, mx: 'auto', mb: 4 }}>
            Start with the Free plan. Paid plan checkout remains unavailable until verified billing is connected.
          </Typography>

          <Alert severity="info" sx={{ maxWidth: 760, mx: 'auto', mb: 4, textAlign: 'left' }}>
            Paid tiers and prices are previews only. No paid entitlement can be activated and no subscription payment is collected today.
          </Alert>

          {/* Monthly/Yearly toggle */}
          <Box sx={{ display: 'inline-flex', borderRadius: SHAPE.sm, border: '1px solid rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            {(['monthly', 'yearly'] as const).map((cycle) => {
              const isActive = (cycle === 'yearly') === yearly
              return (
                <Box
                  key={cycle}
                  component="button"
                  onClick={() => setYearly(cycle === 'yearly')}
                  sx={{
                    px: 3.5, py: 1.2,
                    border: 'none',
                    bgcolor: isActive ? '#1a1a1a' : 'transparent',
                    color: isActive ? '#fff' : 'text.secondary',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontFamily: 'inherit',
                  }}
                >
                  {cycle === 'monthly' ? 'Monthly' : 'Yearly'}
                  {cycle === 'yearly' && (
                    <Box component="span" sx={{ ml: 1, color: isActive ? '#A8B5A0' : '#2E3D2F', fontSize: '0.72rem', fontWeight: 800 }}>
                      Price preview
                    </Box>
                  )}
                </Box>
              )
            })}
          </Box>
        </Box>

        {/* Plan cards */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
            gap: 3,
            mb: 10,
          }}
        >
          {TIER_ORDER.map((tier) => {
            const plan = SUBSCRIPTION_PLANS[tier]
            const isPro = tier === SubscriptionTier.PRO
            const isEnterprise = tier === SubscriptionTier.ENTERPRISE
            const price = yearly ? plan.priceYearly : plan.priceMonthly
            const tc = TIER_ACCENTS[tier]

            return (
              <Card
                key={tier}
                elevation={0}
                sx={{
                  border: isPro ? `2px solid ${tc.color}` : '1px solid rgba(0,0,0,0.08)',
                  borderRadius: SHAPE.card,
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {isPro && (
                  <Box sx={{ position: 'absolute', top: -1, left: 0, right: 0, height: 3, background: tc.gradient }} />
                )}
                {isPro && (
                  <Chip
                    label="Most Popular"
                    size="small"
                    sx={{
                      position: 'absolute',
                      top: 12,
                      right: 12,
                      fontWeight: 700,
                      fontSize: '0.68rem',
                      bgcolor: 'rgba(46, 61, 47,0.08)',
                      color: '#2E3D2F',
                    }}
                  />
                )}
                <CardContent sx={{ p: 3.5, flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <Typography sx={{ fontWeight: 800, fontSize: '1.15rem', mb: 0.25 }}>
                    {plan.name}
                  </Typography>
                  <Typography sx={{ color: 'text.secondary', fontSize: '0.8rem', mb: 2.5, lineHeight: 1.4 }}>
                    {plan.description}
                  </Typography>

                  {/* Pricing */}
                  <Box sx={{ mb: 2.5 }}>
                    {isEnterprise ? (
                      <Typography sx={{ fontWeight: 800, fontSize: '1.4rem' }}>Custom</Typography>
                    ) : (
                      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                        <Typography sx={{ fontWeight: 900, fontSize: '2.2rem', lineHeight: 1 }}>
                          GH₵ {yearly ? Math.round(price / 12) : price}
                        </Typography>
                        <Typography sx={{ color: 'text.secondary', fontSize: '0.82rem' }}>/mo</Typography>
                      </Box>
                    )}
                    {yearly && !isEnterprise && price > 0 && (
                      <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mt: 0.25 }}>
                        GH₵ {price}/year &middot; billed annually
                      </Typography>
                    )}
                  </Box>

                  <Typography sx={{ fontWeight: 700, fontSize: '0.78rem', color: tc.color, mb: 2 }}>
                    {plan.platformFeePercent}% platform fee
                  </Typography>

                  {/* Features */}
                  <Box sx={{ flex: 1, mb: 2.5 }}>
                    {[
                      plan.maxActiveCampaigns === -1 ? 'Unlimited campaigns' : `${plan.maxActiveCampaigns} active campaign${plan.maxActiveCampaigns !== 1 ? 's' : ''}`,
                      plan.maxCampaignGoal === -1 ? 'No goal limit' : `Up to GH₵ ${plan.maxCampaignGoal.toLocaleString()} goal`,
                      plan.featuredListing && 'Featured listing',
                      plan.prioritySupport && 'Priority support',
                      plan.advancedAnalytics && 'Advanced analytics',
                      plan.customBranding && 'Custom branding',
                      plan.escrowSupport && 'Escrow & milestones',
                      plan.liveStreaming && 'Live streaming',
                      plan.campaignCollaboration && 'Campaign collaboration',
                    ]
                      .filter(Boolean)
                      .map((feat) => (
                        <Box key={feat as string} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                          <CheckRoundedIcon sx={{ fontSize: 15, color: tc.color, flexShrink: 0 }} />
                          <Typography sx={{ fontSize: '0.8rem', lineHeight: 1.3 }}>{feat}</Typography>
                        </Box>
                      ))}
                  </Box>

                  <Button
                    variant={isPro ? 'contained' : 'outlined'}
                    fullWidth
                    size="large"
                    href={tier === SubscriptionTier.FREE ? WEB_APP_REGISTER : isEnterprise ? '/contact' : undefined}
                    disabled={tier !== SubscriptionTier.FREE && !isEnterprise}
                    sx={{
                      borderRadius: SHAPE.sm,
                      fontWeight: 700,
                      textTransform: 'none',
                      py: 1.2,
                      ...(isPro && { bgcolor: tc.color, '&:hover': { bgcolor: '#1C261D' } }),
                    }}
                  >
                    {CTA_LABELS[tier]}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </Box>

        {/* Feature comparison table */}
        <Box sx={{ mb: 10 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 4, textAlign: 'center' }}>
            Detailed Comparison
          </Typography>

          <Box sx={{ borderRadius: SHAPE.card, boxShadow: 'var(--neu-raised)', overflow: 'hidden' }}>
            {/* Header */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1.6fr repeat(4, 1fr)', md: '2fr repeat(4, 1fr)' },
                bgcolor: '#FAFAFA',
                borderBottom: '1px solid rgba(0,0,0,0.08)',
              }}
            >
              <Box sx={{ px: 3, py: 2.5 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: 'text.secondary' }}>Feature</Typography>
              </Box>
              {TIER_ORDER.map((tier) => {
                const plan = SUBSCRIPTION_PLANS[tier]
                const isPro = tier === SubscriptionTier.PRO
                const tc = TIER_ACCENTS[tier]
                return (
                  <Box
                    key={tier}
                    sx={{
                      px: 1.5,
                      py: 2.5,
                      textAlign: 'center',
                      position: 'relative',
                      ...(isPro && {
                        bgcolor: tc.bg,
                        '&::after': {
                          content: '""',
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: 3,
                          background: tc.gradient,
                        },
                      }),
                    }}
                  >
                    <Typography sx={{ fontWeight: 800, fontSize: '0.88rem' }}>
                      {plan.name}
                    </Typography>
                    {isPro && (
                      <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: tc.color, mt: 0.25 }}>
                        RECOMMENDED
                      </Typography>
                    )}
                  </Box>
                )
              })}
            </Box>

            {/* Sections */}
            {FEATURE_SECTIONS.map((section) => (
              <Box key={section.title}>
                {/* Section label */}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1.6fr repeat(4, 1fr)', md: '2fr repeat(4, 1fr)' },
                    bgcolor: 'rgba(0,0,0,0.02)',
                    borderBottom: '1px solid rgba(0,0,0,0.06)',
                    borderTop: '1px solid rgba(0,0,0,0.06)',
                  }}
                >
                  <Box sx={{ px: 3, py: 1.25, gridColumn: 'span 5' }}>
                    <Typography sx={{ fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'text.secondary' }}>
                      {section.title}
                    </Typography>
                  </Box>
                </Box>

                {/* Rows */}
                {section.rows.map((row, ri) => (
                  <Box
                    key={row.key}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1.6fr repeat(4, 1fr)', md: '2fr repeat(4, 1fr)' },
                      borderBottom: ri < section.rows.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                      transition: 'background-color 0.15s',
                      '&:hover': { bgcolor: 'rgba(0,0,0,0.01)' },
                    }}
                  >
                    <Box sx={{ px: 3, py: 1.75, display: 'flex', alignItems: 'center' }}>
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 500 }}>{row.label}</Typography>
                    </Box>
                    {TIER_ORDER.map((tier) => {
                      const plan = SUBSCRIPTION_PLANS[tier]
                      const isPro = tier === SubscriptionTier.PRO
                      const tc = TIER_ACCENTS[tier]
                      return (
                        <Box
                          key={tier}
                          sx={{
                            px: 1.5,
                            py: 1.75,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            ...(isPro && { bgcolor: tc.bg }),
                          }}
                        >
                          {formatCellValue(plan[row.key], row.format)}
                        </Box>
                      )
                    })}
                  </Box>
                ))}
              </Box>
            ))}
          </Box>
        </Box>

        {/* FAQ */}
        <Box sx={{ maxWidth: 800, mx: 'auto' }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 4, textAlign: 'center' }}>
            Frequently Asked Questions
          </Typography>
          {faqs.map((faq) => (
            <Accordion
              key={faq.question}
              elevation={0}
              sx={{
                boxShadow: 'var(--neu-raised)',
                mb: 1,
                '&:before': { display: 'none' },
                borderRadius: SHAPE.sm,
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography sx={{ fontWeight: 600 }}>{faq.question}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                  {faq.answer}
                </Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      </Container>
    </Box>
  )
}

export default PricingPage

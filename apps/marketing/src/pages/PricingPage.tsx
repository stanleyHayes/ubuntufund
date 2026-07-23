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
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { SHAPE } from '@ubuntu-fund/ui'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
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
  [SubscriptionTier.STARTER]: { color: '#1565C0', bg: 'rgba(21,101,192,0.04)', gradient: 'linear-gradient(135deg, #42A5F5, #1565C0)' },
  [SubscriptionTier.PRO]: { color: '#2E7D32', bg: 'rgba(46,125,50,0.04)', gradient: 'linear-gradient(135deg, #66BB6A, #2E7D32)' },
  [SubscriptionTier.ENTERPRISE]: { color: '#6A1B9A', bg: 'rgba(106,27,154,0.04)', gradient: 'linear-gradient(135deg, #AB47BC, #6A1B9A)' },
}

function formatCellValue(value: unknown, format?: string): React.ReactNode {
  if (format === 'boolean') {
    return value ? (
      <CheckRoundedIcon sx={{ fontSize: 18, color: '#2E7D32' }} />
    ) : (
      <CloseRoundedIcon sx={{ fontSize: 18, color: 'rgba(0,0,0,0.12)' }} />
    )
  }
  if (typeof value === 'number') {
    if (value === -1) return <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#2E7D32' }}>Unlimited</Typography>
    if (value === 0 && format === 'unlimited') return <CloseRoundedIcon sx={{ fontSize: 18, color: 'rgba(0,0,0,0.12)' }} />
    if (format === 'fee') return <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{value}%</Typography>
    if (format === 'goal') return <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>${value.toLocaleString()}</Typography>
    return <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{value}</Typography>
  }
  return String(value)
}

const CTA_LABELS: Record<SubscriptionTier, string> = {
  [SubscriptionTier.FREE]: 'Get Started Free',
  [SubscriptionTier.STARTER]: 'Start Starter',
  [SubscriptionTier.PRO]: 'Go Pro',
  [SubscriptionTier.ENTERPRISE]: 'Contact Sales',
}

const faqs = [
  {
    question: 'When are platform fees charged?',
    answer: 'Platform fees are deducted automatically when funds are disbursed to campaign organizers. You only pay fees on funds you successfully raise -- there are no upfront costs.',
  },
  {
    question: 'What payment methods are supported?',
    answer: 'We support mobile money (M-Pesa, MTN Mobile Money, Airtel Money), bank transfers, credit/debit cards (Visa, Mastercard), and PayPal. Available methods vary by country.',
  },
  {
    question: 'Can I switch plans at any time?',
    answer: 'Yes, you can upgrade or downgrade your plan at any time. When upgrading, you will be charged the prorated amount for the remainder of your billing period. Downgrades take effect at the start of the next billing cycle.',
  },
  {
    question: 'Is there a free trial?',
    answer: 'Yes! The Free plan is completely free forever with no credit card required. Paid plans also include a 14-day free trial so you can try all features before committing.',
  },
  {
    question: 'How does yearly billing work?',
    answer: 'Yearly billing is charged once per year at a discounted rate. You save up to 17% compared to monthly billing. You can switch between monthly and yearly at any time.',
  },
  {
    question: 'What happens if I cancel my subscription?',
    answer: 'Your subscription remains active until the end of your current billing period. After that, you are moved to the Free plan. All your campaigns and data are preserved.',
  },
  {
    question: 'Are there any hidden fees?',
    answer: 'No. We believe in full transparency. The only fees are the platform fee for your plan tier and standard payment processing fees -- all clearly listed on this page.',
  },
]

function PricingPage() {
  const [yearly, setYearly] = useState(false)

  return (
    <Box component="main" sx={{ flex: 1, pt: { xs: 4, md: 8 }, pb: 10 }}>
      <Container maxWidth="lg">
        {/* Header */}
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Typography variant="h3" sx={{ fontWeight: 800, mb: 2 }}>
            Simple, Transparent Pricing
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 400, maxWidth: 600, mx: 'auto', mb: 4 }}>
            Choose the plan that fits your mission. Start free, upgrade as you grow.
          </Typography>

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
                    <Box component="span" sx={{ ml: 1, color: isActive ? '#66BB6A' : '#2E7D32', fontSize: '0.72rem', fontWeight: 800 }}>
                      Save 17%
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
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.08)',
                  },
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
                      bgcolor: 'rgba(46,125,50,0.08)',
                      color: '#2E7D32',
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
                          ${yearly ? Math.round(price / 12) : price}
                        </Typography>
                        <Typography sx={{ color: 'text.secondary', fontSize: '0.82rem' }}>/mo</Typography>
                      </Box>
                    )}
                    {yearly && !isEnterprise && price > 0 && (
                      <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mt: 0.25 }}>
                        ${price}/year &middot; billed annually
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
                      plan.maxCampaignGoal === -1 ? 'No goal limit' : `Up to $${plan.maxCampaignGoal.toLocaleString()} goal`,
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
                    href={isEnterprise ? 'mailto:sales@ubuntufund.com' : WEB_APP_REGISTER}
                    sx={{
                      borderRadius: SHAPE.sm,
                      fontWeight: 700,
                      textTransform: 'none',
                      py: 1.2,
                      ...(isPro && { bgcolor: tc.color, '&:hover': { bgcolor: '#1B5E20' } }),
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

          <Box sx={{ borderRadius: SHAPE.card, border: '1px solid rgba(0,0,0,0.08)', overflow: 'hidden' }}>
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
                border: '1px solid',
                borderColor: 'divider',
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

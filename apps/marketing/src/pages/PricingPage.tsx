import Alert from '@mui/material/Alert'
import Skeleton from '@mui/material/Skeleton'
import { useEffect, useState } from 'react'
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
import { SHAPE, breadcrumbList } from '@ubuntu-fund/ui'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded'
import { InternalPageHero } from '../components/InternalPageHero'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import {
  SubscriptionTier,
  type SubscriptionPlan,
} from '@ubuntu-fund/types'
import { useSeo, SITE_ORIGIN } from '@/lib/seo'

// Use semantic colours so accents remain readable in every skin and mode.
function accentOf() {
  return { color: 'primary.main', bg: 'action.hover', gradient: 'linear-gradient(90deg, #C7A24A, #DCC07E)' }
}

const WEB_APP_URL = import.meta.env.VITE_WEB_APP_URL || 'https://app.ujimora.com'
const WEB_APP_REGISTER = `${WEB_APP_URL}/register`

// ─── Comparison table data ───────────────────────────────────────────────────

interface FeatureRow {
  label: string
  key: keyof SubscriptionPlan | 'creatorDonations'
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
      { label: 'Creator profile donations (active paid plans)', key: 'creatorDonations', format: 'boolean' },
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

function formatCellValue(value: unknown, format?: string): React.ReactNode {
  if (format === 'boolean') {
    return value ? (
      <CheckRoundedIcon sx={{ fontSize: 18, color: 'primary.main' }} />
    ) : (
      <CloseRoundedIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
    )
  }
  if (typeof value === 'number') {
    if (value === -1) return <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: 'primary.main' }}>Unlimited</Typography>
    if (value === 0 && format === 'unlimited') return <CloseRoundedIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
    if (format === 'fee') return <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{value}%</Typography>
    if (format === 'goal') return <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>GH₵ {value.toLocaleString()}</Typography>
    return <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{value}</Typography>
  }
  return String(value)
}

const faqs = [
  {
    question: 'When are platform fees charged?',
    answer: 'Platform fees vary by plan. Review the applicable contribution and payout fees before confirming a transaction.',
  },
  {
    question: 'What payment methods are supported?',
    answer: 'Use your Ujimora Wallet or choose from the payment methods available at checkout for your country and currency. Payout methods and eligibility depend on your account and provider availability.',
  },
  {
    question: 'Can I switch plans at any time?',
    answer: 'Manage your plan from the subscription page in your account. Review the new price, billing cycle, and applicable terms before confirming a change.',
  },
  {
    question: 'Is there a free trial?',
    answer: 'You can start with the Community plan without a paid subscription. Check the current checkout for any trial or promotional offers.',
  },
  {
    question: 'How does yearly billing work?',
    answer: 'Yearly plans display an equivalent monthly price and the full annual total. The annual total is billed for the year.',
  },
  {
    question: 'What happens if I cancel my subscription?',
    answer: 'Check your subscription page for cancellation options and the effective date. Account deletion is a separate action.',
  },
  {
    question: 'Are there any hidden fees?',
    answer: 'Compare platform fees here and review any applicable processing or withdrawal fees in the relevant payment flow.',
  },
]

function PricingPage() {
  const [yearly, setYearly] = useState(false)
  const [plans, setPlans] = useState<SubscriptionPlan[] | null>(null)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let active = true
    fetch(`${import.meta.env.VITE_API_URL || '/api/v1'}/plans/public`).then(async response => {
      if (!response.ok) throw new Error('Plans unavailable')
      const payload = await response.json()
      if (!Array.isArray(payload.data) || !payload.data.length) throw new Error('Plans unavailable')
      if (active) setPlans(payload.data)
    }).catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [retry])
  // Before the early return below: the head must be set even while plans load.
  useSeo({
    title: 'Pricing and plans | Ujimora',
    description: 'Compare Ujimora plans side by side: active campaign limits, cedi goal caps, platform fees, team seats and included tools, billed monthly or yearly.',
    path: '/pricing',
    type: 'website',
    jsonLd: breadcrumbList(SITE_ORIGIN, [{ name: 'Home', path: '/' }, { name: 'Pricing' }]),
  })
  if (!plans) return <Container maxWidth="lg" sx={{ py: 8 }}>
    <Typography variant="h3" sx={{ mb: 3 }}>Plans and pricing</Typography>
    {error ? <Alert severity="error" action={<Button onClick={() => { setError(false); setRetry(value => value + 1) }}>Retry</Button>}>Current pricing could not be loaded. Please try again.</Alert> : <Box aria-busy="true" aria-label="Loading current pricing" sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 3 }}>{[0, 1, 2].map(i => <Skeleton key={i} variant="rounded" height={400} />)}</Box>}</Container>
  const PLANS = plans

  return (
    <Box component="main" sx={{ flex: 1, pb: 10 }}>
      <InternalPageHero
        eyebrow="Plans and limits"
        title="Clear pricing without hidden promises"
        description="Start with a personal cause, grow your fundraising, or give your organisation room to do more."
        icon={<PaymentsRoundedIcon />}
        panelLabel="Find your fit"
        panelTitle="The right tools for every stage of your cause."
        panelBody="Compare campaign limits, platform fees, and included tools before choosing a plan."
        primaryAction={{ label: 'Create a free account', href: WEB_APP_REGISTER }}
      />
      <Container maxWidth="lg">
        {/* Header */}
        <Box sx={{ textAlign: 'center', mt: 7, mb: 6 }}>
          <Typography variant="h3" sx={{ fontWeight: 800, mb: 2 }}>
            Simple, Transparent Pricing
          </Typography>
          <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 400, maxWidth: 600, mx: 'auto', mb: 4 }}>
            Choose the campaign capacity and support you need. Review your billing total before confirming checkout. Account-specific compliance limits may reduce your maximum campaign goal. Creator donations require an active paid subscription; creator withdrawals deduct your current plan’s platform-fee percentage. Free does not include creator donations.
          </Typography>

          {/* Monthly/Yearly toggle */}
          <Box sx={{ display: 'inline-flex', borderRadius: SHAPE.sm, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
            {(['monthly', 'yearly'] as const).map((cycle) => {
              const isActive = (cycle === 'yearly') === yearly
              return (
                <Box
                  key={cycle}
                  component="button"
                  onClick={() => setYearly(cycle === 'yearly')}
                  aria-pressed={isActive}
                  sx={{
                    px: 3.5, py: 1.2,
                    border: 'none',
                    bgcolor: isActive ? 'primary.main' : 'transparent',
                    color: isActive ? 'primary.contrastText' : 'text.secondary',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontFamily: 'inherit',
                  }}
                >
                  {cycle === 'monthly' ? 'Monthly' : 'Yearly'}

                </Box>
              )
            })}
          </Box>
        </Box>

        {/* Same audience grouping as the account subscription page. */}
        {[
          { title: 'For personal causes & growing fundraisers', description: 'Start small or build momentum with more campaigns and tools.', plans: PLANS.filter(plan => plan.tier !== SubscriptionTier.ORGANIZATION && plan.tier !== SubscriptionTier.ENTERPRISE) },
          { title: 'For organisations & larger teams', description: 'Support ongoing programmes and more complex fundraising needs.', plans: PLANS.filter(plan => plan.tier === SubscriptionTier.ORGANIZATION || plan.tier === SubscriptionTier.ENTERPRISE) },
        ].filter(group => group.plans.length).map((group, groupIndex) => (
          <Box component="section" key={group.title} sx={{ mb: 7 }}>
            <Typography component="h2" variant="h5" sx={{ mb: 1 }}>{group.title}</Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>{group.description}</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0,1fr)', sm: 'repeat(2,minmax(0,1fr))', md: `repeat(${Math.min(group.plans.length, groupIndex === 0 ? 3 : 2)},minmax(0,1fr))` }, gap: 3 }}>
          {group.plans.map((plan) => {
            const tier = plan.tier
            const isPro = plan.popular === true
            const isEnterprise = tier === SubscriptionTier.ENTERPRISE
            const price = yearly ? plan.priceYearly : plan.priceMonthly
            const tc = accentOf()

            return (
              <Card
                key={tier}
                elevation={0}
                sx={{
                  border: 'var(--neu-border)',
                  outline: isPro ? '2px solid' : undefined, outlineColor: 'secondary.main', minWidth: 0,
                  borderRadius: SHAPE.card,
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <Box sx={{ px: 3, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', bgcolor: isPro ? 'action.hover' : 'transparent' }}>
                  <Chip size="small" label={isPro ? 'Recommended for growth' : tier === SubscriptionTier.ORGANIZATION ? 'Best fit for organisations' : isEnterprise ? 'For complex needs' : plan.priceMonthly === 0 ? 'Start here' : 'For a growing cause'} sx={{ color: 'text.primary', fontWeight: 700, maxWidth: '100%' }} />
                </Box>
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
                        <Typography sx={{ fontWeight: 900, fontSize: { xs: '1.85rem', md: '2.2rem' }, lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                          GH₵ {new Intl.NumberFormat('en-GH', { maximumFractionDigits: 2 }).format(yearly ? price / 12 : price)}
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
                      plan.tier !== 'free' && (plan.priceMonthly > 0 || plan.priceYearly > 0) && 'Creator donations on your profile',
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
                    href={isEnterprise ? '/contact' : price === 0 ? WEB_APP_REGISTER : `${WEB_APP_URL}/subscription`}
                    sx={{
                      borderRadius: SHAPE.sm,
                      fontWeight: 700,
                      textTransform: 'none',
                      py: 1.2,
                      ...(isPro && { bgcolor: 'secondary.main', color: 'secondary.contrastText', '&:hover': { bgcolor: 'secondary.light' } }),
                    }}
                  >
                    {price === 0 ? 'Get Started Free' : isEnterprise ? 'Contact sales' : `Choose ${plan.name}`}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
            </Box>
          </Box>
        ))}

        {/* Feature comparison table */}
        <Box sx={{ mb: 10 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 4, textAlign: 'center' }}>
            Detailed Comparison
          </Typography>

          <Box role="region" aria-label="Plan comparison" tabIndex={0} sx={{ borderRadius: SHAPE.card, boxShadow: 'var(--neu-raised)', overflowX: 'auto', '& > div': { minWidth: 800 } }}>
            {/* Header */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: `1.6fr repeat(${PLANS.length}, 1fr)`, md: `2fr repeat(${PLANS.length}, 1fr)` },
                bgcolor: 'background.paper',
                borderBottom: '1px solid', borderColor: 'divider',
              }}
            >
              <Box sx={{ px: 3, py: 2.5 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: 'text.secondary' }}>Feature</Typography>
              </Box>
              {PLANS.map((plan) => {
                const isPro = plan.popular === true
                const tc = accentOf()
                return (
                  <Box
                    key={plan.tier}
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
                    gridTemplateColumns: { xs: `1.6fr repeat(${PLANS.length}, 1fr)`, md: `2fr repeat(${PLANS.length}, 1fr)` },
                    bgcolor: 'rgba(0,0,0,0.02)',
                    borderBottom: '1px solid rgba(0,0,0,0.06)',
                    borderTop: '1px solid rgba(0,0,0,0.06)',
                  }}
                >
                  <Box sx={{ px: 3, py: 1.25, gridColumn: `span ${PLANS.length + 1}` }}>
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
                      gridTemplateColumns: { xs: `1.6fr repeat(${PLANS.length}, 1fr)`, md: `2fr repeat(${PLANS.length}, 1fr)` },
                      borderBottom: ri < section.rows.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                      transition: 'background-color 0.15s',
                      '&:hover': { bgcolor: 'rgba(0,0,0,0.01)' },
                    }}
                  >
                    <Box sx={{ px: 3, py: 1.75, display: 'flex', alignItems: 'center' }}>
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 500 }}>{row.label}</Typography>
                    </Box>
                    {PLANS.map((plan) => {
                      const isPro = plan.popular === true
                      const tc = accentOf()
                      return (
                        <Box
                          key={plan.tier}
                          sx={{
                            px: 1.5,
                            py: 1.75,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            ...(isPro && { bgcolor: tc.bg }),
                          }}
                        >
                          {formatCellValue(row.key === 'creatorDonations' ? plan.tier !== 'free' && (plan.priceMonthly > 0 || plan.priceYearly > 0) : plan[row.key], row.format)}
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

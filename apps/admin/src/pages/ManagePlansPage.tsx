import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import LayersRoundedIcon from '@mui/icons-material/LayersRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import { SUBSCRIPTION_PLANS, SubscriptionTier } from '@ubuntu-fund/types'
import { raisedSurface, insetSurface } from '@/lib/surfaces'
import PageHeader from '@/components/PageHeader'

const ORDER = [SubscriptionTier.FREE, SubscriptionTier.STARTER, SubscriptionTier.PRO, SubscriptionTier.ENTERPRISE]

export default function ManagePlansPage() {
  return (
    <Box sx={{ bgcolor: 'background.default' }}>
      <PageHeader tone="green" eyebrow="Platform" title="Subscription plan policy" lede="Review the code-enforced limits and launch availability." icon={<LayersRoundedIcon />} stats={[{ label: 'Defined plans', value: ORDER.length }, { label: 'Available now', value: 'Free' }, { label: 'Policy', value: 'Read-only' }]} />
      <Alert severity="warning" sx={{ mb: 3 }}>
        Only Free can be activated. Paid billing is blocked by the API until verified checkout exists. Plans are code-defined and intentionally read-only here.
      </Alert>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(4, minmax(0, 1fr))' }, gap: 2.5 }}>
        {ORDER.map((tier) => {
          const plan = SUBSCRIPTION_PLANS[tier]
          const available = tier === SubscriptionTier.FREE
          const features = [
            plan.featuredListing && 'Featured listing',
            plan.prioritySupport && 'Priority support',
            plan.advancedAnalytics && 'Advanced analytics',
            plan.campaignCollaboration && 'Collaboration',
          ].filter(Boolean) as string[]
          return (
            <Card key={tier} sx={{ ...raisedSurface, height: '100%' }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>{plan.name}</Typography>
                  <Chip label={available ? 'Available' : 'Billing blocked'} size="small" color={available ? 'success' : 'default'} />
                </Box>
                <Typography color="text.secondary" sx={{ minHeight: 48, mb: 2 }}>{plan.description}</Typography>
                <Typography variant="h5" sx={{ fontWeight: 900, mb: 2 }}>{plan.priceMonthly === 0 ? 'Free' : `GH₵ ${plan.priceMonthly}/mo preview`}</Typography>
                <Box component="dl" sx={{ ...insetSurface, m: 0, p: 2, mb: 3, display: 'grid', gap: 2 }}>
                  {[
                    ['Active campaigns', plan.maxActiveCampaigns === -1 ? 'Unlimited' : plan.maxActiveCampaigns],
                    ['Campaign goal', plan.maxCampaignGoal === -1 ? 'Unlimited' : `GH₵ ${plan.maxCampaignGoal.toLocaleString()}`],
                    ['Platform fee', `${plan.platformFeePercent}%`],
                  ].map(([label, value]) => <Box key={label}>
                    <Typography component="dt" variant="caption" color="text.secondary">{label}</Typography>
                    <Typography component="dd" sx={{ m: 0, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</Typography>
                  </Box>)}
                </Box>
                <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1 }}>Included features</Typography>
                {features.length === 0 && <Typography variant="body2" color="text.secondary">Core campaign tools</Typography>}
                {features.map((feature) => <Box key={feature} sx={{ display: 'flex', gap: 0.75, alignItems: 'center', mb: 0.75 }}><CheckCircleRoundedIcon color="success" sx={{ fontSize: 16 }} /><Typography variant="body2">{feature}</Typography></Box>)}
              </CardContent>
            </Card>
          )
        })}
      </Box>
    </Box>
  )
}

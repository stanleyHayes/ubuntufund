import { useState } from 'react'
import { SHAPE } from '@ubuntu-fund/ui'
import { useContent } from '../hooks/useContent'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded'
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded'
import VolunteerActivismRoundedIcon from '@mui/icons-material/VolunteerActivismRounded'
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded'
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded'
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded'
import EmailRoundedIcon from '@mui/icons-material/EmailRounded'
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded'
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'

// ─── Data ────────────────────────────────────────────────────────────────────

interface FaqCategory {
  id: string
  icon: React.ReactNode
  label: string
  questions: { q: string; a: string }[]
}

// Static category metadata (id + icon + label). Icons are React nodes and can't come
// from the CMS, so they live here; the questions/answers come from the CMS at runtime.
const FAQ_CATEGORIES_STATIC: FaqCategory[] = [
  {
    id: 'getting-started',
    icon: <RocketLaunchRoundedIcon />,
    label: 'Getting started',
    questions: [
      { q: 'How do I create an account on UbuntuFund?', a: 'Click "Sign Up" on the homepage, enter your email and create a password. You can also sign up with Google or Facebook. Complete your profile with your name, location, and a photo to build trust with the community.' },
      { q: 'Is UbuntuFund available in my country?', a: 'UbuntuFund is built for Ghana. Campaign creation is open to organizers based in Ghana, and anyone worldwide can donate to a Ghanaian campaign — family abroad included. All campaigns raise funds in Ghanaian cedis (GHS).' },
      { q: 'Do I need to verify my identity?', a: 'Basic usage requires email verification. To create campaigns and build trust, we recommend completing our multi-level verification: email/phone, national ID, institutional, and community vouching. Higher verification means a higher trust score.' },
    ],
  },
  {
    id: 'campaigns',
    icon: <CampaignRoundedIcon />,
    label: 'Campaigns',
    questions: [
      { q: 'How do I start a fundraising campaign?', a: 'Click "Start a Campaign" and follow the guided setup: title, description, goal amount, category, and compelling photos. Set a deadline and submit for review. Our team typically reviews campaigns within 24-48 hours.' },
      { q: 'What types of campaigns can I create?', a: 'We support education, healthcare, community development, emergency relief, arts & culture, small business, agriculture, and technology. Campaigns must be for legitimate, legal purposes benefiting communities or individuals.' },
      { q: 'How long can my campaign run?', a: 'Campaigns run up to 90 days. We recommend 30-60 days for optimal engagement. You can extend once for 30 additional days if you haven\'t reached your goal. Campaigns that reach their goal early continue accepting donations.' },
      { q: 'Can I edit my campaign after it\'s live?', a: 'Yes. You can update the description, images, and deadline. The goal amount cannot be reduced once donations are received. Major changes may trigger a re-review by our trust team.' },
    ],
  },
  {
    id: 'donations',
    icon: <VolunteerActivismRoundedIcon />,
    label: 'Donations',
    questions: [
      { q: 'How do I make a donation?', a: 'Browse campaigns and click "Donate." Enter the amount, choose your payment method, and confirm. You\'ll receive a confirmation email with your receipt. You can donate anonymously if you prefer.' },
      { q: 'Is there a minimum or maximum donation?', a: 'Minimum is GH₵ 5. No maximum, though large donations may require additional verification. Enterprise organizations can set custom minimums for their campaigns.' },
      { q: 'Can I get a refund on my donation?', a: 'Refunds are available within 14 days if the campaign hasn\'t withdrawn the funds. For campaigns that are suspended or found fraudulent, full refunds are processed automatically. Visit your donation history to request a refund.' },
    ],
  },
  {
    id: 'payments',
    icon: <PaymentsRoundedIcon />,
    label: 'Payments',
    questions: [
      { q: 'What payment methods are accepted?', a: 'MTN Mobile Money (MoMo), Telecel Cash, AT Money, Visa & Mastercard cards, and bank transfer. Mobile money is the fastest way to give and receive funds in Ghana.' },
      { q: 'How do I withdraw my campaign funds?', a: 'Go to your dashboard and click "Withdraw." Choose mobile money (processed within 24 hours) or bank transfer to any Ghanaian bank (2-3 business days). Platform fees are automatically deducted.' },
      { q: 'What are the platform fees?', a: 'Fees depend on your subscription tier. Free accounts pay a 5% platform fee. Starter (3.5%), Pro (2%), and Enterprise (1%). All tiers incur standard payment processing fees (2.9% + GH₵ 1). See our pricing page for details.' },
    ],
  },
  {
    id: 'trust',
    icon: <ShieldRoundedIcon />,
    label: 'Trust & safety',
    questions: [
      { q: 'How does UbuntuFund verify campaigns?', a: 'Multi-layer verification: initial team review, organizer identity verification, documentation checks, and community trust scores. Verified campaigns earn badges that help donors assess credibility at a glance.' },
      { q: 'What happens if a campaign is fraudulent?', a: 'The campaign is immediately suspended, funds are frozen, and we process refunds for affected donors. Fraudulent accounts are permanently banned. We cooperate with law enforcement. Use the "Report" button on any campaign to flag concerns.' },
      { q: 'How does the trust score work?', a: 'Trust scores (0-100) are calculated from verification level, campaign track record, community engagement, and donor feedback. Higher scores unlock features like increased campaign limits and featured placement.' },
    ],
  },
  {
    id: 'organizations',
    icon: <GroupsRoundedIcon />,
    label: 'Organizations',
    questions: [
      { q: 'How do I register as an organization?', a: 'During registration, select "Organization" as your account type. Provide your organization name, registration number, and type (NGO, hospital, school, etc.). Complete verification with official documents for priority trust status.' },
      { q: 'What features are available for organizations?', a: 'Organizations get: branded campaign pages, team management, advanced analytics, automated tax receipts, recurring donation support, API access, and dedicated account management. See our "For Organizations" page for tier details.' },
    ],
  },
]

// CMS shape for key 'faq': a flat list of { category, question, answer }. The fallback is
// derived from the static categories above so an unreachable CMS renders identically.
interface FaqItem {
  category: string
  question: string
  answer: string
}

const FAQ_FALLBACK: { items: FaqItem[] } = {
  items: FAQ_CATEGORIES_STATIC.flatMap((cat) =>
    cat.questions.map((q) => ({ category: cat.label, question: q.q, answer: q.a }))
  ),
}

const QUICK_LINKS = [
  { icon: <MenuBookRoundedIcon />, label: 'Getting started guide', description: 'Step-by-step walkthrough for new users', target: 'getting-started' },
  { icon: <CampaignRoundedIcon />, label: 'Campaign best practices', description: 'Tips to maximize your fundraising', target: 'campaigns' },
  { icon: <PaymentsRoundedIcon />, label: 'Payment methods', description: 'MoMo, cards, and bank transfer in Ghana', target: 'payments' },
  { icon: <ShieldRoundedIcon />, label: 'Trust & verification', description: 'How our trust system works', target: 'trust' },
]

const CONTACT_OPTIONS = [
  { icon: <EmailRoundedIcon />, title: 'Email support', desc: 'support@ubuntufund.com', detail: 'Response within 24 hours', action: 'Send email', href: 'mailto:support@ubuntufund.com' },
  { icon: <ChatBubbleOutlineRoundedIcon />, title: 'Live chat', desc: 'Chat with our team in real time', detail: 'Mon-Sat, 8am-8pm GMT', action: 'Start chat', href: '/contact' },
  { icon: <GroupsRoundedIcon />, title: 'Community forum', desc: 'Get help from other UbuntuFund users', detail: '5,000+ active members', action: 'Visit forum', href: '/contact' },
]

// ─── Component ───────────────────────────────────────────────────────────────

function HelpPage() {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  // Runtime CMS: pull FAQ items and regroup them onto the static category metadata
  // (matched by label). Falls back to the hardcoded defaults when the CMS is unreachable.
  const faqContent = useContent('faq', FAQ_FALLBACK)
  const FAQ_CATEGORIES: FaqCategory[] = FAQ_CATEGORIES_STATIC.map((cat) => ({
    id: cat.id,
    icon: cat.icon,
    label: cat.label,
    questions: faqContent.items
      .filter((it) => it.category === cat.label)
      .map((it) => ({ q: it.question, a: it.answer })),
  }))

  const filteredCategories = FAQ_CATEGORIES.map((cat) => ({
    ...cat,
    questions: cat.questions.filter(
      (faq) =>
        !search ||
        faq.q.toLowerCase().includes(search.toLowerCase()) ||
        faq.a.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter((cat) => (!activeCategory || cat.id === activeCategory) && cat.questions.length > 0)

  const totalResults = filteredCategories.reduce((sum, cat) => sum + cat.questions.length, 0)

  const clearFilters = () => {
    setSearch('')
    setActiveCategory(null)
  }

  return (
    <Box component="main" sx={{ flex: 1 }}>

      {/* ═══ Header + search (white) ═══ */}
      <Box sx={{ bgcolor: 'background.paper', py: { xs: 8, md: 10 } }}>
        <Container maxWidth="md">
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="overline" sx={{ color: 'secondary.dark' }}>
              Support
            </Typography>
            <Typography variant="h2" sx={{ mt: 1, mb: 2, fontSize: { xs: '1.75rem', md: '2.25rem' } }}>
              Help center
            </Typography>
            <Typography sx={{ color: 'text.secondary', maxWidth: 640, mx: 'auto' }}>
              Search our frequently asked questions or browse by topic below.
            </Typography>
          </Box>

          <Box sx={{ maxWidth: 600, mx: 'auto', mt: 5 }}>
            <TextField
              fullWidth
              placeholder="Search for answers…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRoundedIcon sx={{ color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                },
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: SHAPE.card,
                  bgcolor: 'background.paper',
                  fontSize: '1.05rem',
                  '& fieldset': { borderColor: '#E7E3D8' },
                  '&.Mui-focused fieldset': { borderColor: 'secondary.main', borderWidth: 2 },
                },
              }}
            />
            {search && (
              <Typography sx={{ mt: 1.5, fontSize: '0.82rem', color: 'text.secondary', textAlign: 'center' }}>
                {totalResults} result{totalResults !== 1 ? 's' : ''} found
                {totalResults === 0 && ' — try a different search term'}
              </Typography>
            )}
          </Box>
        </Container>
      </Box>

      {/* ═══ Quick links, categories & FAQ (parchment) ═══ */}
      <Box sx={{ bgcolor: 'background.default', py: { xs: 8, md: 10 } }}>
        <Container maxWidth="lg">

          {!search && !activeCategory && (
            <Box sx={{ mb: 6 }}>
              <Typography variant="overline" sx={{ color: 'secondary.dark', display: 'block', mb: 2.5 }}>
                Popular topics
              </Typography>
              <Grid container spacing={2}>
                {QUICK_LINKS.map((link) => (
                  <Grid size={{ xs: 12, sm: 6, md: 3 }} key={link.label}>
                    <Card
                      elevation={0}
                      onClick={() => setActiveCategory(link.target)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setActiveCategory(link.target)
                        }
                      }}
                      sx={{
                        height: '100%',
                        cursor: 'pointer',
                        '&:focus-visible': { outline: '2px solid #C7A24A', outlineOffset: 2 },
                      }}
                    >
                      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        <Box
                          sx={{
                            width: 44, height: 44, borderRadius: SHAPE.sm,
                            bgcolor: 'rgba(46,61,47,0.08)', color: 'primary.main',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            '& svg': { fontSize: 22 },
                          }}
                        >
                          {link.icon}
                        </Box>
                        <Box>
                          <Typography sx={{ fontWeight: 700, fontSize: '0.92rem', mb: 0.25 }}>{link.label}</Typography>
                          <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', lineHeight: 1.5 }}>{link.description}</Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          <Typography variant="overline" sx={{ color: 'secondary.dark', display: 'block', mb: 2, textAlign: { xs: 'left', md: 'center' } }}>
            Browse by category
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 6, justifyContent: 'center' }}>
            <Chip
              label="All topics"
              onClick={() => setActiveCategory(null)}
              sx={{
                height: 40,
                fontWeight: 600,
                fontSize: '0.85rem',
                borderRadius: '999px',
                border: '1px solid',
                borderColor: !activeCategory ? 'primary.main' : '#E7E3D8',
                bgcolor: !activeCategory ? 'primary.main' : 'transparent',
                color: !activeCategory ? 'primary.contrastText' : 'text.primary',
                '&:hover': { borderColor: 'secondary.main' },
              }}
            />
            {FAQ_CATEGORIES.map((cat) => {
              const active = activeCategory === cat.id
              return (
                <Chip
                  key={cat.id}
                  icon={<Box sx={{ display: 'flex', '& svg': { fontSize: '16px !important' } }}>{cat.icon}</Box>}
                  label={cat.label}
                  onClick={() => setActiveCategory(active ? null : cat.id)}
                  sx={{
                    height: 40,
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    borderRadius: '999px',
                    border: '1px solid',
                    borderColor: active ? 'primary.main' : '#E7E3D8',
                    bgcolor: active ? 'primary.main' : 'transparent',
                    color: active ? 'primary.contrastText' : 'text.primary',
                    '&:hover': { borderColor: 'secondary.main' },
                    '& .MuiChip-icon': { color: active ? 'primary.contrastText' : 'text.secondary' },
                  }}
                />
              )
            })}
          </Box>

          {/* ═══ FAQ groups ═══ */}
          <Box sx={{ maxWidth: 800, mx: 'auto' }}>
            {filteredCategories.map((cat) => (
              <Box key={cat.id} id={cat.id} sx={{ mb: 5 }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', color: 'secondary.dark', '& svg': { fontSize: 18 } }}>
                    {cat.icon}
                  </Box>
                  <Typography variant="overline" sx={{ color: 'secondary.dark' }}>
                    {cat.label}
                  </Typography>
                  <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', ml: 'auto' }}>
                    {cat.questions.length} question{cat.questions.length !== 1 ? 's' : ''}
                  </Typography>
                </Stack>

                {cat.questions.map((faq) => (
                  <Accordion
                    key={faq.q}
                    elevation={0}
                    disableGutters
                    sx={{
                      border: '1px solid #E7E3D8',
                      borderRadius: SHAPE.sm,
                      mb: 1.5,
                      bgcolor: 'background.paper',
                      '&::before': { display: 'none' },
                      transition: 'border-color 0.2s ease',
                      '&:hover': { borderColor: 'secondary.light' },
                      '&.Mui-expanded': { borderColor: 'secondary.main' },
                    }}
                  >
                    <AccordionSummary
                      expandIcon={<ExpandMoreRoundedIcon sx={{ color: 'text.secondary' }} />}
                      sx={{
                        px: 3,
                        minHeight: 56,
                        '& .MuiAccordionSummary-content': { my: 1.5 },
                        '&.Mui-expanded .MuiAccordionSummary-expandIconWrapper': { color: 'secondary.main' },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'secondary.main', flexShrink: 0, mt: 0.75 }} />
                        <Typography sx={{ fontWeight: 600, fontSize: '0.95rem', lineHeight: 1.4 }}>{faq.q}</Typography>
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ px: 3, pb: 3, pt: 0, pl: 5.5 }}>
                      <Typography sx={{ fontSize: '0.9rem', color: 'text.secondary', lineHeight: 1.8 }}>{faq.a}</Typography>
                    </AccordionDetails>
                  </Accordion>
                ))}
              </Box>
            ))}

            {filteredCategories.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <SearchRoundedIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 2 }} />
                <Typography sx={{ fontWeight: 700, mb: 0.5 }}>No results found</Typography>
                <Typography sx={{ color: 'text.secondary', fontSize: '0.9rem', mb: 3 }}>
                  Try adjusting your search or browse all topics.
                </Typography>
                <Button
                  onClick={clearFilters}
                  variant="outlined"
                  sx={{ borderRadius: '999px', textTransform: 'none', fontWeight: 600, color: 'text.primary', borderColor: '#E7E3D8', '&:hover': { borderColor: 'secondary.main' } }}
                >
                  Clear search
                </Button>
              </Box>
            )}
          </Box>
        </Container>
      </Box>

      {/* ═══ Contact CTA (the one dark forest band) ═══ */}
      <Box
        sx={{
          background: 'linear-gradient(160deg, #1C261D, #2E3D2F)',
          py: { xs: 8, md: 10 },
        }}
      >
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Typography variant="overline" sx={{ color: 'secondary.main' }}>
              Contact
            </Typography>
            <Typography variant="h2" sx={{ mt: 1, mb: 2, color: '#fff', fontSize: { xs: '1.75rem', md: '2.25rem' } }}>
              Still need help?
            </Typography>
            <Typography sx={{ color: 'rgba(245,242,234,0.75)', maxWidth: 640, mx: 'auto', lineHeight: 1.7 }}>
              Our support team is available Monday through Saturday, 8am-8pm GMT. We typically respond within a few hours.
            </Typography>
          </Box>

          <Grid container spacing={3} alignItems="stretch">
            {CONTACT_OPTIONS.map((opt) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={opt.title}>
                <Card elevation={0} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1 }}>
                    <Box
                      sx={{
                        width: 44, height: 44, borderRadius: SHAPE.sm,
                        bgcolor: 'rgba(46,61,47,0.08)', color: 'primary.main',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        '& svg': { fontSize: 22 },
                      }}
                    >
                      {opt.icon}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>{opt.title}</Typography>
                      <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary', mt: 0.25 }}>{opt.desc}</Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.5 }}>{opt.detail}</Typography>
                    </Box>
                    <Button
                      href={opt.href}
                      size="small"
                      endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: '16px !important' }} />}
                      sx={{
                        alignSelf: 'flex-start',
                        borderRadius: '999px',
                        textTransform: 'none',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        color: 'text.primary',
                        '&:hover': { bgcolor: 'rgba(46,61,47,0.06)' },
                      }}
                    >
                      {opt.action}
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>
    </Box>
  )
}

export default HelpPage

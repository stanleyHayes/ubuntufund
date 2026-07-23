import { useState } from 'react'
import { SHAPE } from '@ubuntu-fund/ui'
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
import SupportAgentRoundedIcon from '@mui/icons-material/SupportAgentRounded'
import EmailRoundedIcon from '@mui/icons-material/EmailRounded'
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded'
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import { keyframes } from '@mui/material/styles'

// ─── Animations ──────────────────────────────────────────────────────────────

const fadeSlide = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
`

// ─── Data ────────────────────────────────────────────────────────────────────

interface FaqCategory {
  id: string
  icon: React.ReactNode
  label: string
  color: string
  questions: { q: string; a: string }[]
}

const FAQ_CATEGORIES: FaqCategory[] = [
  {
    id: 'getting-started',
    icon: <RocketLaunchRoundedIcon />,
    label: 'Getting Started',
    color: '#2E7D32',
    questions: [
      { q: 'How do I create an account on UbuntuFund?', a: 'Click "Sign Up" on the homepage, enter your email and create a password. You can also sign up with Google or Facebook. Complete your profile with your name, location, and a photo to build trust with the community.' },
      { q: 'Is UbuntuFund available in my country?', a: 'UbuntuFund is available across all 54 African nations and to the global diaspora. While campaign creation is currently limited to organizers based in Africa, anyone worldwide can donate. We are continuously expanding payment options.' },
      { q: 'Do I need to verify my identity?', a: 'Basic usage requires email verification. To create campaigns and build trust, we recommend completing our multi-level verification: email/phone, national ID, institutional, and community vouching. Higher verification = higher trust scores.' },
    ],
  },
  {
    id: 'campaigns',
    icon: <CampaignRoundedIcon />,
    label: 'Campaigns',
    color: '#1565C0',
    questions: [
      { q: 'How do I start a fundraising campaign?', a: 'Click "Start a Campaign" and follow the guided setup: title, description, goal amount, category, and compelling photos. Set a deadline and submit for review. Our team typically reviews campaigns within 24-48 hours.' },
      { q: 'What types of campaigns can I create?', a: 'We support Education, Healthcare, Community Development, Emergency Relief, Arts & Culture, Small Business, Agriculture, and Technology. Campaigns must be for legitimate, legal purposes benefiting communities or individuals.' },
      { q: 'How long can my campaign run?', a: 'Campaigns run up to 90 days. We recommend 30-60 days for optimal engagement. You can extend once for 30 additional days if you haven\'t reached your goal. Campaigns that reach their goal early continue accepting donations.' },
      { q: 'Can I edit my campaign after it\'s live?', a: 'Yes. You can update the description, images, and deadline. The goal amount cannot be reduced once donations are received. Major changes may trigger a re-review by our trust team.' },
    ],
  },
  {
    id: 'donations',
    icon: <VolunteerActivismRoundedIcon />,
    label: 'Donations',
    color: '#C75B39',
    questions: [
      { q: 'How do I make a donation?', a: 'Browse campaigns and click "Donate." Enter the amount, choose your payment method, and confirm. You\'ll receive a confirmation email with your receipt. You can donate anonymously if you prefer.' },
      { q: 'Is there a minimum or maximum donation?', a: 'Minimum is $1 USD (or equivalent). No maximum, though large donations may require additional verification. Enterprise organizations can set custom minimums for their campaigns.' },
      { q: 'Can I get a refund on my donation?', a: 'Refunds are available within 14 days if the campaign hasn\'t withdrawn the funds. For campaigns that are suspended or found fraudulent, full refunds are processed automatically. Visit your donation history to request a refund.' },
    ],
  },
  {
    id: 'payments',
    icon: <PaymentsRoundedIcon />,
    label: 'Payments',
    color: '#F9A825',
    questions: [
      { q: 'What payment methods are accepted?', a: 'Mobile money (M-Pesa, MTN MoMo, Airtel Money, Orange Money), bank transfers, cards (Visa, Mastercard, Verve), and cryptocurrency (Bitcoin, USDT). Available methods vary by country.' },
      { q: 'How do I withdraw my campaign funds?', a: 'Go to your dashboard and click "Withdraw." Choose mobile money (processed within 24 hours) or bank transfer (2-3 business days). International transfers may take up to 5 business days. Platform fees are automatically deducted.' },
      { q: 'What are the platform fees?', a: 'Fees depend on your subscription tier. Free accounts pay 5% platform fee. Starter (3.5%), Pro (2%), and Enterprise (1%). All tiers incur standard payment processing fees (2.9% + $0.30). See our pricing page for details.' },
    ],
  },
  {
    id: 'trust',
    icon: <ShieldRoundedIcon />,
    label: 'Trust & Safety',
    color: '#6A1B9A',
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
    color: '#00695C',
    questions: [
      { q: 'How do I register as an organization?', a: 'During registration, select "Organization" as your account type. Provide your organization name, registration number, and type (NGO, hospital, school, etc.). Complete verification with official documents for priority trust status.' },
      { q: 'What features are available for organizations?', a: 'Organizations get: branded campaign pages, team management, advanced analytics, automated tax receipts, recurring donation support, API access, and dedicated account management. See our "For Organizations" page for tier details.' },
    ],
  },
]

const QUICK_LINKS = [
  { icon: <MenuBookRoundedIcon />, label: 'Getting Started Guide', description: 'Step-by-step walkthrough for new users', target: 'getting-started' },
  { icon: <CampaignRoundedIcon />, label: 'Campaign Best Practices', description: 'Tips to maximize your fundraising', target: 'campaigns' },
  { icon: <PaymentsRoundedIcon />, label: 'Payment Methods', description: 'All supported payment options by country', target: 'payments' },
  { icon: <ShieldRoundedIcon />, label: 'Trust & Verification', description: 'How our trust system works', target: 'trust' },
]

// ─── Component ───────────────────────────────────────────────────────────────

function HelpPage() {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

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

  return (
    <Box component="main" sx={{ flex: 1, pt: { xs: 4, md: 6 }, pb: 8 }}>
      <Container maxWidth="lg">

        {/* ═══ Search ═══ */}
        <Box sx={{ maxWidth: 600, mx: 'auto', mb: 5, animation: `${fadeSlide} 0.4s ease both` }}>
          <TextField
            fullWidth
            placeholder="Search for answers..."
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
                py: 0.5,
                boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
                '&.Mui-focused': { boxShadow: '0 4px 20px rgba(46,125,50,0.1)' },
              },
            }}
          />
          {search && (
            <Typography sx={{ mt: 1, fontSize: '0.82rem', color: 'text.secondary', textAlign: 'center' }}>
              {totalResults} result{totalResults !== 1 ? 's' : ''} found
              {totalResults === 0 && ' — try a different search term'}
            </Typography>
          )}
        </Box>

        {/* ═══ Quick Links ═══ */}
        {!search && !activeCategory && (
          <Grid container spacing={2} sx={{ mb: 6 }}>
            {QUICK_LINKS.map((link, i) => (
              <Grid size={{ xs: 12, sm: 6, md: 3 }} key={link.label}>
                <Card
                  elevation={0}
                  onClick={() => setActiveCategory(link.target)}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: SHAPE.card,
                    height: '100%',
                    cursor: 'pointer',
                    animation: `${fadeSlide} 0.35s ease ${i * 0.06}s both`,
                    transition: 'all 0.25s ease',
                    '&:hover': {
                      borderColor: 'primary.main',
                      transform: 'translateY(-4px)',
                      boxShadow: '0 8px 24px rgba(46,125,50,0.08)',
                      '& .quick-icon': { bgcolor: 'primary.main', color: '#fff', transform: 'scale(1.1)' },
                    },
                  }}
                >
                  <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <Box
                      className="quick-icon"
                      sx={{
                        width: 48, height: 48, borderRadius: SHAPE.sm,
                        bgcolor: 'rgba(46,125,50,0.08)', color: 'primary.main',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.25s ease', '& svg': { fontSize: 24 },
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
        )}

        {/* ═══ Category Chips ═══ */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 4, justifyContent: 'center', animation: `${fadeSlide} 0.4s ease 0.1s both` }}>
          <Chip
            label="All Topics"
            onClick={() => setActiveCategory(null)}
            sx={{
              fontWeight: 600, fontSize: '0.85rem', borderRadius: SHAPE.sm,
              border: '1.5px solid', borderColor: !activeCategory ? 'primary.main' : 'divider',
              bgcolor: !activeCategory ? 'rgba(46,125,50,0.08)' : 'transparent',
              color: !activeCategory ? 'primary.main' : 'text.primary',
              transition: 'all 0.2s ease', '&:hover': { borderColor: 'primary.light' },
            }}
          />
          {FAQ_CATEGORIES.map((cat) => (
            <Chip
              key={cat.id}
              icon={<Box sx={{ display: 'flex', '& svg': { fontSize: '16px !important' } }}>{cat.icon}</Box>}
              label={cat.label}
              onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
              sx={{
                fontWeight: 600, fontSize: '0.85rem', borderRadius: SHAPE.sm,
                border: '1.5px solid',
                borderColor: activeCategory === cat.id ? cat.color : 'divider',
                bgcolor: activeCategory === cat.id ? `${cat.color}12` : 'transparent',
                color: activeCategory === cat.id ? cat.color : 'text.primary',
                transition: 'all 0.2s ease',
                '&:hover': { borderColor: cat.color, bgcolor: `${cat.color}06` },
                '& .MuiChip-icon': { color: activeCategory === cat.id ? cat.color : 'text.secondary' },
              }}
            />
          ))}
        </Box>

        {/* ═══ FAQ Sections ═══ */}
        <Box sx={{ maxWidth: 800, mx: 'auto' }}>
          {filteredCategories.map((cat, catIdx) => (
            <Box key={cat.id} id={cat.id} sx={{ mb: 5, animation: `${fadeSlide} 0.35s ease ${catIdx * 0.06}s both` }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                <Box sx={{ width: 40, height: 40, borderRadius: SHAPE.sm, bgcolor: `${cat.color}12`, color: cat.color, display: 'flex', alignItems: 'center', justifyContent: 'center', '& svg': { fontSize: 22 } }}>
                  {cat.icon}
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 800, fontSize: '1.1rem' }}>{cat.label}</Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                    {cat.questions.length} question{cat.questions.length !== 1 ? 's' : ''}
                  </Typography>
                </Box>
              </Box>

              {cat.questions.map((faq) => (
                <Accordion
                  key={faq.q}
                  elevation={0}
                  disableGutters
                  sx={{
                    border: '1px solid', borderColor: 'divider', borderRadius: SHAPE.sm, mb: 1.5,
                    '&::before': { display: 'none' },
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                    '&:hover': { borderColor: `${cat.color}40` },
                    '&.Mui-expanded': { borderColor: cat.color, boxShadow: `0 4px 16px ${cat.color}10` },
                  }}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMoreRoundedIcon />}
                    sx={{ px: 3, py: 0.5, '& .MuiAccordionSummary-content': { my: 1.5 }, '&.Mui-expanded .MuiAccordionSummary-expandIconWrapper': { color: cat.color } }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: cat.color, flexShrink: 0, mt: 0.25 }} />
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
            <Box sx={{ textAlign: 'center', py: 8, animation: `${fadeSlide} 0.3s ease both` }}>
              <SearchRoundedIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
              <Typography sx={{ fontWeight: 700, mb: 0.5 }}>No results found</Typography>
              <Typography sx={{ color: 'text.secondary', fontSize: '0.9rem', mb: 2 }}>Try adjusting your search or browse all topics</Typography>
              <Button onClick={() => { setSearch(''); setActiveCategory(null) }} variant="outlined" sx={{ borderRadius: SHAPE.sm, textTransform: 'none', fontWeight: 600 }}>
                Clear Search
              </Button>
            </Box>
          )}
        </Box>

        {/* ═══ Contact CTA ═══ */}
        <Box sx={{ mt: 8, borderRadius: SHAPE.card, overflow: 'hidden', border: '1px solid', borderColor: 'divider', animation: `${fadeSlide} 0.4s ease 0.3s both` }}>
          <Grid container>
            <Grid size={{ xs: 12, md: 5 }}>
              <Box
                sx={{
                  p: { xs: 4, md: 5 },
                  background: 'linear-gradient(135deg, #1B5E20, #2E7D32)',
                  color: '#fff', height: '100%',
                  display: 'flex', flexDirection: 'column', justifyContent: 'center',
                  position: 'relative', overflow: 'hidden',
                }}
              >
                <Box sx={{ position: 'absolute', inset: 0, opacity: 0.05, backgroundImage: 'repeating-linear-gradient(90deg, #F9A825 0px, #F9A825 3px, transparent 3px, transparent 16px), repeating-linear-gradient(0deg, #C75B39 0px, #C75B39 3px, transparent 3px, transparent 16px)', pointerEvents: 'none' }} />
                <Box sx={{ position: 'relative', zIndex: 1 }}>
                  <SupportAgentRoundedIcon sx={{ fontSize: 40, mb: 2, opacity: 0.8 }} />
                  <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>Still Need Help?</Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.75)', lineHeight: 1.7, fontSize: '0.95rem' }}>
                    Our support team is available Monday through Saturday, 8am-8pm WAT. We typically respond within a few hours.
                  </Typography>
                </Box>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 7 }}>
              <Box sx={{ p: { xs: 3, md: 5 } }}>
                <Stack spacing={2.5}>
                  {[
                    { icon: <EmailRoundedIcon />, title: 'Email Support', desc: 'support@ubuntufund.com', detail: 'Response within 24 hours', action: 'Send Email', href: 'mailto:support@ubuntufund.com', color: '#1565C0' },
                    { icon: <ChatBubbleOutlineRoundedIcon />, title: 'Live Chat', desc: 'Chat with our team in real time', detail: 'Mon-Sat, 8am-8pm WAT', action: 'Start Chat', href: '/contact', color: '#2E7D32' },
                    { icon: <GroupsRoundedIcon />, title: 'Community Forum', desc: 'Get help from other UbuntuFund users', detail: '5,000+ active members', action: 'Visit Forum', href: '/contact', color: '#6A1B9A' },
                  ].map((opt) => (
                    <Box
                      key={opt.title}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 2, p: 2,
                        borderRadius: SHAPE.card, border: '1px solid', borderColor: 'divider',
                        transition: 'all 0.25s ease',
                        '&:hover': { borderColor: `${opt.color}40`, bgcolor: `${opt.color}04`, '& .opt-icon': { bgcolor: opt.color, color: '#fff' } },
                      }}
                    >
                      <Box
                        className="opt-icon"
                        sx={{
                          width: 44, height: 44, borderRadius: SHAPE.sm,
                          bgcolor: `${opt.color}10`, color: opt.color,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0, transition: 'all 0.25s ease', '& svg': { fontSize: 22 },
                        }}
                      >
                        {opt.icon}
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>{opt.title}</Typography>
                        <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>{opt.desc}</Typography>
                      </Box>
                      <Button
                        href={opt.href}
                        size="small"
                        endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: '16px !important' }} />}
                        sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.8rem', flexShrink: 0, color: opt.color, '&:hover': { bgcolor: `${opt.color}08` } }}
                      >
                        {opt.action}
                      </Button>
                    </Box>
                  ))}
                </Stack>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Container>
    </Box>
  )
}

export default HelpPage

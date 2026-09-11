import { useState } from 'react'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import { BrandedTextField as TextField } from '@ubuntu-fund/ui'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import LocationOnRoundedIcon from '@mui/icons-material/LocationOnRounded'
import EmailRoundedIcon from '@mui/icons-material/EmailRounded'
import SendRoundedIcon from '@mui/icons-material/SendRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded'
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded'
import HandshakeRoundedIcon from '@mui/icons-material/HandshakeRounded'
import BugReportRoundedIcon from '@mui/icons-material/BugReportRounded'
import FacebookIcon from '@mui/icons-material/Facebook'
import XIcon from '@mui/icons-material/X'
import InstagramIcon from '@mui/icons-material/Instagram'
import LinkedInIcon from '@mui/icons-material/LinkedIn'
import YouTubeIcon from '@mui/icons-material/YouTube'
import { SHAPE } from '@ubuntu-fund/ui'
import { useContent } from '../hooks/useContent'
import { InternalPageHero } from '../components/InternalPageHero'

// ─── Data ────────────────────────────────────────────────────────────────────

// CMS block for key 'contact' — current hardcoded values kept as the runtime fallback.
// Channels and social links are assembled from this inside the component (icons are JSX
// and stay in code).
const CONTACT_FALLBACK = {
  email: 'support@ujimora.com',
  phone: '',
  address: '',
  hours: 'Support availability is confirmed by email',
  socials: {
    facebook: '',
    x: '',
    instagram: '',
    linkedin: '',
    youtube: '',
  },
}

const INQUIRY_TYPES = [
  { value: 'general', label: 'General inquiry', icon: <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 18 }} /> },
  { value: 'partnership', label: 'Partnership', icon: <HandshakeRoundedIcon sx={{ fontSize: 18 }} /> },
  { value: 'campaign', label: 'Campaign support', icon: <GroupsRoundedIcon sx={{ fontSize: 18 }} /> },
  { value: 'bug', label: 'Report a bug', icon: <BugReportRoundedIcon sx={{ fontSize: 18 }} /> },
]

const FAQ = [
  { q: 'How long does it take to get a response?', a: 'Response times vary during launch readiness. Submit the form with enough detail for the team to route and investigate your request.' },
  { q: 'I have an issue with my campaign. Who should I contact?', a: 'Select "Campaign support" as your inquiry type and include the campaign link plus a concise description. Do not send passwords or access tokens.' },
  { q: 'How can I partner with Ujimora?', a: 'We welcome partnerships with NGOs, corporations, and government bodies. Select "Partnership" as your inquiry type, or email sales@ujimora.com directly.' },
  { q: 'Where are your offices located?', a: 'No public walk-in office is listed during launch readiness. Use the contact form before attempting an in-person visit.' },
  { q: 'How do I report suspected fraud?', a: 'Use the campaign report action or email trust@ujimora.com with the campaign link and relevant evidence. Do not publish sensitive identity documents.' },
]

const OFFICES = [{ city: 'Online support', country: 'Serving Ghana during launch readiness', hq: false }]

const RESPONSE_TIMES = [
  { label: 'General inquiries', time: 'No guaranteed SLA' },
  { label: 'Campaign issues', time: 'Reviewed by support' },
  { label: 'Partnership requests', time: 'Reviewed by support' },
  { label: 'Fraud reports', time: 'Prioritized for review' },
]

// ─── Shared styles ───────────────────────────────────────────────────────────

const eyebrowSx = {
  fontSize: '0.7rem',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.2em',
  color: 'secondary.dark',
}

// ─── Component ───────────────────────────────────────────────────────────────

function ContactPage() {
  // Runtime CMS: contact details + social links (key 'contact'), falling back to the
  // hardcoded defaults when the CMS is unreachable.
  const contact = useContent('contact', CONTACT_FALLBACK)

  const CONTACT_CHANNELS = [
    { icon: <EmailRoundedIcon />, label: 'Email support', value: contact.email, detail: 'Send account, campaign, or general questions' },
    { icon: <ChatBubbleOutlineRoundedIcon />, label: 'Support hours', value: contact.hours, detail: 'Availability is confirmed before a live conversation' },
    { icon: <LocationOnRoundedIcon />, label: 'Ghana operations', value: contact.address || 'Serving communities across Ghana', detail: 'No public walk-in office is listed at launch' },
    { icon: <GroupsRoundedIcon />, label: 'Organization help', value: 'Verification and team access', detail: 'Use the form and select Campaign support' },
  ]

  const SOCIAL_LINKS = [
    { icon: <FacebookIcon />, label: 'Facebook', href: contact.socials.facebook },
    { icon: <XIcon />, label: 'X', href: contact.socials.x },
    { icon: <InstagramIcon />, label: 'Instagram', href: contact.socials.instagram },
    { icon: <LinkedInIcon />, label: 'LinkedIn', href: contact.socials.linkedin },
    { icon: <YouTubeIcon />, label: 'YouTube', href: contact.socials.youtube },
  ].filter((social) => social.href)

  const [formData, setFormData] = useState({ name: '', email: '', subject: '', type: 'general', message: '' })
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [snackOpen, setSnackOpen] = useState(false)
  const [snackError, setSnackError] = useState('')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setSnackError('')
    try {
      const res = await fetch('/api/v1/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          subject: formData.subject,
          inquiryType: formData.type,
          message: formData.message,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message ?? 'Failed to submit')
      setSubmitted(true)
      setSnackOpen(true)
    } catch (err) {
      setSnackError(err instanceof Error ? err.message : 'Failed to submit')
      setSnackOpen(true)
    } finally {
      setSubmitting(false)
    }
  }

  const handleReset = () => {
    setFormData({ name: '', email: '', subject: '', type: 'general', message: '' })
    setSubmitted(false)
  }

  return (
    <Box component="main" sx={{ flex: 1, pb: { xs: 8, md: 10 } }}>
      <InternalPageHero
        eyebrow="Get in touch"
        title="Bring us the full context"
        description="Ask a question, discuss an organization workflow, report a problem, or share a partnership idea with the Ujimora team."
        icon={<ChatBubbleOutlineRoundedIcon />}
        panelLabel="Support record"
        panelTitle="Clear requests lead to clearer answers."
        panelBody="Include the page, account role, and action you were taking so the team can follow the issue through."
      />
      <Container maxWidth="lg">

        {/* ═══ Page intro ═══ */}
        <Box sx={{ display: 'none', textAlign: 'center', maxWidth: 640, mx: 'auto', mb: { xs: 6, md: 8 } }}>
          <Typography sx={eyebrowSx}>Get in touch</Typography>
          <Typography variant="h2" sx={{ mt: 1, mb: 2, fontSize: { xs: '2rem', md: '2.5rem' } }}>
            Contact us
          </Typography>
          <Typography sx={{ color: 'text.secondary' }}>
            Have a question, a partnership idea, or an issue to report? Send us a message and our team will get back to you.
          </Typography>
        </Box>

        {/* ═══ Contact Channels ═══ */}
        <Grid container spacing={{ xs: 2, md: 3 }} sx={{ mt: { xs: 6, md: 8 }, mb: { xs: 6, md: 8 } }}>
          {CONTACT_CHANNELS.map((ch, index) => (
            <Grid size={{ xs: 12, sm: 6 }} key={ch.label}>
              <Card elevation={0} sx={{ height: '100%', position: 'relative', overflow: 'hidden', transition: 'transform 180ms ease, box-shadow 180ms ease', '&:hover': { transform: 'translateY(-2px)', boxShadow: 'var(--neu-raised-hover)' } }}>
                <Typography aria-hidden sx={{ position: 'absolute', right: 22, top: 14, fontSize: '2.5rem', fontWeight: 900, color: 'primary.main', opacity: .055, fontVariantNumeric: 'tabular-nums' }}>0{index + 1}</Typography>
                <CardContent sx={{ p: { xs: 2.5, md: 3.5 }, display: 'flex', alignItems: 'flex-start', gap: 2.5, '&:last-child': { pb: { xs: 2.5, md: 3.5 } } }}>
                  <Box
                    sx={{
                      width: 52,
                      height: 52,
                      flexShrink: 0,
                      borderRadius: SHAPE.sm,
                      bgcolor: 'var(--neu-surface)',
                      boxShadow: 'var(--neu-subtle)',
                      color: 'primary.main',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      '& svg': { fontSize: 24 },
                    }}
                  >
                    {ch.icon}
                  </Box>
                  <Box sx={{ minWidth: 0, pt: .15 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: '1rem', mb: 0.65 }}>{ch.label}</Typography>
                    <Typography sx={{ fontSize: '0.9rem', color: 'text.primary', fontWeight: 600, mb: 0.65, overflowWrap: 'anywhere' }}>{ch.value}</Typography>
                    <Typography sx={{ fontSize: '0.76rem', color: 'text.secondary', lineHeight: 1.55 }}>{ch.detail}</Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Grid container spacing={{ xs: 4, md: 5 }}>
          {/* ═══ Contact Form ═══ */}
          <Grid size={{ xs: 12, md: 7 }}>
            <Card elevation={0} sx={{ overflow: 'hidden' }}>
              <Box
                sx={{
                  px: 4,
                  py: 3,
                  bgcolor: 'background.default',
                  boxShadow: 'var(--neu-inset)',
                }}
              >
                <Typography variant="h5" sx={{ mb: 0.5 }}>Send us a message</Typography>
                <Typography sx={{ fontSize: '0.88rem', color: 'text.secondary' }}>
                  Share enough detail for the team to route and investigate your request.
                </Typography>
              </Box>

              <CardContent sx={{ p: 4 }}>
                {submitted ? (
                  /* Success State */
                  <Box sx={{ textAlign: 'center', py: 6 }}>
                    <Box
                      sx={{
                        width: 72,
                        height: 72,
                        borderRadius: '50%',
                        bgcolor: 'rgba(46, 61, 47, 0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 3,
                      }}
                    >
                      <CheckCircleRoundedIcon sx={{ fontSize: 40, color: 'primary.main' }} />
                    </Box>
                    <Typography variant="h5" sx={{ mb: 1 }}>Message sent</Typography>
                    <Typography sx={{ color: 'text.secondary', mb: 3, maxWidth: 400, mx: 'auto' }}>
                      Thank you for reaching out. Our team will review your message and get back to you within 24 hours.
                    </Typography>
                    <Button
                      variant="outlined"
                      onClick={handleReset}
                      sx={{ borderRadius: '999px', px: 4 }}
                    >
                      Send another message
                    </Button>
                  </Box>
                ) : (
                  /* Form */
                  <Box component="form" onSubmit={handleSubmit}>
                    {/* Inquiry type chips */}
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: 'text.secondary', mb: 1.5 }}>
                      What can we help you with?
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
                      {INQUIRY_TYPES.map((t) => (
                        <Chip
                          key={t.value}
                          icon={t.icon}
                          label={t.label}
                          onClick={() => setFormData({ ...formData, type: t.value })}
                          sx={{
                            fontWeight: 600,
                            fontSize: '0.82rem',
                            border: '1.5px solid',
                            borderColor: formData.type === t.value ? 'primary.main' : 'divider',
                            bgcolor: formData.type === t.value ? 'rgba(46, 61, 47, 0.08)' : 'transparent',
                            color: formData.type === t.value ? 'primary.main' : 'text.primary',
                            '&:hover': { borderColor: 'primary.light' },
                          }}
                        />
                      ))}
                    </Box>

                    <Grid container spacing={2.5}>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          fullWidth label="Your name" name="name"
                          value={formData.name} onChange={handleChange} required
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: SHAPE.card } }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          fullWidth label="Email address" name="email" type="email"
                          value={formData.email} onChange={handleChange} required
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: SHAPE.card } }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <TextField
                          fullWidth label="Subject" name="subject"
                          value={formData.subject} onChange={handleChange} required
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: SHAPE.card } }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <TextField
                          fullWidth label="Your message" name="message"
                          multiline rows={5}
                          value={formData.message} onChange={handleChange} required
                          placeholder="Tell us how we can help..."
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: SHAPE.card } }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <Button
                          type="submit"
                          variant="contained"
                          color="secondary"
                          size="large"
                          disabled={submitting}
                          endIcon={submitting ? undefined : <SendRoundedIcon />}
                          sx={{ borderRadius: '999px', px: 5 }}
                        >
                          {submitting ? 'Sending...' : 'Send message'}
                        </Button>
                      </Grid>
                    </Grid>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* ═══ Sidebar ═══ */}
          <Grid size={{ xs: 12, md: 5 }}>
            <Stack spacing={3}>
              {/* Offices */}
              <Card elevation={0}>
                <CardContent sx={{ p: 3 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: '1rem', mb: 2 }}>Support location</Typography>
                  <Stack spacing={1.5}>
                    {OFFICES.map((office) => (
                      <Box
                        key={office.city}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                          p: 1.5,
                          borderRadius: SHAPE.card,
                          bgcolor: office.hq ? 'rgba(46, 61, 47, 0.04)' : 'transparent',
                        }}
                      >
                        <Box sx={{ flex: 1 }}>
                          <Typography sx={{ fontWeight: 600, fontSize: '0.88rem' }}>
                            {office.city}
                            {office.hq && (
                              <Chip
                                label="HQ"
                                size="small"
                                sx={{
                                  ml: 1,
                                  height: 20,
                                  fontSize: '0.65rem',
                                  fontWeight: 700,
                                  bgcolor: 'primary.main',
                                  color: 'primary.contrastText',
                                }}
                              />
                            )}
                          </Typography>
                          <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>{office.country}</Typography>
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>

              {/* Social Links */}
              <Card elevation={0}>
                <CardContent sx={{ p: 3 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: '1rem', mb: 2 }}>Follow us</Typography>
                  <Stack direction="row" spacing={1}>
                    {SOCIAL_LINKS.map((social) => (
                      <IconButton
                        key={social.label}
                        component="a"
                        href={social.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={social.label}
                        sx={{
                          width: 44,
                          height: 44,
                          border: '1.5px solid',
                          borderColor: 'divider',
                          borderRadius: SHAPE.sm,
                          color: 'text.secondary',
                          '&:hover': {
                            color: 'secondary.dark',
                            borderColor: 'secondary.main',
                            bgcolor: 'rgba(199, 162, 74, 0.08)',
                          },
                        }}
                      >
                        {social.icon}
                      </IconButton>
                    ))}
                  </Stack>
                </CardContent>
              </Card>

              {/* Response SLA */}
              <Card elevation={0}>
                <CardContent sx={{ p: 3 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: '1rem', mb: 1.5 }}>Response times</Typography>
                  {RESPONSE_TIMES.map((sla) => (
                    <Box key={sla.label} sx={{ display: 'flex', justifyContent: 'space-between', py: 1, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 'none' } }}>
                      <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>{sla.label}</Typography>
                      <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: 'secondary.dark' }}>{sla.time}</Typography>
                    </Box>
                  ))}
                </CardContent>
              </Card>
            </Stack>
          </Grid>
        </Grid>

        {/* ═══ FAQ Section ═══ */}
        <Box sx={{ mt: { xs: 8, md: 10 } }}>
          <Box sx={{ textAlign: 'center', maxWidth: 500, mx: 'auto', mb: 4 }}>
            <Typography sx={eyebrowSx}>FAQ</Typography>
            <Typography variant="h3" sx={{ mt: 1, mb: 2, fontSize: { xs: '1.5rem', md: '1.75rem' } }}>
              Frequently asked questions
            </Typography>
            <Typography sx={{ color: 'text.secondary' }}>
              Quick answers to common questions about contacting us.
            </Typography>
          </Box>
          <Box sx={{ maxWidth: 700, mx: 'auto' }}>
            {FAQ.map((item, i) => (
              <Accordion
                key={i}
                elevation={0}
                disableGutters
                sx={{
                  boxShadow: 'var(--neu-raised)',
                  borderRadius: SHAPE.sm,
                  mb: 1.5,
                  '&::before': { display: 'none' },
                  '&:hover': { borderColor: 'secondary.light' },
                  '&.Mui-expanded': { borderColor: 'secondary.main' },
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreRoundedIcon />}
                  sx={{ px: 3, py: 0.5, '& .MuiAccordionSummary-content': { my: 1.5 } }}
                >
                  <Typography sx={{ fontWeight: 600, fontSize: '0.92rem' }}>{item.q}</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 3, pb: 2.5, pt: 0 }}>
                  <Typography sx={{ fontSize: '0.88rem', color: 'text.secondary', lineHeight: 1.7 }}>
                    {item.a}
                  </Typography>
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        </Box>
      </Container>

      <Snackbar open={snackOpen} autoHideDuration={4000} onClose={() => setSnackOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert
          onClose={() => setSnackOpen(false)}
          icon={!snackError ? <CheckCircleRoundedIcon /> : undefined}
          severity={snackError ? 'error' : 'success'}
          variant="filled"
          sx={{ borderRadius: SHAPE.sm, fontWeight: 600 }}
        >
          {snackError || 'Message sent successfully!'}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default ContactPage

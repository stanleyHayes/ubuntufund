import { useState } from 'react'
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import TextField from '@mui/material/TextField'
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
import PhoneRoundedIcon from '@mui/icons-material/PhoneRounded'
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded'
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

// ─── Data ────────────────────────────────────────────────────────────────────

const CONTACT_CHANNELS = [
  {
    icon: <LocationOnRoundedIcon />,
    label: 'Visit us',
    value: '14 Independence Avenue, Accra, Ghana',
    detail: 'Mon-Fri, 9am-5pm WAT',
  },
  {
    icon: <EmailRoundedIcon />,
    label: 'Email us',
    value: 'hello@ubuntufund.com',
    detail: 'Response within 24 hours',
  },
  {
    icon: <PhoneRoundedIcon />,
    label: 'Call us',
    value: '+233 30 123 4567',
    detail: 'Mon-Fri, 9am-5pm WAT',
  },
  {
    icon: <AccessTimeRoundedIcon />,
    label: 'Live chat',
    value: 'Available on platform',
    detail: 'Mon-Sat, 8am-8pm WAT',
  },
]

const INQUIRY_TYPES = [
  { value: 'general', label: 'General inquiry', icon: <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 18 }} /> },
  { value: 'partnership', label: 'Partnership', icon: <HandshakeRoundedIcon sx={{ fontSize: 18 }} /> },
  { value: 'campaign', label: 'Campaign support', icon: <GroupsRoundedIcon sx={{ fontSize: 18 }} /> },
  { value: 'bug', label: 'Report a bug', icon: <BugReportRoundedIcon sx={{ fontSize: 18 }} /> },
]

const SOCIAL_LINKS = [
  { icon: <FacebookIcon />, label: 'Facebook', href: 'https://facebook.com/ubuntufund' },
  { icon: <XIcon />, label: 'X', href: 'https://x.com/ubuntufund' },
  { icon: <InstagramIcon />, label: 'Instagram', href: 'https://instagram.com/ubuntufund' },
  { icon: <LinkedInIcon />, label: 'LinkedIn', href: 'https://linkedin.com/company/ubuntufund' },
  { icon: <YouTubeIcon />, label: 'YouTube', href: 'https://youtube.com/@ubuntufund' },
]

const FAQ = [
  { q: 'How long does it take to get a response?', a: 'We typically respond within 24 hours on business days. For urgent matters, please call our phone line or use the live chat during business hours.' },
  { q: 'I have an issue with my campaign. Who should I contact?', a: 'For campaign-related issues, select "Campaign support" as your inquiry type. Our campaign team will prioritize your request and respond within 12 hours.' },
  { q: 'How can I partner with UbuntuFund?', a: 'We welcome partnerships with NGOs, corporations, and government bodies. Select "Partnership" as your inquiry type, or email partnerships@ubuntufund.com directly.' },
  { q: 'Where are your offices located?', a: 'Our headquarters is in Accra, Ghana. We also have satellite offices in Nairobi (Kenya), Lagos (Nigeria), and Cape Town (South Africa). We are expanding across the continent.' },
  { q: 'Is there a dedicated number for reporting fraud?', a: 'Yes. For fraud or suspicious activity, email trust@ubuntufund.com or call our dedicated trust line at +233 30 123 4599 (24/7).' },
]

const OFFICES = [
  { city: 'Accra', country: 'Ghana', hq: true },
  { city: 'Nairobi', country: 'Kenya', hq: false },
  { city: 'Lagos', country: 'Nigeria', hq: false },
  { city: 'Cape Town', country: 'South Africa', hq: false },
]

const RESPONSE_TIMES = [
  { label: 'General inquiries', time: '< 24 hours' },
  { label: 'Campaign issues', time: '< 12 hours' },
  { label: 'Partnership requests', time: '< 48 hours' },
  { label: 'Fraud reports', time: '< 2 hours' },
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
    <Box component="main" sx={{ flex: 1, pt: { xs: 6, md: 8 }, pb: { xs: 8, md: 10 } }}>
      <Container maxWidth="lg">

        {/* ═══ Page intro ═══ */}
        <Box sx={{ textAlign: 'center', maxWidth: 640, mx: 'auto', mb: { xs: 6, md: 8 } }}>
          <Typography sx={eyebrowSx}>Get in touch</Typography>
          <Typography variant="h2" sx={{ mt: 1, mb: 2, fontSize: { xs: '2rem', md: '2.5rem' } }}>
            Contact us
          </Typography>
          <Typography sx={{ color: 'text.secondary' }}>
            Have a question, a partnership idea, or an issue to report? Send us a message and our team will get back to you.
          </Typography>
        </Box>

        {/* ═══ Contact Channels ═══ */}
        <Grid container spacing={2} sx={{ mb: { xs: 6, md: 8 } }}>
          {CONTACT_CHANNELS.map((ch) => (
            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={ch.label}>
              <Card elevation={0} sx={{ height: '100%' }}>
                <CardContent sx={{ p: 3, textAlign: 'center' }}>
                  <Box
                    sx={{
                      width: 52,
                      height: 52,
                      borderRadius: SHAPE.sm,
                      bgcolor: 'rgba(46, 61, 47, 0.06)',
                      color: 'primary.main',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 2,
                      '& svg': { fontSize: 24 },
                    }}
                  >
                    {ch.icon}
                  </Box>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', mb: 0.5 }}>{ch.label}</Typography>
                  <Typography sx={{ fontSize: '0.85rem', color: 'text.primary', fontWeight: 500, mb: 0.5 }}>{ch.value}</Typography>
                  <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>{ch.detail}</Typography>
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
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Typography variant="h5" sx={{ mb: 0.5 }}>Send us a message</Typography>
                <Typography sx={{ fontSize: '0.88rem', color: 'text.secondary' }}>
                  Fill out the form and our team will get back to you within 24 hours.
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
                  <Typography sx={{ fontWeight: 700, fontSize: '1rem', mb: 2 }}>Our offices</Typography>
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
                  border: '1px solid',
                  borderColor: 'divider',
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

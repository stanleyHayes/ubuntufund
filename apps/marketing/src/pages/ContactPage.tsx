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
import MenuItem from '@mui/material/MenuItem'
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
import { keyframes } from '@mui/material/styles'
import { SHAPE } from '@ubuntu-fund/ui'

// ─── Animations ──────────────────────────────────────────────────────────────

const fadeSlide = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
`

const float = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
`

// ─── Data ────────────────────────────────────────────────────────────────────

const CONTACT_CHANNELS = [
  {
    icon: <LocationOnRoundedIcon />,
    label: 'Visit Us',
    value: '14 Independence Avenue, Accra, Ghana',
    detail: 'Mon-Fri, 9am-5pm WAT',
    color: '#2E7D32',
    bgGrad: 'linear-gradient(135deg, rgba(46,125,50,0.08), rgba(46,125,50,0.02))',
  },
  {
    icon: <EmailRoundedIcon />,
    label: 'Email Us',
    value: 'hello@ubuntufund.com',
    detail: 'Response within 24 hours',
    color: '#1565C0',
    bgGrad: 'linear-gradient(135deg, rgba(21,101,192,0.08), rgba(21,101,192,0.02))',
  },
  {
    icon: <PhoneRoundedIcon />,
    label: 'Call Us',
    value: '+233 30 123 4567',
    detail: 'Mon-Fri, 9am-5pm WAT',
    color: '#C75B39',
    bgGrad: 'linear-gradient(135deg, rgba(199,91,57,0.08), rgba(199,91,57,0.02))',
  },
  {
    icon: <AccessTimeRoundedIcon />,
    label: 'Live Chat',
    value: 'Available on platform',
    detail: 'Mon-Sat, 8am-8pm WAT',
    color: '#6A1B9A',
    bgGrad: 'linear-gradient(135deg, rgba(106,27,154,0.08), rgba(106,27,154,0.02))',
  },
]

const INQUIRY_TYPES = [
  { value: 'general', label: 'General Inquiry', icon: <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 18 }} /> },
  { value: 'partnership', label: 'Partnership', icon: <HandshakeRoundedIcon sx={{ fontSize: 18 }} /> },
  { value: 'campaign', label: 'Campaign Support', icon: <GroupsRoundedIcon sx={{ fontSize: 18 }} /> },
  { value: 'bug', label: 'Report a Bug', icon: <BugReportRoundedIcon sx={{ fontSize: 18 }} /> },
]

const SOCIAL_LINKS = [
  { icon: <FacebookIcon />, label: 'Facebook', href: 'https://facebook.com/ubuntufund', color: '#1877F2' },
  { icon: <XIcon />, label: 'X', href: 'https://x.com/ubuntufund', color: '#000' },
  { icon: <InstagramIcon />, label: 'Instagram', href: 'https://instagram.com/ubuntufund', color: '#E4405F' },
  { icon: <LinkedInIcon />, label: 'LinkedIn', href: 'https://linkedin.com/company/ubuntufund', color: '#0A66C2' },
  { icon: <YouTubeIcon />, label: 'YouTube', href: 'https://youtube.com/@ubuntufund', color: '#FF0000' },
]

const FAQ = [
  { q: 'How long does it take to get a response?', a: 'We typically respond within 24 hours on business days. For urgent matters, please call our phone line or use the live chat during business hours.' },
  { q: 'I have an issue with my campaign. Who should I contact?', a: 'For campaign-related issues, select "Campaign Support" as your inquiry type. Our campaign team will prioritize your request and respond within 12 hours.' },
  { q: 'How can I partner with UbuntuFund?', a: 'We welcome partnerships with NGOs, corporations, and government bodies. Select "Partnership" as your inquiry type, or email partnerships@ubuntufund.com directly.' },
  { q: 'Where are your offices located?', a: 'Our headquarters is in Accra, Ghana. We also have satellite offices in Nairobi (Kenya), Lagos (Nigeria), and Cape Town (South Africa). We are expanding across the continent.' },
  { q: 'Is there a dedicated number for reporting fraud?', a: 'Yes. For fraud or suspicious activity, email trust@ubuntufund.com or call our dedicated trust line at +233 30 123 4599 (24/7).' },
]

const OFFICES = [
  { city: 'Accra', country: 'Ghana', flag: '🇬🇭', hq: true },
  { city: 'Nairobi', country: 'Kenya', flag: '🇰🇪', hq: false },
  { city: 'Lagos', country: 'Nigeria', flag: '🇳🇬', hq: false },
  { city: 'Cape Town', country: 'South Africa', flag: '🇿🇦', hq: false },
]

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
    <Box component="main" sx={{ flex: 1, pt: { xs: 4, md: 6 }, pb: 8 }}>
      <Container maxWidth="lg">

        {/* ═══ Contact Channels ═══ */}
        <Grid container spacing={2} sx={{ mb: 6 }}>
          {CONTACT_CHANNELS.map((ch, i) => (
            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={ch.label}>
              <Card
                elevation={0}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: SHAPE.card,
                  height: '100%',
                  animation: `${fadeSlide} 0.4s ease ${i * 0.08}s both`,
                  transition: 'all 0.25s ease',
                  cursor: 'default',
                  '&:hover': {
                    borderColor: ch.color,
                    transform: 'translateY(-4px)',
                    boxShadow: `0 8px 24px ${ch.color}15`,
                    '& .contact-icon': {
                      bgcolor: ch.color,
                      color: '#fff',
                      transform: 'scale(1.1)',
                    },
                  },
                }}
              >
                <CardContent sx={{ p: 3, textAlign: 'center' }}>
                  <Box
                    className="contact-icon"
                    sx={{
                      width: 52,
                      height: 52,
                      borderRadius: SHAPE.sm,
                      background: ch.bgGrad,
                      color: ch.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mx: 'auto',
                      mb: 2,
                      transition: 'all 0.25s ease',
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

        <Grid container spacing={5}>
          {/* ═══ Contact Form ═══ */}
          <Grid size={{ xs: 12, md: 7 }}>
            <Card
              elevation={0}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: SHAPE.card,
                overflow: 'hidden',
                animation: `${fadeSlide} 0.4s ease 0.3s both`,
              }}
            >
              {/* Header */}
              <Box
                sx={{
                  px: 4,
                  py: 3,
                  background: 'linear-gradient(135deg, rgba(46,125,50,0.04), rgba(249,168,37,0.03))',
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5 }}>Send Us a Message</Typography>
                <Typography sx={{ fontSize: '0.88rem', color: 'text.secondary' }}>
                  Fill out the form and our team will get back to you within 24 hours.
                </Typography>
              </Box>

              <CardContent sx={{ p: 4 }}>
                {submitted ? (
                  /* Success State */
                  <Box
                    sx={{
                      textAlign: 'center',
                      py: 6,
                      animation: `${fadeSlide} 0.4s ease both`,
                    }}
                  >
                    <Box
                      sx={{
                        width: 72,
                        height: 72,
                        borderRadius: '50%',
                        bgcolor: 'rgba(46,125,50,0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 3,
                        animation: `${float} 3s ease infinite`,
                      }}
                    >
                      <CheckCircleRoundedIcon sx={{ fontSize: 40, color: 'primary.main' }} />
                    </Box>
                    <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>Message Sent!</Typography>
                    <Typography sx={{ color: 'text.secondary', mb: 3, maxWidth: 400, mx: 'auto' }}>
                      Thank you for reaching out. Our team will review your message and get back to you within 24 hours.
                    </Typography>
                    <Button
                      variant="outlined"
                      onClick={handleReset}
                      sx={{ borderRadius: SHAPE.sm, textTransform: 'none', fontWeight: 600, px: 4 }}
                    >
                      Send Another Message
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
                            borderRadius: SHAPE.sm,
                            border: '1.5px solid',
                            borderColor: formData.type === t.value ? 'primary.main' : 'divider',
                            bgcolor: formData.type === t.value ? 'rgba(46,125,50,0.08)' : 'transparent',
                            color: formData.type === t.value ? 'primary.main' : 'text.primary',
                            transition: 'all 0.2s ease',
                            '&:hover': { borderColor: 'primary.light', bgcolor: 'rgba(46,125,50,0.04)' },
                          }}
                        />
                      ))}
                    </Box>

                    <Grid container spacing={2.5}>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          fullWidth label="Your Name" name="name"
                          value={formData.name} onChange={handleChange} required
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: SHAPE.card } }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          fullWidth label="Email Address" name="email" type="email"
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
                          fullWidth label="Your Message" name="message"
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
                          color="primary"
                          size="large"
                          disabled={submitting}
                          endIcon={submitting ? undefined : <SendRoundedIcon />}
                          sx={{
                            borderRadius: SHAPE.sm,
                            px: 5,
                            py: 1.5,
                            fontWeight: 700,
                            fontSize: '0.95rem',
                            textTransform: 'none',
                            boxShadow: '0 4px 16px rgba(46,125,50,0.25)',
                            transition: 'all 0.25s ease',
                            '&:hover': {
                              boxShadow: '0 6px 24px rgba(46,125,50,0.35)',
                              transform: 'translateY(-2px)',
                            },
                          }}
                        >
                          {submitting ? 'Sending...' : 'Send Message'}
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
              <Card
                elevation={0}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: SHAPE.card,
                  animation: `${fadeSlide} 0.4s ease 0.4s both`,
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: '1rem', mb: 2 }}>Our Offices</Typography>
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
                          bgcolor: office.hq ? 'rgba(46,125,50,0.04)' : 'transparent',
                          border: '1px solid',
                          borderColor: office.hq ? 'rgba(46,125,50,0.12)' : 'transparent',
                          transition: 'all 0.2s ease',
                          '&:hover': { bgcolor: 'rgba(0,0,0,0.02)' },
                        }}
                      >
                        <Typography sx={{ fontSize: '1.4rem' }}>{office.flag}</Typography>
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
                                  color: '#fff',
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
              <Card
                elevation={0}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: SHAPE.card,
                  animation: `${fadeSlide} 0.4s ease 0.5s both`,
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: '1rem', mb: 2 }}>Follow Us</Typography>
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
                          transition: 'all 0.25s ease',
                          '&:hover': {
                            color: social.color,
                            borderColor: social.color,
                            bgcolor: `${social.color}08`,
                            transform: 'translateY(-3px)',
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
              <Card
                elevation={0}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: SHAPE.card,
                  background: 'linear-gradient(135deg, rgba(249,168,37,0.04), rgba(199,91,57,0.03))',
                  animation: `${fadeSlide} 0.4s ease 0.6s both`,
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: '1rem', mb: 1.5 }}>Response Times</Typography>
                  {[
                    { label: 'General inquiries', time: '< 24 hours' },
                    { label: 'Campaign issues', time: '< 12 hours' },
                    { label: 'Partnership requests', time: '< 48 hours' },
                    { label: 'Fraud reports', time: '< 2 hours' },
                  ].map((sla) => (
                    <Box key={sla.label} sx={{ display: 'flex', justifyContent: 'space-between', py: 1, borderBottom: '1px solid', borderColor: 'rgba(0,0,0,0.04)', '&:last-child': { borderBottom: 'none' } }}>
                      <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>{sla.label}</Typography>
                      <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: 'primary.dark' }}>{sla.time}</Typography>
                    </Box>
                  ))}
                </CardContent>
              </Card>
            </Stack>
          </Grid>
        </Grid>

        {/* ═══ FAQ Section ═══ */}
        <Box sx={{ mt: 8, animation: `${fadeSlide} 0.4s ease 0.7s both` }}>
          <Typography variant="h4" sx={{ fontWeight: 800, textAlign: 'center', mb: 1 }}>
            Frequently Asked Questions
          </Typography>
          <Typography sx={{ color: 'text.secondary', textAlign: 'center', mb: 4, maxWidth: 500, mx: 'auto' }}>
            Quick answers to common questions about contacting us.
          </Typography>
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
                  transition: 'border-color 0.2s ease',
                  '&:hover': { borderColor: 'primary.light' },
                  '&.Mui-expanded': { borderColor: 'primary.main' },
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

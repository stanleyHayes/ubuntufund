import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Container, Link, Typography } from '@mui/material'
import CurrencyExchangeRoundedIcon from '@mui/icons-material/CurrencyExchangeRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import { InternalPageHero } from '../components/InternalPageHero'
import { useSeo, SITE_ORIGIN } from '@/lib/seo'
import { breadcrumbList } from '@ubuntu-fund/ui'

const questions = [
  ['Why can’t I see Crypto at checkout?', 'Crypto appears only when it is enabled and supported currencies are available. Use one of the other payment methods shown if the option is missing.'],
  ['Which currency and network should I choose?', 'Use only a currency and network offered in the checkout. Match both to your sending wallet. The same currency can exist on different networks; they are not interchangeable.'],
  ['What happens when the quote expires?', 'Before opening a payment address, refresh the quote to see the current rate. If the transfer window has closed, do not send to the old address. If you already sent, keep the confirmation page open and contact support if needed.'],
  ['Does a public anonymous contribution hide my blockchain transaction?', 'No. Anonymous giving hides your name on the campaign. Blockchain addresses and transfers can remain publicly visible and may be linked to other information.'],
  ['Can a crypto transfer be refunded?', 'A blockchain transfer cannot simply be reversed. Refund eligibility follows the refund policy and provider review. Contact support with your campaign and transaction references; do not assume a refund will return the same crypto quantity or use the original sending address.'],
]

export default function CryptoGuidePage() {
  useSeo({
    title: 'Crypto contribution guide | Ujimora',
    description: 'How the optional crypto checkout works: pick a supported currency and network, check the quote before it expires, then send with any required memo or tag.',
    path: '/crypto',
    type: 'website',
    jsonLd: breadcrumbList(SITE_ORIGIN, [{ name: 'Home', path: '/' }, { name: 'Crypto guide' }]),
  })
  return <>
    <InternalPageHero eyebrow="Contribution guide" title="Understand your crypto contribution." description="A guide to the optional crypto checkout: the amount you send, the network you use, and when your contribution is confirmed." icon={<CurrencyExchangeRoundedIcon />} panelLabel="One campaign currency" panelTitle="Crypto sent. Campaign value shown clearly." panelBody="Checkout shows the crypto amount alongside the campaign-currency value. Contributions are credited after provider confirmation." />
    <Container maxWidth="lg" sx={{ py: { xs: 5, md: 8 } }}>
      <Alert severity="info" sx={{ mb: 5 }}>Availability varies. This guide does not mean crypto is enabled for every campaign or that any asset or provider is endorsed.</Alert>
      <Box component="section" sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: { xs: 4, md: 8 }, mb: 7 }}>
        <Box><Typography variant="overline" color="text.secondary">Before you transfer</Typography><Typography variant="h4" component="h2" sx={{ mt: 1, mb: 2 }}>Three checks. Every contribution.</Typography><Typography color="text.secondary" sx={{ lineHeight: 1.8 }}>Your wallet and checkout must agree on the currency, network, and amount. Review the details each time you give.</Typography></Box>
        <Box component="ol" sx={{ m: 0, pl: 3 }}>{[
          ['Choose your currency', 'Select a supported currency and the matching network from checkout.'],
          ['Review the quote', 'Check the exact crypto amount, campaign value, quoted fees where shown, and expiry.'],
          ['Transfer and follow confirmation', 'Use the address shown and any required memo or tag. The page checks the payment status automatically.'],
        ].map(([title, body]) => <Box component="li" key={title} sx={{ pl: 1, pb: 3, mb: 2, borderBottom: '1px solid', borderColor: 'divider', '&::marker': { color: 'primary.main', fontWeight: 800 } }}><Typography component="h3" variant="h6" sx={{ mb: .75 }}>{title}</Typography><Typography color="text.secondary" sx={{ lineHeight: 1.7 }}>{body}</Typography></Box>)}</Box>
      </Box>
      <Box sx={{ bgcolor: '#1C261D', color: '#F5F2EA', p: { xs: 3, md: 5 }, borderRadius: 4, mb: 7 }}><Typography variant="h5" component="h2" sx={{ color: '#DCC07E', mb: 2 }}>The network matters as much as the address.</Typography><Typography sx={{ color: '#D4DBD0', lineHeight: 1.8 }}>Sending another currency, choosing another network, or omitting a required memo can result in lost funds. Never share your private key or recovery phrase. Ujimora’s contribution screen asks for neither.</Typography></Box>
      <Typography variant="h4" component="h2" sx={{ mb: 3 }}>Questions before giving</Typography>
      {questions.map(([question, answer]) => <Accordion key={question} disableGutters elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider', '&::before': { display: 'none' } }}><AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}><Typography sx={{ fontWeight: 700 }}>{question}</Typography></AccordionSummary><AccordionDetails><Typography color="text.secondary" sx={{ lineHeight: 1.8 }}>{answer}</Typography></AccordionDetails></Accordion>)}
      <Typography sx={{ mt: 4, color: 'text.secondary' }}>Read the <Link href="/contributor-terms">contributor terms</Link>, <Link href="/refund-policy">refund policy</Link>, and <Link href="/privacy">privacy notice</Link>. Need help? <Link href="/contact">Contact support</Link>.</Typography>
    </Container>
  </>
}

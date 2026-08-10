import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import { SHAPE } from '@ubuntu-fund/ui'

const sections = [
  {
    title: '1. Refund Eligibility',
    content:
      'Donors may request a refund under the following circumstances: the campaign has been identified as fraudulent or in violation of our Terms of Service; the campaign was cancelled by the organizer before any funds were disbursed; a technical error resulted in duplicate or incorrect charges; the campaign organizer has not provided any updates within 60 days and has not withdrawn funds. Refunds are generally not available for donations to campaigns that have already disbursed funds to the organizer, as those funds have already been put to use for the stated purpose.',
  },
  {
    title: '2. Refund Timeframes',
    content:
      'A donor can submit a refund request from donation history or contact support. The request is recorded for review, but approval and wallet settlement are not automatic and no processing timeframe is promised.',
  },
  {
    title: '3. Refund Amounts and Fees',
    content:
      'Approved refund amounts depend on the available wallet balance, campaign status, transaction record, and whether funds have already been operationally disbursed. External processing fees do not apply while external payment providers remain disabled.',
  },
  {
    title: '4. How to Request a Refund',
    content:
      'Open the relevant donation in your donation history and submit the refund form, or email refunds@ubuntufund.com with your account email, campaign, transaction reference, amount, and reason. Do not send a password, access token, or full identity document by email.',
  },
  {
    title: '5. Campaign Organizer Refunds',
    content:
      'Campaign organizers who wish to return funds should contact support. Campaign cancellation does not trigger an automatic refund; each affected transaction must be reviewed through the controlled support process.',
  },
  {
    title: '6. Disputed Transactions',
    content:
      'If you do not recognize a charge from UbuntuFund on your payment statement, please contact us before filing a dispute with your payment provider. We can often resolve issues more quickly through direct communication. Filing a dispute or chargeback with your payment provider may result in your UbuntuFund account being temporarily suspended until the matter is resolved.',
  },
  {
    title: '7. Non-Refundable Items',
    content:
      'Paid subscription and featured-placement fees are not collected during launch readiness. A contribution may be ineligible for reversal if the related value is no longer available in the wallet system or has already been operationally disbursed, subject to review and applicable law.',
  },
  {
    title: '8. Contact Us',
    content:
      'For refund-related questions, use the in-app request workflow or contact refunds@ubuntufund.com. No guaranteed response or settlement window applies during launch readiness.',
  },
]

function RefundPolicyPage() {
  return (
    <Box component="main" sx={{ flex: 1, pt: { xs: 4, md: 6 }, pb: 8 }}>
        <Container maxWidth="md">
          <Typography variant="h3" sx={{ fontWeight: 800, mb: 1 }}>
            Refund Policy
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 6 }}>
            Last updated: January 15, 2026
          </Typography>

          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, lineHeight: 1.8 }}>
            At UbuntuFund, we want every donor to feel confident about their contributions.
            This Refund Policy outlines the circumstances under which refunds may be granted
            and the process for requesting one.
          </Typography>

          {sections.map((section) => (
            <Box key={section.title} sx={{ mb: 4 }}>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 1.5 }}>
                {section.title}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                {section.content}
              </Typography>
            </Box>
          ))}

          <Box sx={{ mt: 6, p: 3, backgroundColor: 'grey.50', borderRadius: SHAPE.card }}>
            <Typography variant="body2" color="text.secondary">
              Submit from donation history or contact <strong>refunds@ubuntufund.com</strong> with
              the relevant transaction reference.
            </Typography>
          </Box>
        </Container>
    </Box>
  )
}

export default RefundPolicyPage

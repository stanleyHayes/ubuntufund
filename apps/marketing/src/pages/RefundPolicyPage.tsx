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
      'Refund requests must be submitted within 30 days of the original donation for standard refunds. For fraud-related refunds, there is no time limit — you may submit a request at any time after the fraud is identified. Once a refund request is approved, processing times vary by payment method: credit/debit cards take 5-10 business days; mobile money refunds are processed within 2-3 business days; bank transfers take 5-7 business days; PayPal refunds are processed within 3-5 business days.',
  },
  {
    title: '3. Refund Amounts and Fees',
    content:
      'Full refunds are issued for fraud cases, technical errors, and campaigns cancelled before fund disbursement. The original donation amount will be refunded in full, including any platform fees that were charged. However, third-party payment processing fees may not be refundable, as these are charged by our payment partners and are outside our control. In cases where partial funds have been disbursed, only the remaining undisbursed portion may be eligible for refund.',
  },
  {
    title: '4. How to Request a Refund',
    content:
      'To request a refund: (1) Log in to your UbuntuFund account and navigate to your donation history. (2) Find the donation you wish to refund and click "Request Refund." (3) Select the reason for your refund request and provide any supporting details. (4) Submit the request. Our team will review your request within 3-5 business days and notify you of the outcome via email. Alternatively, you can email refunds@ubuntufund.com with your donation reference number and reason for the refund.',
  },
  {
    title: '5. Campaign Organizer Refunds',
    content:
      'Campaign organizers who wish to return funds to donors (for example, if a project cannot be completed) should contact our support team. We will work with you to facilitate the return of funds to donors. If a campaign is cancelled, any undisbursed funds will be automatically returned to donors within 14 business days.',
  },
  {
    title: '6. Disputed Transactions',
    content:
      'If you do not recognize a charge from UbuntuFund on your payment statement, please contact us before filing a dispute with your payment provider. We can often resolve issues more quickly through direct communication. Filing a dispute or chargeback with your payment provider may result in your UbuntuFund account being temporarily suspended until the matter is resolved.',
  },
  {
    title: '7. Non-Refundable Items',
    content:
      'The following are generally non-refundable: donations to campaigns that have already fully disbursed funds and provided documented proof of use; subscription fees for Pro and Enterprise plans (though unused portions may be credited toward future billing); featured campaign placement fees once the placement period has begun.',
  },
  {
    title: '8. Contact Us',
    content:
      'For refund-related questions or to submit a refund request, contact our team at refunds@ubuntufund.com or through the in-app refund request process. Our support hours are Monday through Friday, 8:00 AM to 6:00 PM GMT. We aim to acknowledge all refund requests within 24 hours.',
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
              For refund requests, contact us at <strong>refunds@ubuntufund.com</strong> or use the
              in-app refund request feature in your donation history.
            </Typography>
          </Box>
        </Container>
    </Box>
  )
}

export default RefundPolicyPage

import CurrencyExchangeRoundedIcon from '@mui/icons-material/CurrencyExchangeRounded'
import { LegalPageLayout } from '../components/LegalPageLayout'

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
      'Open the relevant donation in your donation history and submit the refund form, or email refunds@ujimora.com with your account email, campaign, transaction reference, amount, and reason. Do not send a password, access token, or full identity document by email.',
  },
  {
    title: '5. Campaign Organizer Refunds',
    content:
      'Campaign organizers who wish to return funds should contact support. Campaign cancellation does not trigger an automatic refund; each affected transaction must be reviewed through the controlled support process.',
  },
  {
    title: '6. Disputed Transactions',
    content:
      'If you do not recognize a charge from Ujimora on your payment statement, please contact us before filing a dispute with your payment provider. We can often resolve issues more quickly through direct communication. Filing a dispute or chargeback with your payment provider may result in your Ujimora account being temporarily suspended until the matter is resolved.',
  },
  {
    title: '7. Non-Refundable Items',
    content:
      'Paid subscription and featured-placement fees are not collected during launch readiness. A contribution may be ineligible for reversal if the related value is no longer available in the wallet system or has already been operationally disbursed, subject to review and applicable law.',
  },
  {
    title: '8. Contact Us',
    content:
      'For refund-related questions, use the in-app request workflow or contact refunds@ujimora.com. No guaranteed response or settlement window applies during launch readiness.',
  },
]

function RefundPolicyPage() {
  return (
    <LegalPageLayout
      eyebrow="Contribution review"
      title="Refund Policy"
      description="When a contribution may be reviewed for reversal, what information is required, and what happens next."
      icon={<CurrencyExchangeRoundedIcon />}
      panelLabel="Refund principle"
      panelTitle="Every request is tied to a real contribution record."
      panelBody="Refund requests are reviewed against campaign status, wallet activity, and the available transaction history."
      introduction="We want donors to feel confident about their contributions. This policy explains when a refund may be considered, how to submit a complete request, and why approval or settlement is not automatic."
      sections={sections}
      contact={<>Submit from donation history or email <strong>refunds@ujimora.com</strong> with the relevant transaction reference.</>}
    />
  )
}

export default RefundPolicyPage

import GavelRoundedIcon from '@mui/icons-material/GavelRounded'
import { LegalPageLayout } from '../components/LegalPageLayout'

const sections = [
  {
    title: '1. Acceptance of Terms',
    content:
      'By accessing or using Ujimora ("the Platform"), you agree to be bound by these Terms of Service. If you do not agree to these terms, you may not access or use the Platform. We reserve the right to update these terms at any time, and continued use of the Platform constitutes acceptance of any modifications.',
  },
  {
    title: '2. Eligibility',
    content:
      'You must be at least 18 years of age or the age of majority in your jurisdiction to use Ujimora. By creating an account, you represent that you meet these eligibility requirements. Organizations must be legally registered in their respective countries to create campaigns.',
  },
  {
    title: '3. Account Terms',
    content:
      'You are responsible for maintaining the security of your account and password. Ujimora cannot and will not be liable for any loss or damage from your failure to comply with this security obligation. You must provide accurate, complete, and current information during registration and keep your account information updated.',
  },
  {
    title: '4. Campaign Rules',
    content:
      'Campaign organizers must provide truthful and accurate information about their cause. Funds raised must be used for the stated purpose. Campaign organizers agree to provide updates to donors on the progress and use of funds. Ujimora reserves the right to review, suspend, or remove any campaign that violates these terms or our community guidelines. Campaigns must comply with all applicable local laws and regulations.',
  },
  {
    title: '5. Donations',
    content:
      'Donations made through Ujimora are voluntary contributions. While campaigns can move through a review workflow, Ujimora does not guarantee that funds will be used as described by campaign organizers. Donors acknowledge that contributions are made at their own discretion. Transaction history is not a tax receipt; users should obtain independent tax advice.',
  },
  {
    title: '6. Fees and Payments',
    content:
      'Current product configuration and any applicable platform fee are shown on the Pricing page before use. Ujimora Wallet is the only active launch method; external payment and payout providers are disabled until verified. Paid subscriptions and self-service external disbursement are not currently available.',
  },
  {
    title: '7. Prohibited Conduct',
    content:
      'Users may not: create fraudulent campaigns or provide false information; use the Platform for money laundering or terrorist financing; harass, abuse, or threaten other users; attempt to circumvent our verification or trust systems; scrape or collect data from the Platform without authorization; use the Platform for any illegal activity; impersonate any person or entity; or interfere with the proper functioning of the Platform.',
  },
  {
    title: '8. Intellectual Property',
    content:
      'The Ujimora name, logo, and all related marks are trademarks of Ujimora. Content uploaded by users remains the property of the respective users, but you grant Ujimora a non-exclusive license to use, display, and distribute such content in connection with the Platform\'s operation.',
  },
  {
    title: '9. Termination',
    content:
      'Ujimora may terminate or suspend your account at any time for violation of these terms. Upon termination, your right to use the Platform ceases immediately. Any pending campaign funds will be handled in accordance with our refund policy. You may also close your account at any time by contacting our support team.',
  },
  {
    title: '10. Limitation of Liability',
    content:
      'Ujimora is provided "as is" without warranty of any kind. To the maximum extent permitted by law, Ujimora shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the Platform. Our total liability shall not exceed the amount of fees paid by you to Ujimora in the twelve months preceding the claim.',
  },
  {
    title: '11. Dispute Resolution',
    content:
      'Any disputes arising from these terms or your use of Ujimora shall first be attempted to be resolved through good-faith negotiation. If negotiation fails, disputes shall be submitted to binding arbitration in accordance with the rules of the Ghana Arbitration Centre. The arbitration shall take place in Accra, Ghana.',
  },
  {
    title: '12. Governing Law',
    content:
      'These Terms of Service shall be governed by and construed in accordance with the laws of the Republic of Ghana, without regard to its conflict of law provisions. You agree to submit to the personal jurisdiction of the courts located in Accra, Ghana for any legal proceedings related to these terms.',
  },
]

function TermsPage() {
  return (
    <LegalPageLayout
      eyebrow="Platform agreement"
      title="Terms of Service"
      description="The ground rules for creating campaigns, supporting causes, and using Ujimora responsibly."
      icon={<GavelRoundedIcon />}
      panelLabel="Plain-language principle"
      panelTitle="Use the platform honestly, securely, and for its stated purpose."
      panelBody="These terms explain account responsibilities, campaign conduct, donations, and dispute handling."
      introduction="Welcome to Ujimora. These Terms of Service govern your use of our crowdfunding platform. Please read them carefully before creating an account, publishing a campaign, or making a contribution."
      sections={sections}
      contact={<>Questions about these terms can be sent to <strong>legal@ujimora.com</strong>.</>}
    />
  )
}

export default TermsPage

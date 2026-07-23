import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import { SHAPE } from '@ubuntu-fund/ui'

const sections = [
  {
    title: '1. Acceptance of Terms',
    content:
      'By accessing or using UbuntuFund ("the Platform"), you agree to be bound by these Terms of Service. If you do not agree to these terms, you may not access or use the Platform. We reserve the right to update these terms at any time, and continued use of the Platform constitutes acceptance of any modifications.',
  },
  {
    title: '2. Eligibility',
    content:
      'You must be at least 18 years of age or the age of majority in your jurisdiction to use UbuntuFund. By creating an account, you represent that you meet these eligibility requirements. Organizations must be legally registered in their respective countries to create campaigns.',
  },
  {
    title: '3. Account Terms',
    content:
      'You are responsible for maintaining the security of your account and password. UbuntuFund cannot and will not be liable for any loss or damage from your failure to comply with this security obligation. You must provide accurate, complete, and current information during registration and keep your account information updated.',
  },
  {
    title: '4. Campaign Rules',
    content:
      'Campaign organizers must provide truthful and accurate information about their cause. Funds raised must be used for the stated purpose. Campaign organizers agree to provide updates to donors on the progress and use of funds. UbuntuFund reserves the right to review, suspend, or remove any campaign that violates these terms or our community guidelines. Campaigns must comply with all applicable local laws and regulations.',
  },
  {
    title: '5. Donations',
    content:
      'Donations made through UbuntuFund are voluntary contributions. While we verify campaigns through our trust system, UbuntuFund does not guarantee that funds will be used as described by campaign organizers. Donors acknowledge that contributions are made at their own discretion. Donation receipts will be provided for tax purposes where applicable.',
  },
  {
    title: '6. Fees and Payments',
    content:
      'UbuntuFund charges a platform fee on funds raised through campaigns. Current fee structures are published on our Pricing page. Payment processing fees may apply and are subject to our payment partners\' terms. All fees are deducted before funds are disbursed to campaign organizers. We reserve the right to modify our fee structure with 30 days\' notice.',
  },
  {
    title: '7. Prohibited Conduct',
    content:
      'Users may not: create fraudulent campaigns or provide false information; use the Platform for money laundering or terrorist financing; harass, abuse, or threaten other users; attempt to circumvent our verification or trust systems; scrape or collect data from the Platform without authorization; use the Platform for any illegal activity; impersonate any person or entity; or interfere with the proper functioning of the Platform.',
  },
  {
    title: '8. Intellectual Property',
    content:
      'The UbuntuFund name, logo, and all related marks are trademarks of UbuntuFund. Content uploaded by users remains the property of the respective users, but you grant UbuntuFund a non-exclusive license to use, display, and distribute such content in connection with the Platform\'s operation.',
  },
  {
    title: '9. Termination',
    content:
      'UbuntuFund may terminate or suspend your account at any time for violation of these terms. Upon termination, your right to use the Platform ceases immediately. Any pending campaign funds will be handled in accordance with our refund policy. You may also close your account at any time by contacting our support team.',
  },
  {
    title: '10. Limitation of Liability',
    content:
      'UbuntuFund is provided "as is" without warranty of any kind. To the maximum extent permitted by law, UbuntuFund shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the Platform. Our total liability shall not exceed the amount of fees paid by you to UbuntuFund in the twelve months preceding the claim.',
  },
  {
    title: '11. Dispute Resolution',
    content:
      'Any disputes arising from these terms or your use of UbuntuFund shall first be attempted to be resolved through good-faith negotiation. If negotiation fails, disputes shall be submitted to binding arbitration in accordance with the rules of the Ghana Arbitration Centre. The arbitration shall take place in Accra, Ghana.',
  },
  {
    title: '12. Governing Law',
    content:
      'These Terms of Service shall be governed by and construed in accordance with the laws of the Republic of Ghana, without regard to its conflict of law provisions. You agree to submit to the personal jurisdiction of the courts located in Accra, Ghana for any legal proceedings related to these terms.',
  },
]

function TermsPage() {
  return (
    <Box component="main" sx={{ flex: 1, pt: { xs: 4, md: 6 }, pb: 8 }}>
        <Container maxWidth="md">
          <Typography variant="h3" sx={{ fontWeight: 800, mb: 1 }}>
            Terms of Service
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 6 }}>
            Last updated: January 15, 2026
          </Typography>

          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, lineHeight: 1.8 }}>
            Welcome to UbuntuFund. These Terms of Service govern your use of our crowdfunding
            platform. Please read them carefully before using our services.
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
              If you have questions about these Terms of Service, please contact us at{' '}
              <strong>legal@ubuntufund.com</strong>.
            </Typography>
          </Box>
        </Container>
    </Box>
  )
}

export default TermsPage

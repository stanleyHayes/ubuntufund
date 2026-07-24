import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import { SHAPE } from '@ubuntu-fund/ui'

const sections = [
  {
    title: '1. Information We Collect',
    content: `We collect information you provide directly, including: name, email address, phone number, and payment information when you create an account; campaign details, descriptions, and media when you create a campaign; donation amounts and payment details when you make a contribution; communications you send to us or other users through the Platform. We also automatically collect: device information (browser type, operating system, device identifiers); usage data (pages visited, features used, time spent); IP address and approximate location; cookies and similar tracking technologies.`,
  },
  {
    title: '2. How We Use Your Information',
    content: `We use your information to: operate, maintain, and improve the Platform; process donations and payouts; verify identities and prevent fraud through our trust system; communicate with you about your account, campaigns, and donations; send marketing communications (with your consent); comply with legal obligations and enforce our terms; generate anonymized analytics to improve our services; personalize your experience on the Platform.`,
  },
  {
    title: '3. Information Sharing',
    content: `We share your information with: payment processors to facilitate transactions; identity verification partners for our trust system; campaign organizers (limited donor information as needed); law enforcement when required by law or to protect rights and safety. We do not sell your personal information to third parties. We may share anonymized, aggregated data with partners for research and analytics purposes.`,
  },
  {
    title: '4. Cookies and Tracking',
    content: `We use cookies and similar technologies for: essential platform functionality (session management, security); remembering your preferences and settings; analytics and performance monitoring; marketing and advertising (with consent). You can manage cookie preferences through your browser settings. Note that disabling certain cookies may affect Platform functionality. We use both first-party and third-party cookies.`,
  },
  {
    title: '5. Data Security',
    content: `We implement industry-standard security measures to protect your data, including: encryption of data in transit (TLS/SSL) and at rest; regular security audits and penetration testing; access controls and authentication requirements; secure payment processing through PCI-compliant partners. While we strive to protect your information, no method of electronic transmission or storage is 100% secure, and we cannot guarantee absolute security.`,
  },
  {
    title: '6. Data Retention',
    content: `We retain your personal information for as long as your account is active or as needed to provide services. After account deletion, we may retain certain information for up to 5 years for legal compliance, fraud prevention, and dispute resolution. Transaction records are retained as required by applicable financial regulations. You may request deletion of your data at any time, subject to legal requirements.`,
  },
  {
    title: '7. Your Rights',
    content: `Depending on your jurisdiction, you may have the right to: access the personal information we hold about you; correct inaccurate or incomplete information; delete your personal information; restrict or object to processing of your data; data portability (receive your data in a structured format); withdraw consent for marketing communications; lodge a complaint with a supervisory authority. To exercise any of these rights, please contact us at privacy@ubuntufund.com.`,
  },
  {
    title: '8. International Data Transfers',
    content: `UbuntuFund operates in Ghana but may transfer data internationally for processing and storage. When we transfer data outside Ghana, we ensure appropriate safeguards are in place, including standard contractual clauses and adequacy decisions where applicable. By using the Platform, you consent to the transfer of your information as described in this policy.`,
  },
  {
    title: '9. Children\'s Privacy',
    content: `UbuntuFund is not intended for children under 18 years of age. We do not knowingly collect personal information from children. If we become aware that we have collected information from a child, we will take steps to delete that information promptly. Parents or guardians who believe their child has provided us with personal information should contact us immediately.`,
  },
  {
    title: '10. Changes to This Policy',
    content: `We may update this Privacy Policy from time to time. We will notify you of material changes by posting the updated policy on the Platform and updating the "Last updated" date. We may also notify you via email for significant changes. Your continued use of the Platform after changes become effective constitutes acceptance of the updated policy.`,
  },
  {
    title: '11. Contact Us',
    content: `If you have questions or concerns about this Privacy Policy or our data practices, please contact our Data Protection Officer at: privacy@ubuntufund.com, or write to us at: UbuntuFund, 14 Independence Avenue, Accra, Ghana. We aim to respond to all privacy-related inquiries within 30 days.`,
  },
]

function PrivacyPage() {
  return (
    <Box component="main" sx={{ flex: 1, pt: { xs: 4, md: 6 }, pb: 8 }}>
        <Container maxWidth="md">
          <Typography variant="h3" sx={{ fontWeight: 800, mb: 1 }}>
            Privacy Policy
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 6 }}>
            Last updated: January 15, 2026
          </Typography>

          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, lineHeight: 1.8 }}>
            At UbuntuFund, we are committed to protecting your privacy and ensuring the security
            of your personal information. This Privacy Policy explains how we collect, use, share,
            and protect your data when you use our platform.
          </Typography>

          {sections.map((section) => (
            <Box key={section.title} sx={{ mb: 4 }}>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 1.5 }}>
                {section.title}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8, whiteSpace: 'pre-line' }}>
                {section.content}
              </Typography>
            </Box>
          ))}

          <Box sx={{ mt: 6, p: 3, backgroundColor: 'grey.50', borderRadius: SHAPE.card }}>
            <Typography variant="body2" color="text.secondary">
              For privacy-related inquiries, contact our Data Protection Officer at{' '}
              <strong>privacy@ubuntufund.com</strong>.
            </Typography>
          </Box>
        </Container>
    </Box>
  )
}

export default PrivacyPage

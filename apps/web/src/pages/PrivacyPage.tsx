import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'

export function PrivacyPage() {
  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Typography variant="h3" sx={{ fontWeight: 900, mb: 4 }}>
        Privacy Policy
      </Typography>

      <Box sx={{ '& h5': { fontWeight: 700, mt: 4, mb: 1.5 }, '& p': { color: 'text.secondary', mb: 2, lineHeight: 1.8 } }}>
        <Typography variant="h5">1. Information We Collect</Typography>
        <Typography>
          We collect information you provide directly: name, email address, phone number, payment details, identity documents (for verification), and campaign content. We also collect usage data, device information, and location data automatically.
        </Typography>

        <Typography variant="h5">2. How We Use Your Information</Typography>
        <Typography>
          We use your information to provide and improve our services, process transactions, verify identities, prevent fraud, communicate with you, and comply with legal obligations.
        </Typography>

        <Typography variant="h5">3. Information Sharing</Typography>
        <Typography>
          We share information with payment processors to complete transactions, identity verification providers, and law enforcement when required. We do not sell your personal information to third parties.
        </Typography>

        <Typography variant="h5">4. Data Security</Typography>
        <Typography>
          We implement industry-standard security measures including encryption, secure data storage, and access controls. However, no method of transmission over the Internet is 100% secure.
        </Typography>

        <Typography variant="h5">5. Cookies</Typography>
        <Typography>
          We use cookies and similar technologies to enhance your experience, analyze usage patterns, and personalize content. You can manage cookie preferences in your browser settings.
        </Typography>

        <Typography variant="h5">6. Your Rights</Typography>
        <Typography>
          You have the right to access, correct, or delete your personal data. You may also request data portability or object to certain processing activities. Contact us at privacy@ubuntufund.com to exercise these rights.
        </Typography>

        <Typography variant="h5">7. Data Retention</Typography>
        <Typography>
          We retain your data for as long as your account is active or as needed to provide services. Transaction records are retained for a minimum of 7 years for compliance purposes.
        </Typography>

        <Typography variant="h5">8. International Transfers</Typography>
        <Typography>
          Your data may be transferred to and processed in countries outside your country of residence. We ensure appropriate safeguards are in place for such transfers.
        </Typography>

        <Typography variant="h5">9. Children's Privacy</Typography>
        <Typography>
          UbuntuFund is not intended for children under 18. We do not knowingly collect personal information from children.
        </Typography>

        <Typography variant="h5">10. Contact Us</Typography>
        <Typography>
          For privacy-related inquiries, contact us at privacy@ubuntufund.com or write to: UbuntuFund, Accra, Ghana.
        </Typography>

        <Typography variant="body2" sx={{ mt: 6, color: 'text.secondary' }}>
          Last updated: March 2026
        </Typography>
      </Box>
    </Container>
  )
}

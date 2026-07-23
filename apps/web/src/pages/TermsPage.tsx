import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'

export function TermsPage() {
  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Typography variant="h3" sx={{ fontWeight: 900, mb: 4 }}>
        Terms of Service
      </Typography>

      <Box sx={{ '& h5': { fontWeight: 700, mt: 4, mb: 1.5 }, '& p': { color: 'text.secondary', mb: 2, lineHeight: 1.8 } }}>
        <Typography variant="h5">1. Acceptance of Terms</Typography>
        <Typography>
          By accessing or using UbuntuFund, you agree to be bound by these Terms of Service. If you do not agree, you may not use the platform.
        </Typography>

        <Typography variant="h5">2. Eligibility</Typography>
        <Typography>
          You must be at least 18 years old and have the legal capacity to enter into a binding agreement. By using UbuntuFund, you represent that you meet these requirements.
        </Typography>

        <Typography variant="h5">3. Account Responsibilities</Typography>
        <Typography>
          You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must notify us immediately of any unauthorized use.
        </Typography>

        <Typography variant="h5">4. Campaign Rules</Typography>
        <Typography>
          Campaign creators must provide truthful and accurate information. Misrepresentation of campaign purposes, use of funds, or beneficiaries is strictly prohibited and may result in campaign removal and account suspension.
        </Typography>

        <Typography variant="h5">5. Donations</Typography>
        <Typography>
          Donations are voluntary contributions. While UbuntuFund facilitates the transfer of funds, we do not guarantee the outcome of any campaign. Donors are encouraged to review campaign details before contributing.
        </Typography>

        <Typography variant="h5">6. Fees</Typography>
        <Typography>
          UbuntuFund charges a platform fee of 1-5% on funds raised, depending on the plan. Withdrawal fees and payment processing fees may apply. All fees are disclosed before transactions are completed.
        </Typography>

        <Typography variant="h5">7. Prohibited Conduct</Typography>
        <Typography>
          Users may not use UbuntuFund for fraudulent purposes, money laundering, terrorist financing, or any illegal activity. We reserve the right to block campaigns and accounts that violate these terms.
        </Typography>

        <Typography variant="h5">8. Refunds</Typography>
        <Typography>
          Refund eligibility is subject to our Refund Policy. Donors may request refunds within the specified timeframe, subject to a processing fee deduction.
        </Typography>

        <Typography variant="h5">9. Limitation of Liability</Typography>
        <Typography>
          UbuntuFund is not liable for any indirect, incidental, or consequential damages arising from your use of the platform. Our total liability shall not exceed the fees paid to us in the preceding 12 months.
        </Typography>

        <Typography variant="h5">10. Governing Law</Typography>
        <Typography>
          These terms shall be governed by and construed in accordance with the laws of the Republic of Ghana. Any disputes shall be resolved through arbitration in Accra, Ghana.
        </Typography>

        <Typography variant="body2" sx={{ mt: 6, color: 'text.secondary' }}>
          Last updated: March 2026
        </Typography>
      </Box>
    </Container>
  )
}

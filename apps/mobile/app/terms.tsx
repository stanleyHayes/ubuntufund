import { ScrollView, StyleSheet } from 'react-native'
import { Text } from 'react-native-paper'
import { brandColors } from '@/theme'

export default function TermsScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>Legal</Text>
      <Text style={styles.title}>Terms of Service</Text>
      <Text style={styles.updated}>Last updated: March 2026</Text>

      <Text style={styles.heading}>1. Acceptance of Terms</Text>
      <Text style={styles.body}>
        By accessing or using UbuntuFund, you agree to be bound by these Terms of Service. If you do not agree, please do not use the platform.
      </Text>

      <Text style={styles.heading}>2. Use of the Platform</Text>
      <Text style={styles.body}>
        UbuntuFund is a crowdfunding platform connecting donors with verified campaigns across Ghana. You must be at least 18 years old to create an account. You agree to provide accurate information and keep your account secure.
      </Text>

      <Text style={styles.heading}>3. Campaign Guidelines</Text>
      <Text style={styles.body}>
        All campaigns must be truthful and transparent. Funds raised must be used for the stated purpose. UbuntuFund reserves the right to review, suspend, or remove campaigns that violate these guidelines.
      </Text>

      <Text style={styles.heading}>4. Fees</Text>
      <Text style={styles.body}>
        Platform fees vary by subscription tier and are deducted when funds are disbursed. All fees are clearly disclosed on our Pricing page. Payment processing fees may apply.
      </Text>

      <Text style={styles.heading}>5. Donations</Text>
      <Text style={styles.body}>
        Donations are voluntary contributions. While we verify campaigns, UbuntuFund does not guarantee specific outcomes. Refund eligibility is governed by our Refund Policy.
      </Text>

      <Text style={styles.heading}>6. Privacy</Text>
      <Text style={styles.body}>
        Your use of UbuntuFund is also governed by our Privacy Policy, which describes how we collect, use, and protect your information.
      </Text>

      <Text style={styles.heading}>7. Limitation of Liability</Text>
      <Text style={styles.body}>
        UbuntuFund is provided "as is." We are not liable for any indirect, incidental, or consequential damages arising from your use of the platform.
      </Text>

      <Text style={styles.heading}>8. Changes to Terms</Text>
      <Text style={styles.body}>
        We may update these terms from time to time. Continued use of the platform after changes constitutes acceptance of the updated terms.
      </Text>

      <Text style={styles.heading}>9. Contact</Text>
      <Text style={styles.body}>
        Questions about these terms? Contact us at legal@ubuntufund.com.
      </Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: brandColors.background },
  container: { padding: 24, paddingBottom: 48 },
  eyebrow: {
    fontSize: 11,
    fontFamily: 'TTSquares-Bold',
    fontWeight: '700',
    color: brandColors.secondaryDark,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 6,
  },
  title: { fontSize: 24, fontFamily: 'TTSquares-Black', color: brandColors.text, marginBottom: 4 },
  updated: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: brandColors.textSecondary, marginBottom: 24 },
  heading: { fontSize: 16, fontFamily: 'TTSquares-Bold', marginTop: 20, marginBottom: 8, color: brandColors.text },
  body: { fontSize: 14, fontFamily: 'Outfit_400Regular', lineHeight: 22, color: brandColors.textSecondary },
})

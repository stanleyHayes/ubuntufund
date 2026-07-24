import { ScrollView, StyleSheet } from 'react-native'
import { Text } from 'react-native-paper'
import { brandColors } from '@/theme'

export default function PrivacyScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>Privacy</Text>
      <Text style={styles.title}>Privacy Policy</Text>
      <Text style={styles.updated}>Last updated: March 2026</Text>

      <Text style={styles.heading}>1. Information We Collect</Text>
      <Text style={styles.body}>
        We collect information you provide when creating an account (name, email, country), making donations (payment method, amount), and creating campaigns. We also collect usage data to improve the platform.
      </Text>

      <Text style={styles.heading}>2. How We Use Your Information</Text>
      <Text style={styles.body}>
        Your information is used to process transactions, verify identities, prevent fraud, send notifications, and improve our services. We do not sell your personal data to third parties.
      </Text>

      <Text style={styles.heading}>3. Data Sharing</Text>
      <Text style={styles.body}>
        We share information only with payment processors to complete transactions, with campaign organizers as needed, and with law enforcement when legally required.
      </Text>

      <Text style={styles.heading}>4. Data Security</Text>
      <Text style={styles.body}>
        We use industry-standard encryption and security measures to protect your data. All financial transactions are encrypted and processed through PCI-compliant providers.
      </Text>

      <Text style={styles.heading}>5. Your Rights</Text>
      <Text style={styles.body}>
        You can access, update, or delete your personal information at any time through your profile settings. You may also request a full export of your data.
      </Text>

      <Text style={styles.heading}>6. Cookies & Tracking</Text>
      <Text style={styles.body}>
        Our mobile app uses minimal analytics to understand usage patterns. You can opt out of analytics in your device settings.
      </Text>

      <Text style={styles.heading}>7. Children's Privacy</Text>
      <Text style={styles.body}>
        UbuntuFund is not intended for children under 18. We do not knowingly collect information from minors.
      </Text>

      <Text style={styles.heading}>8. Changes to This Policy</Text>
      <Text style={styles.body}>
        We may update this policy periodically. We will notify you of significant changes via email or in-app notification.
      </Text>

      <Text style={styles.heading}>9. Contact</Text>
      <Text style={styles.body}>
        Questions about privacy? Contact us at privacy@ubuntufund.com.
      </Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: brandColors.background },
  container: { padding: 24, paddingBottom: 48 },
  eyebrow: {
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
    fontWeight: '700',
    color: brandColors.secondaryDark,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 6,
  },
  title: { fontSize: 24, fontFamily: 'Outfit_800ExtraBold', color: brandColors.text, marginBottom: 4 },
  updated: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: brandColors.textSecondary, marginBottom: 24 },
  heading: { fontSize: 16, fontFamily: 'Outfit_700Bold', marginTop: 20, marginBottom: 8, color: brandColors.text },
  body: { fontSize: 14, fontFamily: 'Outfit_400Regular', lineHeight: 22, color: brandColors.textSecondary },
})

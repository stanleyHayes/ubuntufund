import { useMemo } from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import { Text } from 'react-native-paper'
import { usePalette } from '@/context/ColorModeContext'
import type { Palette } from '@/theme'

function makeStyles(p: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: p.background },
    container: { padding: 24, paddingBottom: 48 },
    eyebrow: {
      fontSize: 11,
      fontFamily: 'Outfit_700Bold',
      fontWeight: '700',
      color: p.secondaryDark,
      textTransform: 'uppercase',
      letterSpacing: 2,
      marginBottom: 6,
    },
    title: { fontSize: 24, fontFamily: 'Outfit_800ExtraBold', color: p.text, marginBottom: 4 },
    updated: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: p.textSecondary, marginBottom: 24 },
    heading: { fontSize: 16, fontFamily: 'Outfit_700Bold', marginTop: 20, marginBottom: 8, color: p.text },
    body: { fontSize: 14, fontFamily: 'Outfit_400Regular', lineHeight: 22, color: p.textSecondary },
  })
}

function useStyles() {
  const p = usePalette()
  return useMemo(() => makeStyles(p), [p])
}

export default function TermsScreen() {
  const styles = useStyles()
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>Legal</Text>
      <Text style={styles.title}>Terms of Service</Text>
      <Text style={styles.updated}>Last updated: 7 September 2026</Text>

      <Text style={styles.heading}>1. Acceptance of Terms</Text>
      <Text style={styles.body}>
        By accessing or using Ujimora, you agree to be bound by these Terms of Service. If you do not agree, please do not use the platform.
      </Text>

      <Text style={styles.heading}>2. Use of the Platform</Text>
      <Text style={styles.body}>
        Ujimora is a crowdfunding platform connecting donors with verified campaigns across Ghana. You must be at least 18 years old to create an account. You agree to provide accurate information and keep your account secure.
      </Text>

      <Text style={styles.heading}>3. Campaign Guidelines</Text>
      <Text style={styles.body}>
        All campaigns must be truthful and transparent. Funds raised must be used for the stated purpose. Ujimora reserves the right to review, suspend, or remove campaigns that violate these guidelines.
      </Text>

      <Text style={styles.heading}>4. Fees</Text>
      <Text style={styles.body}>
        Platform fees vary by subscription tier and are deducted when funds are disbursed. All fees are clearly disclosed on our Pricing page. Payment processing fees may apply.
      </Text>

      <Text style={styles.heading}>5. Donations</Text>
      <Text style={styles.body}>
        Donations are voluntary contributions. While we verify campaigns, Ujimora does not guarantee specific outcomes. Refund eligibility is governed by our Refund Policy.
      </Text>

      <Text style={styles.heading}>6. Privacy</Text>
      <Text style={styles.body}>
        Your use of Ujimora is also governed by our Privacy Policy, which describes how we collect, use, and protect your information.
      </Text>

      <Text style={styles.heading}>7. Limitation of Liability</Text>
      <Text style={styles.body}>
        Ujimora is provided "as is." We are not liable for any indirect, incidental, or consequential damages arising from your use of the platform.
      </Text>

      <Text style={styles.heading}>8. Changes to Terms</Text>
      <Text style={styles.body}>
        We may update these terms from time to time. Continued use of the platform after changes constitutes acceptance of the updated terms.
      </Text>

      <Text style={styles.heading}>9. Contact</Text>
      <Text style={styles.body}>
        Questions about these terms? Contact us at legal@ujimora.com.
      </Text>
    </ScrollView>
  )
}

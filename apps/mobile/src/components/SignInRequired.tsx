import { View, StyleSheet } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'
import { Text, Icon, Button } from 'react-native-paper'
import { router } from 'expo-router'
import { brandColors } from '@/theme'

interface SignInRequiredProps {
  /** Completes the sentence "Sign in to view your ..." e.g. "donations". */
  what?: string
  title?: string
  message?: string
  style?: StyleProp<ViewStyle>
}

/**
 * Friendly gate shown on protected screens when there is no signed-in user —
 * an icon, a short message, and a primary button that routes to the login
 * screen. Never a broken/empty list, an error, or an endless spinner.
 */
export function SignInRequired({ what, title = 'Sign in to continue', message, style }: SignInRequiredProps) {
  const body = message ?? (what ? `Sign in to view your ${what}.` : 'Sign in to access this page.')
  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.iconTile}>
        <Icon source="lock-outline" size={28} color={brandColors.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{body}</Text>
      <Button
        mode="contained"
        buttonColor={brandColors.primary}
        textColor="#FFFFFF"
        icon="login"
        onPress={() => router.push('/(auth)/login')}
        style={styles.btn}
        contentStyle={styles.btnContent}
        labelStyle={styles.btnLabel}
      >
        Sign In
      </Button>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  iconTile: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(168,181,160,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: { fontSize: 19, fontFamily: 'Outfit_800ExtraBold', color: brandColors.text, textAlign: 'center' },
  message: {
    fontSize: 14,
    fontFamily: 'Outfit_400Regular',
    color: brandColors.textSecondary,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  btn: { marginTop: 24, borderRadius: 999, alignSelf: 'stretch' },
  btnContent: { paddingVertical: 4 },
  btnLabel: { fontSize: 15, fontFamily: 'Outfit_700Bold' },
})

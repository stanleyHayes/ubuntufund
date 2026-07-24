import { useEffect, useMemo } from 'react'
import { View, StyleSheet, Animated } from 'react-native'
import { useRouter } from 'expo-router'
import { Text, Icon, Button } from 'react-native-paper'
import { brandColors } from '@/theme'

export default function NotFoundScreen() {
  const router = useRouter()
  const fadeAnim = useMemo(() => new Animated.Value(0), [])
  const riseAnim = useMemo(() => new Animated.Value(12), [])

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(riseAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start()
  }, [fadeAnim, riseAnim])

  return (
    <View style={styles.container}>
      <Animated.View
        style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: riseAnim }] }]}
      >
        <Text style={styles.eyebrow}>Page Not Found</Text>

        <View style={styles.iconTile}>
          <Icon source="compass-off-outline" size={24} color={brandColors.primary} />
        </View>

        <Text style={styles.title}>Lost in the journey?</Text>
        <Text style={styles.body}>
          This page has wandered off. Let's guide you back home.
        </Text>

        <Button
          mode="contained"
          buttonColor={brandColors.secondary}
          textColor="#221B0E"
          style={styles.button}
          contentStyle={styles.buttonContent}
          labelStyle={styles.buttonLabel}
          onPress={() => router.replace('/')}
        >
          Go Home
        </Button>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: brandColors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  content: { alignItems: 'center' },
  eyebrow: {
    fontSize: 11,
    fontFamily: 'Outfit_700Bold',
    fontWeight: '700',
    color: brandColors.secondaryDark,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 16,
  },
  iconTile: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(168,181,160,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Outfit_700Bold',
    color: brandColors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    fontFamily: 'Outfit_400Regular',
    color: brandColors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
    marginBottom: 24,
  },
  button: { borderRadius: 999 },
  buttonContent: { paddingVertical: 4 },
  buttonLabel: { fontSize: 14, fontFamily: 'Outfit_700Bold', letterSpacing: 0.3 },
})

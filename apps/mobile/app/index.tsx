import { useEffect, useRef } from 'react'
import { Redirect } from 'expo-router'
import { View, Animated, StyleSheet, Dimensions } from 'react-native'
import { useAuth } from '@/context/AuthContext'
import { brandColors } from '@/theme'
import { UbuntuLogo } from '@/components/UbuntuLogo'

const { width } = Dimensions.get('window')

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth()

  const logoScale = useRef(new Animated.Value(0.3)).current
  const logoOpacity = useRef(new Animated.Value(0)).current
  const textOpacity = useRef(new Animated.Value(0)).current
  const textTranslate = useRef(new Animated.Value(20)).current
  const taglineOpacity = useRef(new Animated.Value(0)).current
  const dotScale = useRef(new Animated.Value(0)).current
  const pulseAnim = useRef(new Animated.Value(1)).current

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(textOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.spring(textTranslate, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
      ]),
      Animated.timing(taglineOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(dotScale, { toValue: 1, friction: 5, tension: 100, useNativeDriver: true }),
    ]).start()

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.4, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    ).start()
  }, [])

  if (!isLoading && !isAuthenticated) return <Redirect href="/(auth)/login" />
  if (!isLoading && isAuthenticated) return <Redirect href="/(tabs)" />

  return (
    <View style={styles.container}>
      {/* Decorative circles */}
      <View style={[styles.bgCircle, styles.circleTopRight]} />
      <View style={[styles.bgCircle, styles.circleBottomLeft]} />

      {/* Logo */}
      <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }] }}>
        <UbuntuLogo size={100} />
      </Animated.View>

      {/* Title */}
      <Animated.View style={{ opacity: textOpacity, transform: [{ translateY: textTranslate }], marginTop: 28 }}>
        <View style={styles.titleRow}>
          <Animated.Text style={styles.titleWhite}>Ubuntu</Animated.Text>
          <Animated.Text style={styles.titleGold}>Fund</Animated.Text>
        </View>
      </Animated.View>

      {/* Tagline */}
      <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
        Together, We Rise
      </Animated.Text>

      {/* Pulsing loading dot */}
      <Animated.View
        style={[styles.loadingDot, { transform: [{ scale: Animated.multiply(dotScale, pulseAnim) }] }]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: brandColors.primaryDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bgCircle: {
    position: 'absolute',
    borderRadius: 9999,
    backgroundColor: brandColors.primary,
    opacity: 0.06,
  },
  circleTopRight: {
    width: width * 0.8,
    height: width * 0.8,
    top: -width * 0.3,
    right: -width * 0.3,
  },
  circleBottomLeft: {
    width: width * 0.6,
    height: width * 0.6,
    bottom: -width * 0.2,
    left: -width * 0.2,
  },
  titleRow: { flexDirection: 'row', alignItems: 'baseline' },
  titleWhite: { fontSize: 34, fontFamily: 'TTSquares-Black', color: '#FFFFFF', letterSpacing: 0.5 },
  titleGold: { fontSize: 34, fontFamily: 'TTSquares-Black', color: brandColors.secondary, letterSpacing: 0.5 },
  tagline: {
    fontSize: 13,
    fontFamily: 'Outfit_400Regular',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 4,
    textTransform: 'uppercase',
    marginTop: 10,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: brandColors.secondary,
    position: 'absolute',
    bottom: 80,
  },
})

import { useEffect, useState, useMemo } from 'react'
import { Redirect } from 'expo-router'
import { View, Animated, StyleSheet, Dimensions } from 'react-native'
import { useAuth } from '@/context/AuthContext'
import { usePalette } from '@/context/ColorModeContext'
import type { Palette } from '@/theme'
import { UjimoraLogo } from '@/components/UjimoraLogo'

const { width } = Dimensions.get('window')

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth()
  const styles = useStyles()

  const [logoScale] = useState(() => new Animated.Value(0.3))
  const [logoOpacity] = useState(() => new Animated.Value(0))
  const [textOpacity] = useState(() => new Animated.Value(0))
  const [textTranslate] = useState(() => new Animated.Value(20))
  const [taglineOpacity] = useState(() => new Animated.Value(0))
  const [dotScale] = useState(() => new Animated.Value(0))
  const [pulseAnim] = useState(() => new Animated.Value(1))

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
  }, [dotScale, logoOpacity, logoScale, pulseAnim, taglineOpacity, textOpacity, textTranslate])

  if (!isLoading && !isAuthenticated) return <Redirect href="/(auth)/login" />
  if (!isLoading && isAuthenticated) return <Redirect href="/(tabs)" />

  return (
    <View style={styles.container}>
      {/* Decorative circles */}
      <View style={[styles.bgCircle, styles.circleTopRight]} />
      <View style={[styles.bgCircle, styles.circleBottomLeft]} />

      {/* Logo */}
      <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }] }}>
        <UjimoraLogo size={100} />
      </Animated.View>

      {/* Title */}
      <Animated.View style={{ opacity: textOpacity, transform: [{ translateY: textTranslate }], marginTop: 28 }}>
        <View style={styles.titleRow}>
          <Animated.Text style={styles.titleWhite}>Ujimora</Animated.Text>
        </View>
      </Animated.View>

      {/* Tagline */}
      <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
        Together, we fund what matters
      </Animated.Text>

      {/* Pulsing loading dot */}
      <Animated.View
        style={[styles.loadingDot, { transform: [{ scale: Animated.multiply(dotScale, pulseAnim) }] }]}
      />
    </View>
  )
}

function makeStyles(p: Palette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: p.primaryDark,
      justifyContent: 'center',
      alignItems: 'center',
    },
    bgCircle: {
      position: 'absolute',
      borderRadius: 9999,
      backgroundColor: p.primary,
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
    titleWhite: { fontSize: 34, fontFamily: 'Outfit_800ExtraBold', color: '#FFFFFF', letterSpacing: 0.5 },
    titleGold: { fontSize: 34, fontFamily: 'Outfit_800ExtraBold', color: p.secondary, letterSpacing: 0.5 },
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
      backgroundColor: p.secondary,
      position: 'absolute',
      bottom: 80,
    },
  })
}

function useStyles() {
  const p = usePalette()
  return useMemo(() => makeStyles(p), [p])
}

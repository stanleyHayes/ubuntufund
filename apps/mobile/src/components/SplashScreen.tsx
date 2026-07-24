import { useEffect, useMemo } from 'react'
import { View, Text, Animated, StyleSheet, Dimensions } from 'react-native'
import { UbuntuLogo } from './UbuntuLogo'

const { width } = Dimensions.get('window')

export default function AppSplashScreen({ onFinish }: { onFinish: () => void }) {
  const logoScale = useMemo(() => new Animated.Value(0.3), [])
  const logoOpacity = useMemo(() => new Animated.Value(0), [])
  const textOpacity = useMemo(() => new Animated.Value(0), [])
  const taglineOpacity = useMemo(() => new Animated.Value(0), [])
  const ringScale = useMemo(() => new Animated.Value(0.5), [])
  const ringOpacity = useMemo(() => new Animated.Value(0), [])
  const ring2Scale = useMemo(() => new Animated.Value(0.3), [])
  const ring2Opacity = useMemo(() => new Animated.Value(0), [])
  const dotOpacity = useMemo(() => new Animated.Value(0), [])
  const fadeOut = useMemo(() => new Animated.Value(1), [])

  useEffect(() => {
    Animated.sequence([
      // Ring pulse in
      Animated.parallel([
        Animated.spring(ringScale, { toValue: 1.2, friction: 4, useNativeDriver: true }),
        Animated.timing(ringOpacity, { toValue: 0.3, duration: 400, useNativeDriver: true }),
      ]),
      // Logo appears
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, friction: 5, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(ring2Opacity, { toValue: 0.15, duration: 400, useNativeDriver: true }),
        Animated.spring(ring2Scale, { toValue: 1.5, friction: 5, useNativeDriver: true }),
      ]),
      // Text fades in
      Animated.timing(textOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      // Tagline fades in
      Animated.parallel([
        Animated.timing(taglineOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(dotOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
      // Hold
      Animated.delay(800),
      // Fade everything out
      Animated.timing(fadeOut, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(() => {
      onFinish()
    })
  }, [])

  return (
    <Animated.View style={[styles.container, { opacity: fadeOut }]}>
      {/* Background gradient effect using overlapping views */}
      <View style={styles.bgTop} />
      <View style={styles.bgBottom} />

      {/* Animated rings */}
      <Animated.View
        style={[
          styles.ring,
          {
            transform: [{ scale: ringScale }],
            opacity: ringOpacity,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.ring2,
          {
            transform: [{ scale: ring2Scale }],
            opacity: ring2Opacity,
          },
        ]}
      />

      {/* Brand mark: interlocked chain links (Nkonsonkonson) */}
      <Animated.View
        style={[
          styles.logoContainer,
          {
            transform: [{ scale: logoScale }],
            opacity: logoOpacity,
          },
        ]}
      >
        <View style={styles.logoCircle}>
          <UbuntuLogo size={64} />
        </View>
      </Animated.View>

      {/* App name */}
      <Animated.View style={{ opacity: textOpacity, marginTop: 24 }}>
        <Text style={styles.appName}>
          Ubuntu<Text style={styles.appNameAccent}>Fund</Text>
        </Text>
      </Animated.View>

      {/* Tagline */}
      <Animated.View style={{ opacity: taglineOpacity, marginTop: 8 }}>
        <Text style={styles.tagline}>Together, We Rise.</Text>
      </Animated.View>

      {/* Loading dots */}
      <Animated.View style={[styles.dotsContainer, { opacity: dotOpacity }]}>
        {[0, 1, 2].map((i) => (
          <PulsingDot key={i} delay={i * 200} />
        ))}
      </Animated.View>
    </Animated.View>
  )
}

function PulsingDot({ delay }: { delay: number }) {
  const opacity = useMemo(() => new Animated.Value(0.3), [])

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 400, delay, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 400, useNativeDriver: true }),
      ]),
    )
    anim.start()
    return () => anim.stop()
  }, [])

  return (
    <Animated.View
      style={[
        styles.dot,
        { opacity },
      ]}
    />
  )
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1C261D',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  bgTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: '#2E3D2F',
  },
  bgBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: '#1C261D',
  },
  ring: {
    position: 'absolute',
    width: width * 0.7,
    height: width * 0.7,
    borderRadius: width * 0.35,
    borderWidth: 1.5,
    borderColor: 'rgba(199, 162, 74, 0.3)',
  },
  ring2: {
    position: 'absolute',
    width: width * 0.9,
    height: width * 0.9,
    borderRadius: width * 0.45,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  logoContainer: {
    zIndex: 2,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(46, 61, 47, 0.35)',
    borderWidth: 1,
    borderColor: 'rgba(199, 162, 74, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    fontSize: 32,
    color: '#FFFFFF',
    fontFamily: 'TTSquares-Black',
    letterSpacing: -0.5,
  },
  appNameAccent: {
    color: '#5E8F72',
  },
  tagline: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontFamily: 'Outfit_400Regular',
    letterSpacing: 1,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 32,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#C7A24A',
  },
})

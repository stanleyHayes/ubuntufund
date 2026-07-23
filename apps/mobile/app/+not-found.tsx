import { useEffect, useRef } from 'react'
import { View, Text, Pressable, Animated, StyleSheet, Easing, Dimensions } from 'react-native'
import { useRouter } from 'expo-router'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

function AfricanMaskSVG() {
  return (
    <View style={styles.maskContainer}>
      <View style={styles.maskFace}>
        {/* Cheek marks */}
        <View style={styles.maskCheekLeft}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.maskCheekLine} />
          ))}
        </View>
        <View style={styles.maskCheekRight}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.maskCheekLine} />
          ))}
        </View>
        {/* Eyes */}
        <View style={styles.maskEyeRow}>
          <View style={styles.maskEye}>
            <View style={styles.maskPupil} />
          </View>
          <View style={styles.maskEye}>
            <View style={styles.maskPupil} />
          </View>
        </View>
        {/* Nose */}
        <View style={styles.maskNose} />
        {/* Mouth */}
        <View style={styles.maskMouth} />
        {/* Forehead decoration */}
        <View style={styles.maskForehead}>
          <View style={[styles.maskDot, { backgroundColor: '#F9A825' }]} />
          <View style={[styles.maskDiamond, { backgroundColor: '#C75B39' }]} />
          <View style={[styles.maskDot, { backgroundColor: '#F9A825' }]} />
        </View>
        {/* Crown */}
        <View style={styles.maskCrown}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View
              key={i}
              style={[
                styles.maskCrownSpike,
                {
                  backgroundColor: ['#2E7D32', '#F9A825', '#C75B39', '#F9A825', '#2E7D32'][i],
                  height: [14, 20, 24, 20, 14][i],
                },
              ]}
            />
          ))}
        </View>
      </View>
    </View>
  )
}

/** Floating dust particle component */
function DustParticle({
  animValue,
  startX,
  color,
  size,
}: {
  animValue: Animated.Value
  startX: number
  color: string
  size: number
}) {
  const translateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -80],
  })
  const opacity = animValue.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0.6, 0.4, 0],
  })
  const scale = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.2],
  })

  return (
    <Animated.View
      style={{
        position: 'absolute',
        bottom: 60,
        left: startX,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity,
        transform: [{ translateY }, { scale }],
      }}
    />
  )
}

export default function NotFoundScreen() {
  const router = useRouter()

  // Animations
  const wobbleAnim = useRef(new Animated.Value(0)).current
  const fadeAnim = useRef(new Animated.Value(0)).current
  const pulseAnim = useRef(new Animated.Value(1)).current
  const slamAnim = useRef(new Animated.Value(0)).current
  const maskDropAnim = useRef(new Animated.Value(0)).current
  const textSlideAnim = useRef(new Animated.Value(0)).current
  const kenteAnim = useRef(new Animated.Value(0)).current
  const glowAnim = useRef(new Animated.Value(0)).current

  // Dust particles
  const dustAnims = useRef(
    Array.from({ length: 6 }, () => new Animated.Value(0))
  ).current

  useEffect(() => {
    // Mask drop-in with bounce
    Animated.spring(maskDropAnim, {
      toValue: 1,
      tension: 50,
      friction: 6,
      useNativeDriver: true,
    }).start()

    // 404 slam entrance
    Animated.sequence([
      Animated.delay(200),
      Animated.spring(slamAnim, {
        toValue: 1,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start()

    // Wobble animation for the mask
    Animated.loop(
      Animated.sequence([
        Animated.timing(wobbleAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(wobbleAnim, {
          toValue: -1,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(wobbleAnim, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start()

    // Fade in content with slide
    Animated.sequence([
      Animated.delay(400),
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(textSlideAnim, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start()

    // Pulse button with drum-beat rhythm
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 150,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.95,
          duration: 100,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1.04,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.delay(1500),
      ])
    ).start()

    // Kente border animation
    Animated.loop(
      Animated.timing(kenteAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start()

    // Glow animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start()

    // Dust particles
    dustAnims.forEach((anim, i) => {
      const startDust = () => {
        anim.setValue(0)
        Animated.timing(anim, {
          toValue: 1,
          duration: 2500 + i * 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start(() => {
          setTimeout(startDust, i * 500)
        })
      }
      setTimeout(startDust, i * 400)
    })
  }, [wobbleAnim, fadeAnim, pulseAnim, slamAnim, maskDropAnim, textSlideAnim, kenteAnim, glowAnim, dustAnims])

  const wobbleRotation = wobbleAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-10deg', '0deg', '10deg'],
  })

  const maskDrop = maskDropAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-100, 0],
  })

  const maskScale = maskDropAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 1.1, 1],
  })

  const slamScale = slamAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [3, 1],
  })

  const slamRotate = slamAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['-15deg', '3deg', '0deg'],
  })

  const slamOpacity = slamAnim.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: [0, 1, 1],
  })

  const textSlide = textSlideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [30, 0],
  })

  const kenteTranslate = kenteAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SCREEN_WIDTH * 0.2],
  })

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  })

  return (
    <View style={styles.container}>
      {/* Animated Kente-inspired top border */}
      <Animated.View
        style={[styles.kenteBorder, { transform: [{ translateX: kenteTranslate }] }]}
      >
        {Array.from({ length: 30 }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.kenteStripe,
              { backgroundColor: ['#2E7D32', '#F9A825', '#C75B39', '#5D4037'][i % 4] },
            ]}
          />
        ))}
      </Animated.View>

      {/* Background glow */}
      <Animated.View
        style={[
          styles.backgroundGlow,
          { opacity: glowOpacity },
        ]}
      />

      {/* Dust particles */}
      {dustAnims.map((anim, i) => (
        <DustParticle
          key={i}
          animValue={anim}
          startX={SCREEN_WIDTH * (0.15 + i * 0.13)}
          color={['#2E7D32', '#F9A825', '#C75B39', '#5D4037', '#F9A825', '#2E7D32'][i]}
          size={4 + (i % 3)}
        />
      ))}

      {/* Wobbling mask with drop-in */}
      <Animated.View
        style={{
          transform: [
            { translateY: maskDrop },
            { scale: maskScale },
            { rotate: wobbleRotation },
          ],
          marginBottom: 24,
        }}
      >
        <AfricanMaskSVG />
      </Animated.View>

      {/* 404 with slam animation */}
      <Animated.View
        style={{
          transform: [{ scale: slamScale }, { rotate: slamRotate }],
          opacity: slamOpacity,
        }}
      >
        <Text style={styles.errorCode}>404</Text>
      </Animated.View>

      {/* Text content with slide-up */}
      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [{ translateY: textSlide }],
          alignItems: 'center',
        }}
      >
        <Text style={styles.title}>Lost in the journey?</Text>
        <Text style={styles.subtitle}>
          This page has wandered beyond the village. Let us guide you back home.
        </Text>
      </Animated.View>

      {/* Button with drum-beat pulse */}
      <Animated.View style={{ transform: [{ scale: pulseAnim }], marginTop: 32 }}>
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={() => router.replace('/')}
        >
          <Text style={styles.buttonText}>Go Home</Text>
        </Pressable>
      </Animated.View>

      {/* Decorative zigzag */}
      <View style={styles.zigzagRow}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <View
            key={i}
            style={[
              styles.zigzagTriangle,
              {
                borderBottomColor: ['#2E7D32', '#F9A825', '#C75B39', '#5D4037'][i % 4],
                transform: [{ rotate: i % 2 === 0 ? '0deg' : '180deg' }],
              },
            ]}
          />
        ))}
      </View>

      {/* Decorative dots at bottom */}
      <View style={styles.dotsRow}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: ['#2E7D32', '#F9A825', '#C75B39', '#5D4037', '#2E7D32'][i],
                opacity: 0.4,
              },
            ]}
          />
        ))}
      </View>

      {/* Animated Kente-inspired bottom border */}
      <Animated.View
        style={[
          styles.kenteBorder,
          { position: 'absolute', bottom: 0, transform: [{ translateX: Animated.multiply(kenteTranslate, -1) }] },
        ]}
      >
        {Array.from({ length: 30 }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.kenteStripe,
              { backgroundColor: ['#2E7D32', '#F9A825', '#C75B39', '#5D4037'][i % 4] },
            ]}
          />
        ))}
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF8E1',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    overflow: 'hidden',
  },
  backgroundGlow: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: '#F9A825',
    top: '30%',
  },
  kenteBorder: {
    position: 'absolute',
    top: 0,
    left: -SCREEN_WIDTH * 0.2,
    right: -SCREEN_WIDTH * 0.2,
    height: 6,
    flexDirection: 'row',
  },
  kenteStripe: {
    width: SCREEN_WIDTH * 0.07,
    height: 6,
  },
  maskContainer: {
    alignItems: 'center',
  },
  maskFace: {
    width: 80,
    height: 110,
    borderRadius: 40,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    borderWidth: 3,
    borderColor: '#5D4037',
    backgroundColor: '#FFF3E0',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#5D4037',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  maskCheekLeft: {
    position: 'absolute',
    left: 4,
    top: '50%',
    gap: 3,
  },
  maskCheekRight: {
    position: 'absolute',
    right: 4,
    top: '50%',
    gap: 3,
  },
  maskCheekLine: {
    width: 8,
    height: 1.5,
    backgroundColor: '#C75B39',
    borderRadius: 1,
  },
  maskEyeRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: -8,
  },
  maskEye: {
    width: 18,
    height: 10,
    borderRadius: 9,
    borderWidth: 2.5,
    borderColor: '#5D4037',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  maskPupil: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#5D4037',
  },
  maskNose: {
    width: 8,
    height: 16,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#5D4037',
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    marginTop: 6,
  },
  maskMouth: {
    width: 24,
    height: 8,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderWidth: 2,
    borderTopWidth: 0,
    borderColor: '#C75B39',
    marginTop: 6,
  },
  maskForehead: {
    position: 'absolute',
    top: 8,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  maskDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  maskDiamond: {
    width: 8,
    height: 8,
    borderRadius: 1,
    transform: [{ rotate: '45deg' }],
  },
  maskCrown: {
    position: 'absolute',
    top: -22,
    flexDirection: 'row',
    gap: 2,
    alignItems: 'flex-end',
  },
  maskCrownSpike: {
    width: 6,
    borderRadius: 3,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  errorCode: {
    fontSize: 80,
    color: '#5D4037',
    marginBottom: 8,
    fontFamily: 'TTSquares-Black',
    letterSpacing: -2,
    textShadowColor: 'rgba(93,64,55,0.2)',
    textShadowOffset: { width: 2, height: 4 },
    textShadowRadius: 10,
  },
  title: {
    fontSize: 22,
    fontFamily: 'TTSquares-Bold',
    color: '#5D4037',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'TTSquares-Regular',
    color: '#8D6E63',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  button: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#2E7D32',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonPressed: {
    backgroundColor: '#1B5E20',
    transform: [{ scale: 0.95 }],
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'TTSquares-Bold',
    letterSpacing: 0.5,
  },
  zigzagRow: {
    flexDirection: 'row',
    gap: 2,
    position: 'absolute',
    bottom: 55,
  },
  zigzagTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    position: 'absolute',
    bottom: 30,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
})

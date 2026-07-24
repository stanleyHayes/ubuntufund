import { useEffect, useRef } from 'react'
import { Animated, AccessibilityInfo } from 'react-native'
import type { ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'

interface FadeInUpProps {
  children: ReactNode
  /** Position in a list — used to stagger the entrance by `index * 60ms`. */
  index?: number
  /** Explicit delay (ms). Overrides the index-based stagger when provided. */
  delay?: number
  /** Travel distance in px for the upward slide. */
  distance?: number
  /** Fade duration in ms. */
  duration?: number
  style?: StyleProp<ViewStyle>
}

/**
 * Tasteful one-shot entrance: opacity 0 -> 1 while sliding up `distance`px.
 * Runs on the native driver, staggers by list index, and collapses to an
 * instant reveal when the OS "reduce motion" setting is on.
 */
export function FadeInUp({
  children,
  index = 0,
  delay,
  distance = 16,
  duration = 300,
  style,
}: FadeInUpProps) {
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(distance)).current

  useEffect(() => {
    let cancelled = false
    const startDelay = delay ?? index * 60

    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (cancelled) return
        if (reduced) {
          opacity.setValue(1)
          translateY.setValue(0)
          return
        }
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration,
            delay: startDelay,
            useNativeDriver: true,
          }),
          Animated.spring(translateY, {
            toValue: 0,
            friction: 8,
            tension: 50,
            delay: startDelay,
            useNativeDriver: true,
          }),
        ]).start()
      })
      .catch(() => {
        if (cancelled) return
        opacity.setValue(1)
        translateY.setValue(0)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  )
}

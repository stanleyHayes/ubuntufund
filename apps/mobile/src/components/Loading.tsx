import { useEffect, useState, type ComponentProps } from 'react'
import { Animated, View, AccessibilityInfo, type ActivityIndicatorProps } from 'react-native'
import { Button as PaperButton } from 'react-native-paper'
import { BUTTON_RADIUS } from './RoundedControls'
import { useColorMode, usePalette } from '@/context/ColorModeContext'

function Pulse({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const [opacity] = useState(() => new Animated.Value(0.5))
  useEffect(() => {
    let stopped = false
    let animation: Animated.CompositeAnimation | undefined
    const start = (reduced: boolean) => {
      animation?.stop()
      if (reduced || stopped) { opacity.setValue(1); return }
      animation = Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, { toValue: 1, duration: 550, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 550, useNativeDriver: true }),
      ]))
      animation.start()
    }
    void AccessibilityInfo.isReduceMotionEnabled().then(start)
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', start)
    return () => { stopped = true; animation?.stop(); subscription.remove() }
  }, [opacity, delay])
  return <Animated.View style={{ opacity }}>{children}</Animated.View>
}

export function LoadingDots({ color }: { color?: string }) {
  const p = usePalette()
  return <View accessible accessibilityLabel="Loading" style={{ flexDirection: 'row', gap: 4, padding: 4 }}>
    {[0, 1, 2].map(i => <Pulse key={i} delay={i * 100}><View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: color ?? p.primary }} /></Pulse>)}
  </View>
}

/** Paper-compatible button with the same animated-dot loading treatment as web. */
export function Button({ loading, icon, style, contentStyle, onPressIn, onPressOut, ...props }: ComponentProps<typeof PaperButton>) {
  const { palette: p, neu } = useColorMode()
  const [pressed, setPressed] = useState(false)
  const filled = props.mode === 'contained' || props.mode === 'contained-tonal' || props.mode === 'elevated'
  const textOnly = !props.mode || props.mode === 'text'
  const radius = BUTTON_RADIUS
  const backgroundColor = props.disabled ? p.skeleton : props.buttonColor ?? (filled ? p.primary : textOnly ? 'transparent' : p.surface)
  const recipe = pressed || props.disabled ? neu.inset : filled && backgroundColor === p.primary ? neu.greenSubtle : neu.subtle
  const textColor = props.textColor ?? (filled ? p.onPrimary : p.primary)
  return <Animated.View style={[style, textOnly ? undefined : recipe, { backgroundColor, borderRadius: radius, overflow: 'visible' }, textOnly ? undefined : { borderWidth: 1, borderColor: props.mode === 'outlined' ? p.border : 'transparent' }]}>
    <PaperButton {...props}
      style={{ borderRadius: radius, borderWidth: 0, backgroundColor: 'transparent', elevation: 0, boxShadow: 'none', shadowOpacity: 0 }}
      contentStyle={[{ minHeight: 44 }, contentStyle]}
      labelStyle={[{ fontFamily: 'Outfit_700Bold' }, props.labelStyle]}
      buttonColor="transparent" textColor={textColor}
      onPressIn={event => { setPressed(true); onPressIn?.(event) }}
      onPressOut={event => { setPressed(false); onPressOut?.(event) }}
      accessibilityState={{ ...props.accessibilityState, busy: !!loading }}
      icon={loading ? ({ color }) => <LoadingDots color={color} /> : icon} />
  </Animated.View>
}

export function Skeleton({ height = 24, width = '100%' }: { height?: number; width?: number | `${number}%` }) {
  const p = usePalette()
  return <Pulse><View style={{ height, width, borderRadius: 12, backgroundColor: p.skeleton }} /></Pulse>
}

export function PageSkeleton() {
  return <View accessibilityLabel="Loading page" accessibilityState={{ busy: true }} style={{ padding: 24, gap: 20 }}>
    <Skeleton width="65%" height={32} /><Skeleton height={180} /><Skeleton height={64} /><Skeleton height={64} /><Skeleton height={120} />
  </View>
}

/** Skeleton replacement for legacy loaders, preserving their layout props. */
export function SkeletonLoader({ size, style }: ActivityIndicatorProps) {
  return <View accessibilityLabel="Loading content" accessibilityState={{ busy: true }} style={[{ width: '100%', minWidth: 80 }, style]}>{size === 'large' ? <PageSkeleton /> : <Skeleton height={32} />}</View>
}

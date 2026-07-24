import { useState } from 'react'
import { Animated, Pressable } from 'react-native'
import type { ReactNode } from 'react'
import type {
  GestureResponderEvent,
  PressableProps,
  StyleProp,
  ViewStyle,
} from 'react-native'

interface PressableScaleProps extends Omit<PressableProps, 'style' | 'children'> {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  /** Scale to shrink to on press-in (default 0.97). */
  scaleTo?: number
}

/**
 * Wraps a Pressable and gently scales its contents down on press-in
 * (1 -> scaleTo) then back on release. Native-driven, no layout impact.
 */
export function PressableScale({
  children,
  style,
  scaleTo = 0.97,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const [scale] = useState(() => new Animated.Value(1))

  const animateTo = (toValue: number) =>
    Animated.spring(scale, {
      toValue,
      friction: 8,
      tension: 120,
      useNativeDriver: true,
    }).start()

  const handlePressIn = (e: GestureResponderEvent) => {
    animateTo(scaleTo)
    onPressIn?.(e)
  }

  const handlePressOut = (e: GestureResponderEvent) => {
    animateTo(1)
    onPressOut?.(e)
  }

  return (
    <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} {...rest}>
      <Animated.View style={[{ transform: [{ scale }] }, style]}>
        {children}
      </Animated.View>
    </Pressable>
  )
}

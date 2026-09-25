import { useRef, useState, type ReactNode } from 'react'
import { KeyboardAvoidingView, Platform, View, type StyleProp, type ViewStyle } from 'react-native'

type Behavior = 'padding' | 'height' | 'position'

/**
 * Android always pads: with edge-to-edge (on by default in SDK 55) the
 * window no longer shrinks for the keyboard (adjustResize), and ScrollView's
 * automaticallyAdjustKeyboardInsets is iOS-only. iOS keeps each screen's
 * existing behaviour.
 */
export function keyboardBehavior(os: string, iosBehavior?: Behavior): Behavior | undefined {
  return os === 'android' ? 'padding' : os === 'ios' ? iosBehavior : undefined
}

/**
 * Keeps focused fields above the keyboard. On Android the avoiding view is
 * offset by its own position in the window (the header and status bar),
 * because KeyboardAvoidingView compares its parent-relative frame with the
 * keyboard's window position and would otherwise pad too little under a
 * stack header.
 */
export function KeyboardAvoider({ children, style, iosBehavior }: { children: ReactNode; style?: StyleProp<ViewStyle>; iosBehavior?: Behavior }) {
  const frame = useRef<View>(null)
  const [offset, setOffset] = useState(0)
  const android = Platform.OS === 'android'
  return <View ref={frame} collapsable={false} style={[{ flex: 1 }, style]}
    onLayout={android ? () => frame.current?.measureInWindow((_x, y) => setOffset(Number.isFinite(y) ? Math.max(0, y) : 0)) : undefined}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={keyboardBehavior(Platform.OS, iosBehavior)} keyboardVerticalOffset={android ? offset : 0}>
      {children}
    </KeyboardAvoidingView>
  </View>
}

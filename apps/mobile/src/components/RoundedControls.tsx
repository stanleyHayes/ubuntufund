import type { ComponentProps } from 'react'
import { Pressable as NativePressable, TouchableOpacity as NativeTouchableOpacity } from 'react-native'
import { SegmentedButtons as PaperSegmentedButtons, IconButton as PaperIconButton, TouchableRipple as PaperTouchableRipple } from 'react-native-paper'

export const BUTTON_RADIUS = 18
const rounded = { borderRadius: BUTTON_RADIUS }

export function TouchableOpacity({ style, ...props }: ComponentProps<typeof NativeTouchableOpacity>) {
  return <NativeTouchableOpacity {...props} style={[style, rounded]} />
}
export function Pressable({ style, ...props }: ComponentProps<typeof NativePressable>) {
  return <NativePressable {...props} style={state => [typeof style === 'function' ? style(state) : style, rounded]} />
}
export function TouchableRipple({ style, ...props }: ComponentProps<typeof PaperTouchableRipple>) {
  return <PaperTouchableRipple {...props} style={[style, rounded]} />
}
export function IconButton({ style, ...props }: ComponentProps<typeof PaperIconButton>) {
  return <PaperIconButton {...props} style={[style, rounded]} />
}

export function SegmentedButtons({ buttons, ...props }: ComponentProps<typeof PaperSegmentedButtons>) {
  return <PaperSegmentedButtons {...props} buttons={buttons.map(button => ({ ...button, style: [button.style, rounded] }))} />
}

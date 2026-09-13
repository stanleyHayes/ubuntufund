import { useRef } from 'react'
import { View, TextInput } from 'react-native'
import { Text } from 'react-native-paper'
import { usePalette } from '@/context/ColorModeContext'
export function OtpInput({ value, onChange, disabled = false }: { value: string; onChange: (code: string) => void; disabled?: boolean }) {
  const inputs = useRef<(TextInput | null)[]>([]), p = usePalette()
  return <View style={{ gap: 8 }}><Text>Authenticator code</Text><View style={{ flexDirection: 'row', gap: 8 }}>
    {Array.from({ length: 6 }, (_, index) => <TextInput key={index} ref={input => { inputs.current[index] = input }} accessibilityLabel={`Digit ${index + 1}`} value={value[index] ?? ''} keyboardType="number-pad" autoComplete={index === 0 ? 'one-time-code' : 'off'} editable={!disabled}
      onChangeText={text => { const digits = text.replace(/\D/g, ''); onChange(digits ? (value.slice(0, index) + digits + value.slice(index + digits.length)).slice(0, 6) : value.slice(0, index)); if (digits) inputs.current[Math.min(index + digits.length, 5)]?.focus() }}
      onKeyPress={({ nativeEvent }) => { if (nativeEvent.key === 'Backspace' && !value[index] && index > 0) { onChange(value.slice(0, index - 1)); inputs.current[index - 1]?.focus() } }}
      style={{ flex: 1, minWidth: 0, height: 48, borderWidth: 1, borderColor: p.border, borderRadius: 10, color: p.text, textAlign: 'center', fontSize: 22 }} />)}
  </View></View>
}

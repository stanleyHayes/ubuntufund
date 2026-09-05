import { useState, type ComponentProps } from 'react'
import { TextInput as PaperTextInput, useTheme } from 'react-native-paper'

export function fieldIcon(hint: string, numeric = false): string {
  const value = hint.toLowerCase()
  if (/password|secret/.test(value)) return 'lock-outline'
  if (/email/.test(value)) return 'email-outline'
  if (/search/.test(value)) return 'magnify'
  if (/url|website|link/.test(value)) return 'link-variant'
  if (/phone|telephone/.test(value)) return 'phone-outline'
  if (/amount|price|goal|fee|balance|budget|cost|commission/.test(value) || numeric) return 'cash-multiple'
  if (/country|city|address|street|location|nationality/.test(value)) return 'map-marker-outline'
  if (/organization|company|business/.test(value)) return 'domain'
  if (/name|beneficiary|recipient/.test(value)) return 'account-outline'
  if (/code|number|reference/.test(value)) return 'identifier'
  return 'text-box-outline'
}

function Input(props: Omit<ComponentProps<typeof PaperTextInput>, 'ref'>) {
  const theme = useTheme()
  const [visible, setVisible] = useState(false)
  const icon = fieldIcon(`${typeof props.label === 'string' ? props.label : ''} ${props.placeholder ?? ''} ${props.secureTextEntry ? 'password' : ''}`, props.keyboardType === 'numeric' || props.keyboardType === 'decimal-pad')
  const label = typeof props.label === 'string' ? props.label.toLowerCase() : ''
  const placeholder = props.placeholder || (props.keyboardType === 'email-address' || /email/.test(label) ? 'you@example.com'
    : props.keyboardType === 'url' || /url|website/.test(label) ? 'https://example.com'
    : props.keyboardType === 'numeric' || props.keyboardType === 'decimal-pad' ? '0'
    : label ? `Enter ${label}` : props.secureTextEntry ? 'Enter your password' : 'Enter details')
  return <PaperTextInput {...props} placeholder={placeholder}
    secureTextEntry={props.secureTextEntry && !visible}
    left={props.left !== undefined ? props.left : <PaperTextInput.Icon icon={icon} color={theme.colors.onSurfaceVariant} accessible={false} />}
    right={props.right !== undefined ? props.right : props.secureTextEntry ? <PaperTextInput.Icon
      icon={visible ? 'eye-off-outline' : 'eye-outline'} onPress={() => setVisible((value) => !value)}
      forceTextInputFocus={false} accessibilityLabel={visible ? 'Hide password' : 'Show password'} disabled={props.disabled}
    /> : undefined} />
}

export const BrandedTextInput = Object.assign(Input, { Icon: PaperTextInput.Icon, Affix: PaperTextInput.Affix })

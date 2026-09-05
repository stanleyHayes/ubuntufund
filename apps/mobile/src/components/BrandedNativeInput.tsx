import { forwardRef } from 'react'
import { View, TextInput, StyleSheet, type TextInputProps } from 'react-native'
import { Icon, useTheme } from 'react-native-paper'
import { fieldIcon } from './BrandedTextInput'

/** Preserve native form behavior and layout while reserving space for a decorative icon. */
export const BrandedNativeInput = forwardRef<TextInput, TextInputProps>(function BrandedNativeInput({ style, ...props }, ref) {
  const theme = useTheme()
  const { margin, marginTop, marginBottom, marginLeft, marginRight, marginHorizontal, marginVertical, flex, flexGrow, flexShrink, alignSelf, width, ...inputStyle } = StyleSheet.flatten(style) ?? {}
  const icon = fieldIcon(`${props.accessibilityLabel ?? ''} ${props.placeholder ?? ''}`, props.keyboardType === 'numeric' || props.keyboardType === 'decimal-pad')
  return <View style={{ margin, marginTop, marginBottom, marginLeft, marginRight, marginHorizontal, marginVertical, flex, flexGrow, flexShrink, alignSelf, width }}>
    <TextInput {...props} placeholder={props.placeholder || (props.keyboardType === 'numeric' || props.keyboardType === 'decimal-pad' ? '0' : props.accessibilityLabel ? `Enter ${props.accessibilityLabel.toLowerCase()}` : 'Enter details')} ref={ref} style={[inputStyle, { paddingLeft: 44 }]} />
    <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', left: 14, top: props.multiline ? 16 : '50%', marginTop: props.multiline ? 0 : -10 }}>
      <Icon source={icon} size={20} color={theme.colors.onSurfaceVariant} />
    </View>
  </View>
})

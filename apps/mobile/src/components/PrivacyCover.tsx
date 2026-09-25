import { View } from 'react-native'
import { usePalette } from '@/context/ColorModeContext'
import { UjimoraLogo } from './UjimoraLogo'

/**
 * Plain branded screen shown while the app is inactive or in the background,
 * so the app switcher / Recents snapshot never shows balances, KYC details or
 * recovery codes. It shows no account content and needs no interaction.
 */
export function PrivacyCover() {
  const p = usePalette()
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.background }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <UjimoraLogo size={56} />
  </View>
}

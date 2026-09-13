import { View } from 'react-native'
import { Checkbox, Text } from 'react-native-paper'
export function PublicationConsent({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  return <View style={{ gap: 4 }}>
    <Checkbox.Item status={value ? 'checked' : 'unchecked'} onPress={() => onChange(!value)} label="Use OpenAI to check this public text for safety (optional)" />
    <Text variant="bodySmall">Only this proposed public text is shared for automated screening. Without permission, staff review it. Flagged text and attached media need staff review. Check Settings → Publication reviews for decisions.</Text>
  </View>
}

import { View, StyleSheet } from 'react-native'
import { Stack } from 'expo-router'
import { CampaignUpdatesList } from '@/components/CampaignUpdatesList'

interface CampaignUpdatesScreenProps {
  campaignId: string
  isCreator: boolean
}

export function CampaignUpdatesScreen({ campaignId, isCreator }: CampaignUpdatesScreenProps) {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Updates' }} />
      <CampaignUpdatesList campaignId={campaignId} isCreator={isCreator} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
})

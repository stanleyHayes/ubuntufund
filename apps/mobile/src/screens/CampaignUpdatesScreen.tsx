import { View, StyleSheet } from 'react-native'
import { Stack } from 'expo-router'
import { Text } from 'react-native-paper'
import { CampaignUpdatesList } from '@/components/CampaignUpdatesList'
import { brandColors } from '@/theme'

interface CampaignUpdatesScreenProps {
  campaignId: string
  isCreator: boolean
}

export function CampaignUpdatesScreen({ campaignId, isCreator }: CampaignUpdatesScreenProps) {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Updates' }} />
      <View style={styles.header}>
        <Text style={styles.eyebrow}>CAMPAIGN</Text>
        <Text variant="titleLarge" style={styles.title}>Updates</Text>
      </View>
      <CampaignUpdatesList campaignId={campaignId} isCreator={isCreator} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: brandColors.background },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: brandColors.secondaryDark,
    marginBottom: 4,
  },
  title: { fontFamily: 'Outfit_700Bold', color: brandColors.text },
})

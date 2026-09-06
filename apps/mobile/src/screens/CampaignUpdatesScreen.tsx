import { useMemo } from 'react'
import { View, StyleSheet } from 'react-native'
import { Stack } from 'expo-router'
import { Text } from 'react-native-paper'
import { CampaignUpdatesList } from '@/components/CampaignUpdatesList'
import { usePalette } from '@/context/ColorModeContext'
import type { Palette } from '@/theme'

interface CampaignUpdatesScreenProps {
  campaignId: string
  isCreator: boolean
}

function makeStyles(p: Palette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: p.background },
    header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 },
    eyebrow: {
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 2,
      color: p.secondaryDark,
      marginBottom: 4,
    },
    title: { fontFamily: 'Outfit_700Bold', color: p.text },
  })
}

function useStyles() {
  const p = usePalette()
  return useMemo(() => makeStyles(p), [p])
}

export function CampaignUpdatesScreen({ campaignId, isCreator }: CampaignUpdatesScreenProps) {
  const styles = useStyles()
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

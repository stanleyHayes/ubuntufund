import { useState } from 'react'
import { View, ScrollView, StyleSheet, Alert } from 'react-native'
import { TextInput, Button, Text, Chip } from 'react-native-paper'
import { router } from 'expo-router'
import { CampaignCategory } from '@ubuntu-fund/types'
import { brandColors } from '@/theme'
import { api } from '@/lib/api'

const CATEGORIES = [
  { value: CampaignCategory.MEDICAL, label: 'Medical' },
  { value: CampaignCategory.EDUCATION, label: 'Education' },
  { value: CampaignCategory.EMERGENCY, label: 'Emergency' },
  { value: CampaignCategory.BUSINESS, label: 'Business' },
  { value: CampaignCategory.COMMUNITY, label: 'Community' },
  { value: CampaignCategory.RELIGIOUS, label: 'Religious' },
  { value: CampaignCategory.CREATIVE, label: 'Creative' },
]

export default function CreateCampaignScreen() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [goalAmount, setGoalAmount] = useState('')
  const [category, setCategory] = useState<CampaignCategory>(CampaignCategory.COMMUNITY)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      await api.post('/campaigns', {
        title,
        description,
        goalAmount: Number(goalAmount),
        currency: 'GHS',
        category,
      })
      Alert.alert('Success', 'Campaign created successfully!', [
        { text: 'OK', onPress: () => router.back() },
      ])
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create campaign')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>NEW CAMPAIGN</Text>
        <Text variant="headlineSmall" style={styles.heading}>
          Start a Campaign
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Share your cause and rally your community.
        </Text>

        <TextInput
          label="Campaign Title"
          value={title}
          onChangeText={setTitle}
          mode="outlined"
          outlineColor="rgba(26,46,34,0.15)"
          activeOutlineColor={brandColors.primary}
          style={styles.input}
        />

        <TextInput
          label="Description"
          value={description}
          onChangeText={setDescription}
          mode="outlined"
          outlineColor="rgba(26,46,34,0.15)"
          activeOutlineColor={brandColors.primary}
          multiline
          numberOfLines={5}
          style={styles.input}
        />

        <TextInput
          label="Goal Amount"
          value={goalAmount}
          onChangeText={setGoalAmount}
          mode="outlined"
          outlineColor="rgba(26,46,34,0.15)"
          activeOutlineColor={brandColors.primary}
          keyboardType="numeric"
          right={<TextInput.Affix text="GHS" />}
          style={styles.input}
        />

        <Text variant="titleSmall" style={styles.label}>
          Category
        </Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((cat) => (
            <Chip
              key={cat.value}
              onPress={() => setCategory(cat.value)}
              style={[
                styles.categoryChip,
                category === cat.value && styles.categoryChipSelected,
              ]}
              textStyle={[
                styles.categoryChipText,
                category === cat.value && styles.categoryChipTextSelected,
              ]}
            >
              {cat.label}
            </Chip>
          ))}
        </View>

        <Button
          mode="contained"
          onPress={handleSubmit}
          style={styles.submitButton}
          labelStyle={styles.submitLabel}
          buttonColor={brandColors.secondary}
          textColor="#221B0E"
          disabled={!title || !description || !goalAmount || isSubmitting}
          loading={isSubmitting}
        >
          {isSubmitting ? 'Creating...' : 'Create Campaign'}
        </Button>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: brandColors.background },
  content: { padding: 16 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 2,
    color: brandColors.secondaryDark,
    marginBottom: 6,
  },
  heading: { fontFamily: 'TTSquares-Bold', marginBottom: 4 },
  subtitle: { color: brandColors.textSecondary, marginBottom: 24 },
  input: { marginBottom: 16, backgroundColor: brandColors.surface },
  label: { marginBottom: 8, fontFamily: 'TTSquares-Bold' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  categoryChip: { backgroundColor: 'rgba(168,181,160,0.28)' },
  categoryChipSelected: { backgroundColor: brandColors.primary },
  categoryChipText: { color: brandColors.text, fontFamily: 'Outfit_400Regular' },
  categoryChipTextSelected: { color: '#FFFFFF', fontFamily: 'TTSquares-Bold' },
  submitButton: { borderRadius: 999, paddingVertical: 4, marginTop: 8 },
  submitLabel: { fontSize: 16, fontFamily: 'TTSquares-Bold' },
})

import { useState } from 'react'
import { View, ScrollView, StyleSheet, Alert } from 'react-native'
import { TextInput, Button, Text, SegmentedButtons } from 'react-native-paper'
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
  const [currency, setCurrency] = useState('USD')
  const [category, setCategory] = useState<CampaignCategory>(CampaignCategory.COMMUNITY)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      await api.post('/campaigns', {
        title,
        description,
        goalAmount: Number(goalAmount),
        currency,
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
          style={styles.input}
        />

        <TextInput
          label="Description"
          value={description}
          onChangeText={setDescription}
          mode="outlined"
          multiline
          numberOfLines={5}
          style={styles.input}
        />

        <View style={styles.row}>
          <TextInput
            label="Goal Amount"
            value={goalAmount}
            onChangeText={setGoalAmount}
            mode="outlined"
            keyboardType="numeric"
            style={[styles.input, { flex: 2 }]}
          />
          <SegmentedButtons
            value={currency}
            onValueChange={setCurrency}
            buttons={[
              { value: 'USD', label: 'USD' },
              { value: 'KES', label: 'KES' },
              { value: 'NGN', label: 'NGN' },
            ]}
            style={[styles.input, { flex: 3 }]}
          />
        </View>

        <Text variant="titleSmall" style={styles.label}>
          Category
        </Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((cat) => (
            <Button
              key={cat.value}
              mode={category === cat.value ? 'contained' : 'outlined'}
              onPress={() => setCategory(cat.value)}
              compact
              style={styles.categoryButton}
              buttonColor={category === cat.value ? brandColors.primary : undefined}
            >
              {cat.label}
            </Button>
          ))}
        </View>

        <Button
          mode="contained"
          onPress={handleSubmit}
          style={styles.submitButton}
          labelStyle={styles.submitLabel}
          buttonColor={brandColors.primary}
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
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  content: { padding: 16 },
  heading: { fontFamily: 'TTSquares-Bold', marginBottom: 4 },
  subtitle: { color: '#757575', marginBottom: 24 },
  input: { marginBottom: 16 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  label: { marginBottom: 8, fontFamily: 'TTSquares-Bold' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  categoryButton: { borderRadius: 8 },
  submitButton: { borderRadius: 8, paddingVertical: 4, marginTop: 8 },
  submitLabel: { fontSize: 16, fontFamily: 'TTSquares-Bold' },
})

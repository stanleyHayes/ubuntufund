import { useState } from 'react'
import { View } from 'react-native'
import { Button } from 'react-native-paper'
import { DatePickerModal, enGB, registerTranslation } from 'react-native-paper-dates'
import { usePalette } from '@/context/ColorModeContext'

registerTranslation('en-GB', enGB)

export function BrandedDateField({ label, value, onChange, maxDate }: { label: string; value: string; onChange: (value: string) => void; maxDate?: Date }) {
  const p = usePalette()
  const [open, setOpen] = useState(false)
  const selected = value ? new Date(`${value}T12:00:00`) : undefined
  return <View style={{ marginBottom: 16 }}>
    <Button mode="outlined" icon="calendar-outline" onPress={() => setOpen(true)} textColor={p.primary}
      accessibilityLabel={`${label}: ${selected ? selected.toLocaleDateString('en-GB') : 'Choose a date'}`}
      contentStyle={{ minHeight: 56, justifyContent: 'flex-start' }} style={{ borderRadius: 12, borderColor: p.primary }}>
      {label} · {selected ? selected.toLocaleDateString('en-GB') : 'Choose a date'}
    </Button>
    <DatePickerModal locale="en-GB" mode="single" visible={open} date={selected} label={label}
      validRange={{ endDate: maxDate }} onDismiss={() => setOpen(false)} onConfirm={({ date }) => {
        if (date) onChange(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`)
        setOpen(false)
      }} />
  </View>
}

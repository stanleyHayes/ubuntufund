import { Button } from '@/components/Loading'
import { useMemo, useState } from 'react'
import { FlatList, View, useWindowDimensions } from 'react-native'
import { Dialog, List, Portal, Searchbar, Text } from 'react-native-paper'
import { usePalette } from '@/context/ColorModeContext'

export interface Choice { value: string; label: string }
export function SelectionField({ label, value, options, onChange, disabled }: { label: string; value: string; options: Choice[]; onChange: (value: string) => void; disabled?: boolean }) {
  const p = usePalette()
  const { height } = useWindowDimensions()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => options.filter(o => o.label.toLocaleLowerCase().includes(query.toLocaleLowerCase())), [options, query])
  const selected = options.find(o => o.value === value)?.label
  return <View>
    <Button mode="outlined" disabled={disabled} icon="chevron-down" onPress={() => { setQuery(''); setOpen(true) }} contentStyle={{ minHeight: 56, justifyContent: 'flex-start' }} style={{ borderRadius: 12 }} accessibilityLabel={`${label}: ${selected || 'Choose'}`}>
      {label}: {selected || 'Choose'}
    </Button>
    <Portal><Dialog visible={open} onDismiss={() => setOpen(false)} style={{ backgroundColor: p.surface, maxHeight: height * 0.8 }}>
      <Dialog.Title>{label}</Dialog.Title>
      <Dialog.Content><Searchbar placeholder={`Search ${label.toLowerCase()}`} value={query} onChangeText={setQuery} /></Dialog.Content>
      <Dialog.ScrollArea style={{ flexShrink: 1 }}><FlatList keyboardShouldPersistTaps="handled" data={filtered} keyExtractor={o => o.value}
        ListEmptyComponent={<Text style={{ padding: 20 }}>No matching options</Text>}
        renderItem={({ item }) => <List.Item title={item.label} accessibilityRole="radio" accessibilityState={{ checked: item.value === value }} right={props => item.value === value ? <List.Icon {...props} icon="check" color={p.primary} /> : null} onPress={() => { onChange(item.value); setOpen(false) }} />} />
      </Dialog.ScrollArea>
      <Dialog.Actions><Button onPress={() => setOpen(false)}>Cancel</Button></Dialog.Actions>
    </Dialog></Portal>
  </View>
}

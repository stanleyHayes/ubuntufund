import { IconButton } from '@/components/RoundedControls'
import { useState } from 'react'
import { View, Image } from 'react-native'
import { Text } from 'react-native-paper'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import { File } from 'expo-file-system'
import { Button } from './Loading'
import { api } from '@/lib/api'
import { usePalette, useNeu } from '@/context/ColorModeContext'

export function MediaUploadField({ label, value, onChange, folder = 'kyc', document = false, crop = false, aspect = [1, 1], onBusyChange, compact = false }: {
  label: string; value: string; onChange: (url: string) => void; folder?: string; document?: boolean; crop?: boolean; aspect?: [number, number]; onBusyChange?: (busy: boolean) => void; compact?: boolean
}) {
  const p = usePalette()
  const neu = useNeu()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function pick(source: 'camera' | 'library' | 'document') {
    setError(''); setBusy(true); onBusyChange?.(true)
    try {
      let uri: string, mime: string
      if (source === 'document') {
        const result = await DocumentPicker.getDocumentAsync({ type: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], copyToCacheDirectory: true })
        if (result.canceled) return
        uri = result.assets[0].uri; mime = result.assets[0].mimeType || 'application/pdf'
      } else {
        if (source === 'camera' && !(await ImagePicker.requestCameraPermissionsAsync()).granted) throw new Error('Camera permission is needed to take a photo. You can choose a file instead.')
        const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: crop, aspect, quality: 0.8 }
        const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options)
        if (result.canceled) return
        uri = result.assets[0].uri; mime = result.assets[0].mimeType || 'image/jpeg'
      }
      const file = new File(uri)
      if (file.size > 4 * 1024 * 1024) throw new Error('Choose a file smaller than 4 MB.')
      const result = await api.upload<{ url: string }>(`/uploads/image?folder=${encodeURIComponent(folder)}`, await file.arrayBuffer(), mime)
      onChange(result.url)
    } catch (e) { setError(e instanceof Error ? e.message : 'Upload failed. Please try again.') }
    finally { setBusy(false); onBusyChange?.(false) }
  }
  if (compact) return <View style={{ gap: 4 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
      <Text style={{ color: p.text, fontFamily: 'Outfit_700Bold', flexGrow: 1, minWidth: 88 }}>{label}</Text>
      <Button mode="text" icon="image-edit-outline" loading={busy} disabled={busy} accessibilityLabel={`Choose ${label.toLowerCase()}`} onPress={() => void pick('library')}>{value ? 'Change' : 'Add'}</Button>
      <IconButton icon="camera-outline" size={22} style={{ margin: 0 }} accessibilityLabel={`Take ${label.toLowerCase()}`} disabled={busy} onPress={() => void pick('camera')} />
      {value ? <IconButton icon="trash-can-outline" size={20} iconColor={p.textSecondary} style={{ margin: 0 }} accessibilityLabel={`Remove ${label.toLowerCase()}`} disabled={busy} onPress={() => onChange('')} /> : null}
    </View>
    {error ? <Text accessibilityRole="alert" style={{ color: p.error }}>{error}</Text> : null}
  </View>
  return <View style={{ ...neu.inset, backgroundColor: p.surface, padding: 16, borderRadius: 16, gap: 10 }}>
    <Text style={{ color: p.text, fontFamily: 'Outfit_700Bold' }}>{label}</Text>
    {value && !/\.pdf(?:\?|$)/i.test(value) ? <Image accessibilityLabel={label} source={{ uri: value }} style={{ width: '100%', height: 150, borderRadius: 12 }} resizeMode="contain" /> : null}
    {value ? <Text style={{ color: p.success }}>Uploaded</Text> : <Text style={{ color: p.textSecondary }}>Choose a clear image{document ? ' or PDF' : ''}, up to 4 MB.</Text>}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <Button mode="outlined" icon="upload" loading={busy} disabled={busy} onPress={() => void pick(document ? 'document' : 'library')}>{value ? 'Replace' : 'Choose file'}</Button>
      <Button icon="camera" disabled={busy} onPress={() => void pick('camera')}>Camera</Button>
      {value && <Button disabled={busy} onPress={() => onChange('')}>Remove</Button>}
    </View>
    {error ? <Text accessibilityRole="alert" style={{ color: p.error }}>{error}</Text> : null}
  </View>
}

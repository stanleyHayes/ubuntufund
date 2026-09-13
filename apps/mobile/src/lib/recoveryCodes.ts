import { Platform } from 'react-native'
import * as FileSystem from 'expo-file-system/legacy'
import * as Sharing from 'expo-sharing'
/** Explicit user action only; temporary plaintext is removed after the save/share sheet closes. */
export async function downloadRecoveryCodes(codes: string[]) {
  const content = `Ujimora recovery codes\nKeep these private. Each code can be used once.\n\n${codes.join('\n')}\n`
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'ujimora-recovery-codes.txt'; anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000); return
  }
  if (!FileSystem.cacheDirectory || !await Sharing.isAvailableAsync()) throw new Error('Saving files is unavailable. Copy the codes instead.')
  const path = `${FileSystem.cacheDirectory}ujimora-recovery-codes-${Date.now()}.txt`
  try {
    await FileSystem.writeAsStringAsync(path, content, { encoding: FileSystem.EncodingType.UTF8 })
    await Sharing.shareAsync(path, { mimeType: 'text/plain', UTI: 'public.plain-text', dialogTitle: 'Save your Ujimora recovery codes' })
  } finally { await FileSystem.deleteAsync(path, { idempotent: true }) }
}

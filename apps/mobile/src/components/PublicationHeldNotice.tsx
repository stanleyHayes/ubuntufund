import { useEffect } from 'react'
import { AccessibilityInfo, View, type StyleProp, type ViewStyle } from 'react-native'
import { Icon, Text } from 'react-native-paper'
import { router } from 'expo-router'
import { usePalette } from '@/context/ColorModeContext'
import { Button } from './Loading'

/**
 * Shown when the API held a public change for safety review (see
 * `isPublicationHeld`). Being held is an expected step, not a failure, so this
 * uses the app's neutral info-banner style, never the error color.
 *
 * `publishesOnApproval` (see `publishesOnApproval(err)`): the approval
 * publishes the held version by itself (`whenApproved` says how), so the
 * author is not asked to submit it again, and can still withdraw it.
 * Otherwise `retry` says how to publish it after approval.
 *
 * `reviews` says where the Publication reviews list is: on this screen
 * (`above` / `below`) or in Settings. `openSettings` adds a button to it; the
 * current screen stays in the stack, so its draft is kept.
 */
export function PublicationHeldNotice({
  retry = 'submit it again unchanged',
  whenApproved = "it's published automatically, so you don't need to submit it again",
  reviews = 'settings',
  openSettings = false,
  publishesOnApproval = false,
  otherChangesSaved = false,
  style,
}: {
  /** What to do after approval, completing "After a reviewer approves it, …". Not shown when it publishes on approval. */
  retry?: string
  /** When it publishes on approval, what the approval does, completing "Once a reviewer approves it, …". */
  whenApproved?: string
  reviews?: 'above' | 'below' | 'settings'
  openSettings?: boolean
  /** The approval publishes it without the author submitting it again. */
  publishesOnApproval?: boolean
  /** The rest of the same save went through (a held profile still saves its private settings). */
  otherChangesSaved?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const p = usePalette()
  const announcement = publishesOnApproval
    ? 'Waiting for safety review. Saved privately; it is published automatically once approved.'
    : 'Waiting for safety review. Saved privately; this version is not public yet.'
  // A live region that arrives already holding its text is not announced
  // (TalkBack), and VoiceOver ignores live regions, so announce on mount.
  // Queued so VoiceOver does not drop it while re-reading the submit button.
  useEffect(() => {
    AccessibilityInfo.announceForAccessibilityWithOptions(announcement, { queue: true })
  }, [announcement])
  const where = reviews === 'settings' ? 'Settings → Publication reviews' : `Publication reviews ${reviews}`
  const message = publishesOnApproval
    ? `Saved privately for safety review. It isn't public yet. Once a reviewer approves it, ${whenApproved}. Check ${where} for the decision; you can withdraw it there.`
    : `Saved privately for safety review. This version is not public yet. After a reviewer approves it, ${retry} to publish it. Check ${where} for the decision.`
  return <View accessibilityLiveRegion="polite" style={[{ flexDirection: 'row', gap: 10, padding: 14, borderRadius: 12, backgroundColor: `${p.primary}0F` }, style]}>
    <Icon source="clock-outline" size={20} color={p.primary} />
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={{ color: p.text, fontFamily: 'Outfit_700Bold' }}>Waiting for safety review</Text>
      <Text style={{ color: p.text, fontFamily: 'Outfit_400Regular', lineHeight: 19 }}>{otherChangesSaved ? `Your other changes are saved. ${message}` : message}</Text>
      {openSettings && <Button compact style={{ alignSelf: 'flex-start' }} onPress={() => router.push('/settings')}>Open Publication reviews</Button>}
    </View>
  </View>
}

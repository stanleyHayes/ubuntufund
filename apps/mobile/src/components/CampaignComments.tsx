import { router, useFocusEffect } from 'expo-router'
import { PublicationConsent } from './PublicationConsent'
import { PublicationHeldNotice } from './PublicationHeldNotice'
import { ReportContent } from './ReportContent'
import { BlockedUsers } from './BlockedUsers'
import { IconButton, TouchableOpacity } from '@/components/RoundedControls'
import { SkeletonLoader, Button } from '@/components/Loading'
import { BrandedNativeInput as TextInput } from '@/components/BrandedNativeInput'
import { useCallback, useRef, useMemo, useState } from 'react'
import { Alert, AppState, StyleSheet, View } from 'react-native'
import { Avatar, Text } from 'react-native-paper'
import type { CampaignComment } from '@ubuntu-fund/types'
import { api } from '@/lib/api'
import { isPublicationHeld } from '@/lib/publicationDrafts'
import { useAuth } from '@/context/AuthContext'
import { usePalette, useNeu } from '@/context/ColorModeContext'
import type { Palette, NeuRecipes } from '@/theme'

const OBJECT_ID = /^[a-f0-9]{24}$/i
/** Comment authors link to their public member profile (report/block live there too). */
function openProfile(userId: string) { router.push(`/profile/${userId}`) }

function makeStyles(p: Palette, neu: NeuRecipes) {
  return StyleSheet.create({
    wrap: { gap: 12 }, loader: { marginVertical: 24 }, composer: { ...neu.raised, gap: 10, padding: 12, borderRadius: 14 },
    input: { ...neu.inset, minHeight: 76, padding: 12, borderRadius: 10, color: p.text, textAlignVertical: 'top' },
    comment: { flexDirection: 'row', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: p.border },
    copy: { flex: 1 }, name: { fontFamily: 'Outfit_700Bold', color: p.text }, date: { marginTop: 1, fontSize: 10, color: p.textSecondary }, body: { marginTop: 6, color: p.text, lineHeight: 19 }, empty: { color: p.textSecondary, paddingVertical: 12 },
  })
}

function useStyles() {
  const p = usePalette()
  const neu = useNeu()
  return useMemo(() => makeStyles(p, neu), [p, neu])
}

export function CampaignComments(props: { campaignId: string; creatorId: string }) {
  const { user } = useAuth()
  // Recreate viewer-specific state immediately when the account or campaign changes.
  return <CampaignCommentsForViewer key={`${props.campaignId}:${user?.id ?? 'guest'}`} {...props} />
}

function CampaignCommentsForViewer({ campaignId, creatorId }: { campaignId: string; creatorId: string }) {
  const { user } = useAuth()
  const p = usePalette()
  const styles = useStyles()
  const [comments, setComments] = useState<CampaignComment[]>([])
  const [blockRevision, setBlockRevision] = useState(0)
  const [content, setContent] = useState('')
  const [automatedReviewConsent, setAutomatedReviewConsent] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // The last comment was held for safety review: a notice, not an error.
  const [held, setHeld] = useState(false)

  const requestVersion = useRef(0)
  const load = useCallback(async () => {
    const version = ++requestVersion.current
    try {
      const response = await api.get<{ items: CampaignComment[] }>(`/campaigns/${campaignId}/comments`)
      if (version !== requestVersion.current) return
      setComments(response.items ?? [])
      setLoadError(null)
    } catch (err) {
      if (version !== requestVersion.current) return
      setComments([])
      setLoadError(err instanceof Error ? err.message : 'Could not load comments')
    } finally { if (version === requestVersion.current) setLoading(false) }
  }, [campaignId])

  useFocusEffect(useCallback(() => {
    void load()
    const timer = setInterval(() => { if (AppState.currentState === 'active') void load() }, 30000)
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void load() })
    return () => { requestVersion.current++; clearInterval(timer); listener.remove() }
  }, [load]))

  async function submit() {
    if (!content.trim()) return
    setSubmitting(true)
    setHeld(false)
    try {
      const comment = await api.post<CampaignComment>(`/campaigns/${campaignId}/comments`, { content, automatedReviewConsent })
      requestVersion.current++
      setComments((current) => [comment, ...current])
      setContent('')
      setAutomatedReviewConsent(false)
    } catch (error) {
      if (isPublicationHeld(error)) setHeld(true)
      else Alert.alert('Could not post', error instanceof Error ? error.message : 'Please try again.')
    } finally { setSubmitting(false) }
  }

  async function block(authorId: string) {
    try {
      await api.put(`/safety/blocks/${authorId}`, {})
      requestVersion.current++
      setComments(current => current.filter(comment => comment.authorId !== authorId)); setBlockRevision(value => value + 1)
      Alert.alert('User blocked', 'You can unblock them in the blocked users list below.')
    } catch { Alert.alert('Could not block user', 'Please try again.') }
  }

  async function remove(id: string) {
    try {
      await api.delete(`/campaigns/${campaignId}/comments/${id}`)
      requestVersion.current++
      setComments((current) => current.filter((comment) => comment.id !== id))
    } catch (error) {
      Alert.alert('Could not delete', error instanceof Error ? error.message : 'Please try again.')
    }
  }

  if (loading) return <SkeletonLoader style={styles.loader} color={p.primary} />

  return (
    <View style={styles.wrap}>
      {user ? <View style={styles.composer}>
        <TextInput multiline maxLength={1000} value={content} onChangeText={setContent} placeholder="Share encouragement or ask a question…" placeholderTextColor={p.textSecondary} style={styles.input} />
        <PublicationConsent value={automatedReviewConsent} onChange={setAutomatedReviewConsent} />
        <Button mode="contained" loading={submitting} disabled={submitting || !content.trim()} onPress={() => void submit()}>Post comment</Button>
        {held && <PublicationHeldNotice retry="post it again unchanged" openSettings />}
      </View> : <Text style={styles.empty}>Sign in to join the conversation.</Text>}
      {loadError && <View><Text accessibilityRole="alert">{loadError}</Text><Button onPress={() => void load()}>Retry comments</Button></View>}
      {user && <BlockedUsers key={user.id} revision={blockRevision} onChange={() => void load()} />}
      {comments.length === 0 ? <Text style={styles.empty}>No comments yet.</Text> : comments.map((comment) => (
        <View key={comment.id} style={styles.comment}>
          {OBJECT_ID.test(comment.authorId) ? <TouchableOpacity accessibilityRole="link" accessibilityLabel={`View ${comment.authorName}'s profile`} onPress={() => openProfile(comment.authorId)}>
            <Avatar.Text size={36} label={comment.authorName.slice(0, 1).toUpperCase()} />
          </TouchableOpacity> : <Avatar.Text size={36} label={comment.authorName.slice(0, 1).toUpperCase()} />}
          <View style={styles.copy}>
            {OBJECT_ID.test(comment.authorId)
              ? <Text style={styles.name} accessibilityRole="link" onPress={() => openProfile(comment.authorId)}>{comment.authorName}</Text>
              : <Text style={styles.name}>{comment.authorName}</Text>}
            <Text style={styles.date}>{new Date(comment.createdAt).toLocaleDateString()}</Text>
            <Text style={styles.body}>{comment.content}</Text>
            {user && user.id !== comment.authorId && <ReportContent userId={comment.authorId} commentId={comment.id} />}
            {user && user.id !== comment.authorId && <Button onPress={() => void block(comment.authorId)}>Block {comment.authorName}</Button>}
          </View>
          {user && (user.id === comment.authorId || user.id === creatorId) ? <IconButton icon="delete-outline" size={18} accessibilityLabel="Delete comment" onPress={() => void remove(comment.id)} /> : null}
        </View>
      ))}
    </View>
  )
}

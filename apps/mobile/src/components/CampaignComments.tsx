import { IconButton } from '@/components/RoundedControls'
import { SkeletonLoader, Button } from '@/components/Loading'
import { BrandedNativeInput as TextInput } from '@/components/BrandedNativeInput'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'
import { Avatar, Text } from 'react-native-paper'
import type { CampaignComment } from '@ubuntu-fund/types'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { usePalette, useNeu } from '@/context/ColorModeContext'
import type { Palette, NeuRecipes } from '@/theme'

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

export function CampaignComments({ campaignId, creatorId }: { campaignId: string; creatorId: string }) {
  const { user } = useAuth()
  const p = usePalette()
  const styles = useStyles()
  const [comments, setComments] = useState<CampaignComment[]>([])
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const response = await api.get<{ items: CampaignComment[] }>(`/campaigns/${campaignId}/comments`)
      setComments(response.items ?? [])
    } catch (error) {
      Alert.alert('Comments unavailable', error instanceof Error ? error.message : 'Please try again.')
    } finally { setLoading(false) }
  }, [campaignId])

  useEffect(() => { void load() }, [load])

  async function submit() {
    if (!content.trim()) return
    setSubmitting(true)
    try {
      const comment = await api.post<CampaignComment>(`/campaigns/${campaignId}/comments`, { content })
      setComments((current) => [comment, ...current])
      setContent('')
    } catch (error) {
      Alert.alert('Could not post', error instanceof Error ? error.message : 'Please try again.')
    } finally { setSubmitting(false) }
  }

  async function remove(id: string) {
    try {
      await api.delete(`/campaigns/${campaignId}/comments/${id}`)
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
        <Button mode="contained" loading={submitting} disabled={submitting || !content.trim()} onPress={() => void submit()}>Post comment</Button>
      </View> : <Text style={styles.empty}>Sign in to join the conversation.</Text>}
      {comments.length === 0 ? <Text style={styles.empty}>No comments yet.</Text> : comments.map((comment) => (
        <View key={comment.id} style={styles.comment}>
          <Avatar.Text size={36} label={comment.authorName.slice(0, 1).toUpperCase()} />
          <View style={styles.copy}>
            <Text style={styles.name}>{comment.authorName}</Text>
            <Text style={styles.date}>{new Date(comment.createdAt).toLocaleDateString()}</Text>
            <Text style={styles.body}>{comment.content}</Text>
          </View>
          {user && (user.id === comment.authorId || user.id === creatorId) ? <IconButton icon="delete-outline" size={18} onPress={() => void remove(comment.id)} /> : null}
        </View>
      ))}
    </View>
  )
}

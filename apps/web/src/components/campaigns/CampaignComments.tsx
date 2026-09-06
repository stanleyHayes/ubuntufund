import { BrandedTextField as TextField } from '@ubuntu-fund/ui'
import { EmptyState } from '@ubuntu-fund/ui'
import { useCallback, useEffect, useState } from 'react'
import { Alert, Avatar, Box, Button, IconButton, Skeleton, Stack, Typography } from '@mui/material'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import type { CampaignComment } from '@ubuntu-fund/types'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { SHAPE } from '@ubuntu-fund/ui'

export function CampaignComments({ campaignId, creatorId }: { campaignId: string; creatorId: string }) {
  const { user } = useAuth()
  const [comments, setComments] = useState<CampaignComment[]>([])
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await api.get<{ items: CampaignComment[] }>(`/campaigns/${campaignId}/comments`)
      setComments(response.items ?? [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load comments')
    } finally {
      setLoading(false)
    }
  }, [campaignId])

  useEffect(() => { void load() }, [load])

  async function submit() {
    if (!content.trim()) return
    setSubmitting(true)
    try {
      const comment = await api.post<CampaignComment>(`/campaigns/${campaignId}/comments`, { content })
      setComments((current) => [comment, ...current])
      setContent('')
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post comment')
    } finally {
      setSubmitting(false)
    }
  }

  async function remove(commentId: string) {
    try {
      await api.delete(`/campaigns/${campaignId}/comments/${commentId}`)
      setComments((current) => current.filter((comment) => comment.id !== commentId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete comment')
    }
  }

  return (
    <Stack spacing={2} id="comments">
      {user ? (
        <Box sx={{ p: 2.5, bgcolor: 'background.paper', boxShadow: 'var(--neu-raised)', borderRadius: SHAPE.card }}>
          <TextField fullWidth multiline minRows={2} maxRows={6} value={content} onChange={(event) => setContent(event.target.value)} inputProps={{ maxLength: 1000 }} placeholder="Share encouragement or ask a respectful question…" />
          <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">{content.length}/1000</Typography>
            <Button variant="contained" disabled={submitting || !content.trim()} onClick={() => void submit()}>{submitting ? 'Posting…' : 'Post comment'}</Button>
          </Box>
        </Box>
      ) : (
        <Alert severity="info">Sign in to join the conversation.</Alert>
      )}

      {error ? <Alert severity="error">{error}</Alert> : null}
      {loading ? (
        <Stack spacing={1.5}>
          {[0, 1, 2].map((i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1.5, p: 2, borderRadius: SHAPE.sm, boxShadow: 'var(--neu-subtle)' }}>
              <Skeleton variant="circular" width={40} height={40} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Skeleton variant="text" width="30%" />
                <Skeleton variant="text" width="20%" />
                <Skeleton variant="text" width="92%" sx={{ mt: 0.75 }} />
              </Box>
            </Box>
          ))}
        </Stack>
      ) : comments.length === 0 ? (
        <EmptyState variant="noData" compact title="Start a conversation" description="Leave a message of encouragement or a question for the organizer." />
      ) : comments.map((comment) => (
        <Box key={comment.id} sx={{ display: 'flex', gap: 1.5, p: 2, borderRadius: SHAPE.sm, boxShadow: 'var(--neu-subtle)' }}>
          <Avatar src={comment.authorAvatarUrl}>{comment.authorName.charAt(0).toUpperCase()}</Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>{comment.authorName}</Typography>
            <Typography variant="caption" color="text.secondary">{new Date(comment.createdAt).toLocaleString()}</Typography>
            <Typography variant="body2" sx={{ mt: 0.75, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{comment.content}</Typography>
          </Box>
          {user && (user.id === comment.authorId || user.id === creatorId) ? <IconButton size="small" aria-label="Delete comment" onClick={() => void remove(comment.id)}><DeleteOutlineRoundedIcon fontSize="small" /></IconButton> : null}
        </Box>
      ))}
    </Stack>
  )
}

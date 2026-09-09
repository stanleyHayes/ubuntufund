import { useEffect, useRef, useState } from 'react'
import { Alert, Box, Button, MenuItem, Stack, TextField, Typography } from '@mui/material'
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded'
import { AiWritingAction, type AiWritingResponse } from '@ubuntu-fund/types'
import { api } from '@/lib/api'

const actions = [
  [AiWritingAction.CREATE_FROM_PROMPT, 'Draft from notes'],
  [AiWritingAction.IMPROVE_CLARITY, 'Improve clarity'],
  [AiWritingAction.FIX_GRAMMAR, 'Fix grammar'],
  [AiWritingAction.SUMMARIZE, 'Summarize'],
  [AiWritingAction.EXPAND, 'Expand'],
  [AiWritingAction.FORMALIZE, 'Professional tone'],
  [AiWritingAction.CASUAL, 'Conversational tone'],
  [AiWritingAction.TRANSLATE, 'Translate'],
] as const
interface Configuration {
  enabled: boolean
  remainingRequests: number
  dailyLimit: number
}
export default function AiWritingAssistant({
  value,
  onApply,
}: {
  value: string
  onApply: (text: string) => void
}) {
  const [config, setConfig] = useState<Configuration | null>(null)
  const [action, setAction] = useState(AiWritingAction.IMPROVE_CLARITY)
  const [notes, setNotes] = useState('')
  const [language, setLanguage] = useState('')
  const [suggestion, setSuggestion] = useState<{ text: string; source: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [applied, setApplied] = useState(false)
  const inFlight = useRef(false)
  useEffect(() => {
    let active = true
    api
      .get<Configuration>('/ai-writing/config')
      .then((data) => {
        if (active) setConfig(data)
      })
      .catch((err) => {
        if (active)
          setError(err instanceof Error ? err.message : 'Unable to load the writing assistant.')
      })
    return () => {
      active = false
    }
  }, [])
  async function generate() {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError('')
    setApplied(false)
    setSuggestion(null)
    const source = value
    try {
      const response = await api.post<AiWritingResponse>('/ai-writing', {
        text: action === AiWritingAction.CREATE_FROM_PROMPT ? notes : value,
        action,
        targetLanguage: action === AiWritingAction.TRANSLATE ? language : undefined,
      })
      setSuggestion({ text: response.result, source })
      setConfig(
        (previous) =>
          previous && {
            ...previous,
            remainingRequests: response.remainingRequests ?? previous.remainingRequests,
          },
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate a suggestion.')
      // Failed attempts also consume the daily allowance.
      api
        .get<Configuration>('/ai-writing/config')
        .then(setConfig)
        .catch(() => {})
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }
  const source = action === AiWritingAction.CREATE_FROM_PROMPT ? notes : value
  const changed = suggestion !== null && suggestion.source !== value
  return (
    <Box
      sx={{
        p: { xs: 2, sm: 3 },
        borderRadius: 3,
        bgcolor: 'background.paper',
        boxShadow: 'var(--neu-raised)',
      }}
    >
      <Stack spacing={2}>
        <Stack direction="row" spacing={1} alignItems="center">
          <AutoAwesomeRoundedIcon color="primary" />
          <Typography variant="h6">Writing assistant</Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          Turn your notes into a story, or refine your own words. Your text is sent to OpenAI when
          you request a suggestion. Review it before applying.
        </Typography>
        {error && <Alert severity="error">{error}</Alert>}
        {config && !config.enabled && (
          <Alert severity="info">
            AI writing is currently unavailable. You can continue writing your story below.
          </Alert>
        )}
        {!config && !error && <Typography role="status">Loading assistant…</Typography>}
        {config?.enabled && (
          <>
            <TextField
              select
              label="Writing task"
              value={action}
              disabled={busy}
              onChange={(e) => {
                setAction(e.target.value as AiWritingAction)
                setSuggestion(null)
                setApplied(false)
              }}
              fullWidth
            >
              {actions.map(([key, label]) => (
                <MenuItem key={key} value={key}>
                  {label}
                </MenuItem>
              ))}
            </TextField>
            {action === AiWritingAction.CREATE_FROM_PROMPT && (
              <TextField
                label="Your notes"
                helperText="Who needs help, what happened, how much is needed, and how the funds will be used."
                multiline
                minRows={3}
                value={notes}
                disabled={busy}
                onChange={(e) => setNotes(e.target.value)}
                slotProps={{ htmlInput: { maxLength: 12000 } }}
              />
            )}
            {action === AiWritingAction.TRANSLATE && (
              <TextField
                label="Translate into"
                placeholder="e.g. French, Twi"
                value={language}
                disabled={busy}
                onChange={(e) => setLanguage(e.target.value)}
                slotProps={{ htmlInput: { maxLength: 60 } }}
              />
            )}
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              alignItems={{ sm: 'center' }}
            >
              <Button
                type="button"
                variant="outlined"
                disabled={
                  busy ||
                  !source.trim() ||
                  source.length > 12000 ||
                  config.remainingRequests === 0 ||
                  (action === AiWritingAction.TRANSLATE && language.trim().length < 2)
                }
                onClick={generate}
              >
                {busy ? 'Writing…' : 'Get suggestion'}
              </Button>
              <Typography variant="caption" color="text.secondary">
                {config.remainingRequests} of {config.dailyLimit} requests left today · resets at
                midnight UTC
              </Typography>
            </Stack>
            {source.length > 12000 && (
              <Alert severity="info">
                Shorten your text to 12,000 characters to use the assistant.
              </Alert>
            )}
          </>
        )}
        {suggestion && (
          <Box sx={{ p: 2, borderRadius: 2, boxShadow: 'var(--neu-inset)' }}>
            <Typography variant="subtitle2" gutterBottom>
              Suggested story
            </Typography>
            <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              {suggestion.text}
            </Typography>
            {changed && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                Your story changed while this suggestion was open. Generate a new suggestion to keep
                those edits.
              </Alert>
            )}
            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
              <Button
                type="button"
                variant="contained"
                disabled={changed}
                onClick={() => {
                  onApply(suggestion.text)
                  setSuggestion(null)
                  setApplied(true)
                }}
              >
                Apply to story
              </Button>
              <Button type="button" onClick={() => setSuggestion(null)}>
                Discard
              </Button>
            </Stack>
          </Box>
        )}
        {applied && (
          <Alert severity="success">Suggestion applied. Review the facts before publishing.</Alert>
        )}
      </Stack>
    </Box>
  )
}

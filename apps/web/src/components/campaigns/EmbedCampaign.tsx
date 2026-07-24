import { useState, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Snackbar from '@mui/material/Snackbar'
import ContentCopyRounded from '@mui/icons-material/ContentCopyRounded'
import { SHAPE } from '@ubuntu-fund/ui'

interface EmbedCampaignProps {
  campaignId: string
  title: string
}

export function EmbedCampaign({ campaignId, title }: EmbedCampaignProps) {
  const [snackOpen, setSnackOpen] = useState(false)

  const embedUrl = `${window.location.origin}/campaigns/${campaignId}/embed`
  const embedCode = `<iframe src="${embedUrl}" width="100%" height="400" frameborder="0" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share" style="border-radius: 8px; border: none;"></iframe>`

  const handleCopyEmbed = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(embedCode)
      setSnackOpen(true)
    } catch {
      // Fallback: create a temporary textarea
      const textarea = document.createElement('textarea')
      textarea.value = embedCode
      document.body.appendChild(textarea)
      textarea.select()
      try {
        document.execCommand('copy')
        setSnackOpen(true)
      } catch {
        alert('Failed to copy embed code')
      } finally {
        document.body.removeChild(textarea)
      }
    }
  }, [embedCode])

  return (
    <>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          Embed Campaign
        </Typography>

        <Box
          component="pre"
          sx={{
            p: 2,
            m: 0,
            maxWidth: '100%',
            bgcolor: '#F2EFEA',
            borderRadius: SHAPE.sm,
            fontSize: '0.75rem',
            lineHeight: 1.5,
            fontFamily: 'monospace',
            border: '1px solid',
            borderColor: 'divider',
            // The snippet is one long unbreakable line — wrap it instead of
            // letting it force horizontal overflow on small screens.
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            '& code': {
              color: '#4A5A50',
            },
          }}
        >
          <code>{embedCode}</code>
        </Box>

        <Button
          variant="outlined"
          size="small"
          startIcon={<ContentCopyRounded />}
          onClick={handleCopyEmbed}
          aria-label={`Copy embed code for ${title}`}
        >
          Copy Code
        </Button>
      </Box>

      <Snackbar
        open={snackOpen}
        autoHideDuration={3000}
        onClose={() => setSnackOpen(false)}
        message="Embed code copied to clipboard!"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  )
}

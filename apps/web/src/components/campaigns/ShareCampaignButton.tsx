import { useState, useCallback } from 'react'
import Button from '@mui/material/Button'
import Snackbar from '@mui/material/Snackbar'
import ShareRounded from '@mui/icons-material/ShareRounded'

interface ShareCampaignButtonProps {
  campaignId: string
  title: string
  url: string
}

export function ShareCampaignButton({
  campaignId,
  title,
  url,
}: ShareCampaignButtonProps) {
  const [snackOpen, setSnackOpen] = useState(false)

  const handleShare = useCallback(() => {
    // Try native Web Share API first (mobile-friendly)
    if (navigator.share) {
      void navigator.share({
        title: `Support ${title}`,
        text: `Check out this campaign on UbuntuFund`,
        url,
      }).catch(() => {
        // If share dialog is cancelled, fall back to clipboard
        void copyToClipboard()
      })
    } else {
      // Fall back to clipboard copy
      void copyToClipboard()
    }
  }, [url, title])

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setSnackOpen(true)
    } catch {
      // Fallback: create a temporary textarea
      const textarea = document.createElement('textarea')
      textarea.value = url
      document.body.appendChild(textarea)
      textarea.select()
      try {
        document.execCommand('copy')
        setSnackOpen(true)
      } catch {
        alert('Failed to copy link')
      } finally {
        document.body.removeChild(textarea)
      }
    }
  }

  return (
    <>
      <Button
        variant="outlined"
        size="small"
        startIcon={<ShareRounded />}
        onClick={handleShare}
        aria-label={`Share ${title}`}
      >
        Share
      </Button>

      <Snackbar
        open={snackOpen}
        autoHideDuration={3000}
        onClose={() => setSnackOpen(false)}
        message="Link copied to clipboard!"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  )
}

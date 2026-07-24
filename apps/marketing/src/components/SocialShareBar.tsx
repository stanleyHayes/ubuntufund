import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import FacebookIcon from '@mui/icons-material/Facebook'
import XIcon from '@mui/icons-material/X'
import LinkedInIcon from '@mui/icons-material/LinkedIn'
import WhatsAppIcon from '@mui/icons-material/WhatsApp'
import LinkIcon from '@mui/icons-material/Link'
import { useState } from 'react'


interface SocialShareBarProps {
  url?: string
  title?: string
  description?: string
}

export function SocialShareBar({ url, title = 'UbuntuFund', description: _description }: SocialShareBarProps) {
  const [copied, setCopied] = useState(false)
  const shareUrl = url ?? (typeof window !== 'undefined' ? window.location.href : 'https://ubuntufund.com')

  const shareLinks = {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(shareUrl)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${title} - ${shareUrl}`)}`,
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
        Share:
      </Typography>
      <IconButton
        size="small"
        onClick={() => window.open(shareLinks.facebook, '_blank')}
        sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#1877F2' } }}
        aria-label="Share on Facebook"
      >
        <FacebookIcon fontSize="small" />
      </IconButton>
      <IconButton
        size="small"
        onClick={() => window.open(shareLinks.twitter, '_blank')}
        sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fff' } }}
        aria-label="Share on X"
      >
        <XIcon fontSize="small" />
      </IconButton>
      <IconButton
        size="small"
        onClick={() => window.open(shareLinks.linkedin, '_blank')}
        sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#0A66C2' } }}
        aria-label="Share on LinkedIn"
      >
        <LinkedInIcon fontSize="small" />
      </IconButton>
      <IconButton
        size="small"
        onClick={() => window.open(shareLinks.whatsapp, '_blank')}
        sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#25D366' } }}
        aria-label="Share on WhatsApp"
      >
        <WhatsAppIcon fontSize="small" />
      </IconButton>
      <IconButton
        size="small"
        onClick={handleCopy}
        sx={{ color: copied ? '#5E8F72' : 'rgba(255,255,255,0.5)', '&:hover': { color: '#C7A24A' } }}
        aria-label="Copy link"
      >
        <LinkIcon fontSize="small" />
      </IconButton>
    </Box>
  )
}

import { useState } from 'react'
import { Button, Menu, MenuItem, ListItemIcon, Snackbar } from '@mui/material'
import ShareRounded from '@mui/icons-material/ShareRounded'
import ContentCopyRounded from '@mui/icons-material/ContentCopyRounded'
import WhatsApp from '@mui/icons-material/WhatsApp'
import Facebook from '@mui/icons-material/Facebook'
import X from '@mui/icons-material/X'
import LinkedIn from '@mui/icons-material/LinkedIn'

interface ShareCampaignButtonProps { campaignId: string; title: string; url: string }
export function ShareCampaignButton({ title, url }: ShareCampaignButtonProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [message, setMessage] = useState('')
  const links = [
    { name: 'WhatsApp', icon: WhatsApp, href: `https://wa.me/?text=${encodeURIComponent(`Support ${title}: ${url}`)}` },
    { name: 'Facebook', icon: Facebook, href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
    { name: 'X', icon: X, href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(`Support ${title}`)}` },
    { name: 'LinkedIn', icon: LinkedIn, href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` },
  ]
  return <>
    <Button variant="outlined" size="small" startIcon={<ShareRounded />} onClick={e => setAnchor(e.currentTarget)} aria-label={`Share ${title}`} aria-haspopup="menu" aria-expanded={!!anchor}>Share</Button>
    <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
      {links.map(link => <MenuItem key={link.name} component="a" href={link.href} target="_blank" rel="noopener noreferrer" onClick={() => setAnchor(null)}><ListItemIcon><link.icon fontSize="small" /></ListItemIcon>{link.name}</MenuItem>)}
      <MenuItem onClick={async () => { setAnchor(null); try { await navigator.clipboard.writeText(url); setMessage('Campaign link copied') } catch { setMessage('Could not copy the link. Use your browser’s address bar to copy it.') } }}><ListItemIcon><ContentCopyRounded fontSize="small" /></ListItemIcon>Copy link / share on Instagram</MenuItem>
      {typeof navigator.share === 'function' && <MenuItem onClick={async () => { setAnchor(null); try { await navigator.share({ title, url }) } catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) setMessage('Sharing failed. Try copying the link.') } }}><ListItemIcon><ShareRounded fontSize="small" /></ListItemIcon>More sharing options</MenuItem>}
    </Menu>
    <Snackbar open={!!message} autoHideDuration={4000} message={message} onClose={() => setMessage('')} />
  </>
}

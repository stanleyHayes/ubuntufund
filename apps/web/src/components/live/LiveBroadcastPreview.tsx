import { useEffect, useRef, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import { overlayViewUrl, type LiveSession } from '@/lib/fundraising'

export function LiveBroadcastPreview({ session, title, raised, goal }: {
  session: LiveSession | null; title: string; raised: number; goal: number
}) {
  const stage = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(960)
  useEffect(() => {
    const node = stage.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  const url = new URL(overlayViewUrl(session?.id ?? 'preview', session?.overlayToken ?? ''))
  if (!session) {
    url.searchParams.set('preview', '1')
    url.searchParams.set('title', title)
    url.searchParams.set('raised', String(raised))
    url.searchParams.set('goal', String(goal))
  }
  return <Box sx={{ minWidth: 0 }}>
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2, gap: 1 }}>
      <Box><Typography component="h2" sx={{ fontSize: '1.15rem', fontWeight: 800 }}>Your broadcast canvas</Typography>
        <Typography sx={{ color: 'text.secondary', fontSize: '.85rem' }}>{session ? 'Live overlay' : 'Preview before you go live'}</Typography></Box>
      <Typography sx={{ fontSize: '.7rem', fontWeight: 700, color: 'text.secondary' }}>16:9</Typography>
    </Stack>
    <Box ref={stage} sx={{ aspectRatio: '16 / 9', overflow: 'hidden', position: 'relative', borderRadius: 3, bgcolor: '#19271F', backgroundImage: 'radial-gradient(ellipse at 60% 20%, #3B5140, #19271F 80%)', border: '1px solid rgba(168,181,160,.25)' }}>
      <Box sx={{ position: 'absolute', top: '20%', width: '100%', textAlign: 'center', color: '#A8B5A0' }}>
        <Typography sx={{ fontSize: { xs: '.65rem', sm: '.85rem' }, letterSpacing: '.18em', textTransform: 'uppercase' }}>Your stream goes here</Typography>
        <Typography sx={{ mt: 1, fontFamily: 'Outfit, sans-serif', fontSize: { xs: '1.15rem', sm: '2rem' }, fontWeight: 600, color: '#F2EFEA' }}>One chain. Many hands.</Typography>
      </Box>
      <Box component="iframe" title="Broadcast preview" src={url.toString()} referrerPolicy="no-referrer" sx={{ position: 'absolute', border: 0, width: 960, height: 540, transform: `scale(${width / 960})`, transformOrigin: 'top left' }} />
    </Box>
    <Typography sx={{ color: 'text.secondary', fontSize: '.8rem', mt: 1.5, mb: 3 }}>The backdrop is for preview only. Your overlay stays transparent in OBS.</Typography>
  </Box>
}

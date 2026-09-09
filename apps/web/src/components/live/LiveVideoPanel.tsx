import { useState } from 'react'
import { LiveKitRoom, GridLayout, ParticipantTile, RoomAudioRenderer, ControlBar, useTracks, StartAudio, useConnectionState } from '@livekit/components-react'
import { Track } from 'livekit-client'
import '@livekit/components-styles'
import Box from '@mui/material/Box'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import { Button, LoadingDots, SHAPE } from '@ubuntu-fund/ui'
import { api } from '@/lib/api'

function BroadcastTracks({ host }: { host: boolean }) {
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare], { onlySubscribed: false })
  const connection = useConnectionState()
  return <>
    <Typography role="status" sx={{ p: 1.5, color: '#F2EFEA', fontSize: '.8rem' }}>{connection === 'connected' ? (host ? 'Connected · Your enabled camera and microphone are live' : 'Connected to broadcast') : connection}</Typography>
    <Box sx={{ height: { xs: 260, md: 420 }, position: 'relative' }}>
      {tracks.length ? <GridLayout tracks={tracks}><ParticipantTile /></GridLayout> : <Box sx={{ height: '100%', display: 'grid', placeItems: 'center', p: 3, color: '#F2EFEA' }}><Typography>{host ? 'Enable your camera or share your screen to begin.' : 'Waiting for the host’s video…'}</Typography></Box>}
    </Box>
    <RoomAudioRenderer />
    <StartAudio label="Enable broadcast audio" />
    {host && <ControlBar controls={{ microphone: true, camera: true, screenShare: true, chat: false, leave: true }} />}
  </>
}
export function LiveVideoPanel({ sessionId, host = false }: { sessionId: string; host?: boolean }) {
  const [connection, setConnection] = useState<{ serverUrl: string; token: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function join() {
    setBusy(true); setError('')
    try { setConnection(await api.post(`/live-sessions/${sessionId}/video/${host ? 'host' : 'viewer'}-token`, {})) }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not join the broadcast.') }
    finally { setBusy(false) }
  }
  return <Box>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {connection ? <Box data-lk-theme="default" sx={{ bgcolor: '#19271F', borderRadius: SHAPE.card, overflow: 'hidden', '& .lk-control-bar': { flexWrap: 'wrap' } }}>
      <LiveKitRoom serverUrl={connection.serverUrl} token={connection.token} connect audio={host} video={host} onDisconnected={() => setConnection(null)} onError={err => setError(err.message)} onMediaDeviceFailure={() => setError('Camera or microphone access failed. Allow access in your browser, then enable the device below.')}>
        <BroadcastTracks host={host} />
      </LiveKitRoom>
      <Box sx={{ p: 1.5 }}><Button brandVariant="outline" onClick={() => setConnection(null)} sx={{ color: '#F2EFEA', borderColor: '#A8B5A0' }}>{host ? 'Disconnect camera' : 'Leave broadcast'}</Button></Box>
    </Box> : <Box sx={{ p: { xs: 3, md: 6 }, textAlign: 'center', bgcolor: 'var(--neu-surface)', boxShadow: 'var(--neu-inset)', borderRadius: SHAPE.card }}>
      <Typography component="h2" sx={{ fontSize: '1.3rem', fontWeight: 800, mb: 1 }}>{host ? 'You’re ready to broadcast' : 'Watch live on Ujimora'}</Typography>
      <Typography sx={{ color: 'text.secondary', mb: 3 }}>{host ? 'Connect your camera and microphone. Viewers can watch and donate from your live link.' : 'Join the broadcast. Your camera and microphone stay off.'}</Typography>
      <Button brandVariant="primary" disabled={busy} onClick={join} startIcon={busy ? <LoadingDots size={5} /> : undefined}>{busy ? 'Connecting…' : host ? 'Start camera & microphone' : 'Watch broadcast'}</Button>
    </Box>}
  </Box>
}

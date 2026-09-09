import { ScreenCapturePickerView } from '@livekit/react-native-webrtc'
import { useEffect, useState, useRef } from 'react'
import { AppState, View, Platform, NativeModules, findNodeHandle } from 'react-native'
import { Text } from 'react-native-paper'
import { AudioSession, LiveKitRoom, VideoTrack, useTracks, isTrackReference, useLocalParticipant, useConnectionState, registerGlobals } from '@livekit/react-native'
import { Track } from 'livekit-client'
import { api } from '@/lib/api'
import { usePalette, useNeu } from '@/context/ColorModeContext'
import { Button } from './Loading'
registerGlobals()

function Tracks({ host }: { host: boolean }) {
  const tracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare])
  const connection = useConnectionState()
  const { localParticipant, isCameraEnabled, isMicrophoneEnabled, isScreenShareEnabled } = useLocalParticipant()
  const screenCapture = useRef<View>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const p = usePalette()
  async function toggle(action: () => Promise<unknown>) { setBusy(true); setError(''); try { await action() } catch (e) { setError(e instanceof Error ? e.message : 'Media access failed. Check permissions.') } finally { setBusy(false) } }
  useEffect(() => {
    if (!host) return
    const listener = AppState.addEventListener('change', state => {
      // Do not capture camera/mic while the host is away. The host explicitly
      // re-enables publishing on return, with visible control state.
      if (state === 'background' && !localParticipant.isScreenShareEnabled) {
        void localParticipant.setCameraEnabled(false).catch(() => {})
        void localParticipant.setMicrophoneEnabled(false).catch(() => {})
      }
    })
    return () => listener.remove()
  }, [host, localParticipant])
  return <View style={{ gap: 12 }}>
    {host && Platform.OS === 'ios' && <View style={{ width: 0, height: 0, overflow: 'hidden' }}><ScreenCapturePickerView ref={screenCapture} /></View>}
    <Text style={{ color: p.text }}>Connection: {connection}</Text>
    {tracks.filter(isTrackReference).map(track => <VideoTrack key={`${track.participant.identity}:${track.publication.trackSid}`} trackRef={track} style={{ height: 260, width: '100%', borderRadius: 16 }} />)}
    {!tracks.length && <Text>Waiting for video. {host ? 'Enable your camera or screen sharing below.' : 'The host may have their camera off.'}</Text>}
    {host && isScreenShareEnabled && <Text>Your screen and enabled microphone are shared. Other apps’ audio is not included.</Text>}
    {error ? <Text accessibilityRole="alert" style={{ color: p.error }}>{error}</Text> : null}
    {host && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      <Button disabled={busy} icon={isCameraEnabled ? 'camera-off' : 'camera'} onPress={() => void toggle(() => localParticipant.setCameraEnabled(!isCameraEnabled))}>{isCameraEnabled ? 'Camera off' : 'Camera on'}</Button>
      <Button disabled={busy} icon={isMicrophoneEnabled ? 'microphone-off' : 'microphone'} onPress={() => void toggle(() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled))}>{isMicrophoneEnabled ? 'Mute' : 'Unmute'}</Button>
      <Button disabled={busy} icon="monitor-share" onPress={() => void toggle(async () => {
        if (Platform.OS === 'ios' && !isScreenShareEnabled) {
          const tag = findNodeHandle(screenCapture.current)
          if (!tag) throw new Error('The screen-sharing picker is not ready. Try again.')
          await NativeModules.ScreenCapturePickerViewManager.show(tag)
        }
        await localParticipant.setScreenShareEnabled(!isScreenShareEnabled)
      })}>{isScreenShareEnabled ? 'Stop sharing' : 'Share screen'}</Button>
    </View>}
  </View>
}
export function LiveVideo({ sessionId, host = false }: { sessionId: string; host?: boolean }) {
  const p = usePalette(); const neu = useNeu()
  const [connection, setConnection] = useState<{ serverUrl: string; token: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lifecycle = useRef(0)
  const joining = useRef(false)
  useEffect(() => {
    const counter = lifecycle
    counter.current++
    setConnection(null)
    return () => { counter.current++; void AudioSession.stopAudioSession().catch(() => {}) }
  }, [sessionId, host])
  async function join() {
    if (joining.current) return
    joining.current = true
    const ticket = lifecycle.current
    setBusy(true); setError('')
    try {
      const result = await api.post<{ serverUrl: string; token: string }>(`/live-sessions/${sessionId}/video/${host ? 'host' : 'viewer'}-token`, {})
      if (ticket !== lifecycle.current) return
      await AudioSession.startAudioSession()
      if (ticket !== lifecycle.current) { await AudioSession.stopAudioSession(); return }
      setConnection(result)
    } catch (e) { if (ticket === lifecycle.current) setError(e instanceof Error ? e.message : 'Could not join broadcast.') } finally { joining.current = false; if (ticket === lifecycle.current) setBusy(false) }
  }
  function leave() { lifecycle.current++; setConnection(null); setBusy(false); void AudioSession.stopAudioSession().catch(() => {}) }
  return <View style={{ ...neu.raised, backgroundColor: p.surface, borderRadius: 24, padding: 16, gap: 16 }}>
    {error ? <Text accessibilityRole="alert" style={{ color: p.error }}>{error}</Text> : null}
    {connection ? <>
      <LiveKitRoom serverUrl={connection.serverUrl} token={connection.token} connect audio={host} video={host} options={{ adaptiveStream: { pixelDensity: 'screen' } }} onDisconnected={leave} onError={e => setError(e.message)} onMediaDeviceFailure={() => setError('Camera or microphone access failed. Allow access in Settings, then enable the device.')}><Tracks host={host} /></LiveKitRoom>
      <Button onPress={leave}>{host ? 'Disconnect camera' : 'Leave broadcast'}</Button>
    </> : <><Text variant="titleLarge">{host ? 'Ready to broadcast' : 'Watch live on Ujimora'}</Text><Text>{host ? 'Your enabled camera and microphone will be shared with viewers.' : 'Join as a viewer. Your camera and microphone remain off.'}</Text><Button mode="contained" loading={busy} disabled={busy} onPress={() => void join()}>{host ? 'Start camera and microphone' : 'Watch broadcast'}</Button></>}
  </View>
}

// ---------------------------------------------------------------------------
// QrCodeManager — owner-facing dynamic QR / short-link manager for a campaign.
//
// Mint a QR of each kind (campaign / live / amount / creator), preview the
// returned PNG, copy the human-readable short URL, and download the image.
// Existing short-links are listed via `listCampaignQrCodes`; freshly minted
// codes carry their `pngDataUrl` so they render an image + download link.
// (The list endpoint returns metadata only — no image — so previously minted
// codes show the copyable short URL and scan count.)
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Stack from '@mui/material/Stack'
import Chip from '@mui/material/Chip'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Divider from '@mui/material/Divider'
import Alert from '@mui/material/Alert'
import Skeleton from '@mui/material/Skeleton'
import CircularProgress from '@mui/material/CircularProgress'
import QrCode2RoundedIcon from '@mui/icons-material/QrCode2Rounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import { Button, SHAPE, formatCurrency } from '@ubuntu-fund/ui'
import {
  createQrCode,
  listCampaignQrCodes,
  type QrKind,
  type CreateQrCodeInput,
  type ShortLinkView,
} from '@/lib/fundraising'

interface QrCodeManagerProps {
  campaignId: string
  /** When present, `live`-kind codes bind to this active session. */
  liveSessionId?: string
}

const KIND_META: Record<QrKind, { label: string; help: string }> = {
  campaign: { label: 'Campaign', help: 'Links to the campaign page.' },
  live: { label: 'Live', help: 'Links to the live view of this campaign.' },
  amount: { label: 'Preset amount', help: 'Donate flow pre-filled with an amount.' },
  creator: { label: 'Creator', help: "The creator's public profile." },
  event: { label: 'Event', help: 'Campaign page tagged for an offline flyer.' },
}

const KIND_ORDER: QrKind[] = ['campaign', 'live', 'amount', 'creator']

export function QrCodeManager({ campaignId, liveSessionId }: QrCodeManagerProps) {
  const [codes, setCodes] = useState<ShortLinkView[]>([])
  // code -> data URL for codes minted in this session (the list API has no image).
  const [images, setImages] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyKind, setBusyKind] = useState<QrKind | null>(null)
  const [presetAmount, setPresetAmount] = useState('')
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const loadCodes = useCallback(async () => {
    try {
      const list = await listCampaignQrCodes(campaignId)
      setCodes(list)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load QR codes.')
    } finally {
      setLoading(false)
    }
  }, [campaignId])

  useEffect(() => {
    setLoading(true)
    loadCodes()
  }, [loadCodes])

  const handleGenerate = useCallback(
    async (kind: QrKind) => {
      setError(null)

      const input: CreateQrCodeInput = { kind }
      if (kind === 'amount') {
        const amount = Number(presetAmount)
        if (!Number.isFinite(amount) || amount <= 0) {
          setError('Enter a preset amount greater than zero first.')
          return
        }
        input.presetAmount = amount
      }
      if (kind === 'live' && liveSessionId) {
        input.liveSessionId = liveSessionId
      }

      setBusyKind(kind)
      try {
        const res = await createQrCode(campaignId, input)
        setImages((prev) => ({ ...prev, [res.code]: res.pngDataUrl }))
        // Optimistically surface the new code, then reconcile with the server.
        const optimistic: ShortLinkView = {
          id: res.code,
          code: res.code,
          campaignId,
          kind,
          liveSessionId: kind === 'live' ? liveSessionId : undefined,
          presetAmount: kind === 'amount' ? input.presetAmount : undefined,
          createdBy: '',
          target: res.target,
          scanCount: 0,
          createdAt: new Date(),
          shortUrl: res.shortUrl,
        }
        setCodes((prev) => [optimistic, ...prev.filter((c) => c.code !== res.code)])
        if (kind === 'amount') setPresetAmount('')
        loadCodes()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not generate the QR code.')
      } finally {
        setBusyKind(null)
      }
    },
    [campaignId, liveSessionId, presetAmount, loadCodes],
  )

  const handleCopy = useCallback(async (code: string, shortUrl: string) => {
    try {
      await navigator.clipboard.writeText(shortUrl)
      setCopiedCode(code)
      window.setTimeout(() => setCopiedCode((c) => (c === code ? null : c)), 1600)
    } catch {
      setError('Clipboard is unavailable — copy the link manually.')
    }
  }, [])

  return (
    <Box>
      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 0.5 }}>
        <QrCode2RoundedIcon sx={{ color: 'primary.main' }} />
        <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>Dynamic QR codes</Typography>
      </Stack>
      <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem', mb: 2.5 }}>
        Print or share a QR — its destination stays editable, and every scan is counted.
      </Typography>

      {/* ===== Generate controls ===== */}
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
        {KIND_ORDER.map((kind) => (
          <Tooltip key={kind} title={KIND_META[kind].help} arrow>
            <span>
              <Button
                brandVariant="outline"
                onClick={() => handleGenerate(kind)}
                disabled={busyKind !== null || (kind === 'live' && !liveSessionId)}
                startIcon={
                  busyKind === kind ? (
                    <CircularProgress size={15} color="inherit" />
                  ) : (
                    <QrCode2RoundedIcon />
                  )
                }
                sx={{ textTransform: 'none', fontWeight: 700, borderRadius: SHAPE.sm }}
              >
                {KIND_META[kind].label}
              </Button>
            </span>
          </Tooltip>
        ))}
      </Stack>

      <TextField
        label="Preset amount"
        value={presetAmount}
        onChange={(e) => setPresetAmount(e.target.value.replace(/[^0-9.]/g, ''))}
        placeholder="e.g. 50"
        size="small"
        inputMode="decimal"
        InputProps={{
          startAdornment: <InputAdornment position="start">GHS</InputAdornment>,
        }}
        helperText="Used by the “Preset amount” QR."
        sx={{ mb: 2, maxWidth: 220 }}
      />

      {error && (
        <Alert severity="warning" sx={{ borderRadius: SHAPE.card, mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Divider sx={{ mb: 2 }} />

      {/* ===== Existing / minted codes ===== */}
      {loading ? (
        <Stack spacing={1.5}>
          {[0, 1].map((i) => (
            <Skeleton key={i} variant="rounded" height={92} sx={{ borderRadius: SHAPE.card }} />
          ))}
        </Stack>
      ) : codes.length === 0 ? (
        <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem', py: 1 }}>
          No QR codes yet. Generate one above to share this campaign.
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          {codes.map((code) => {
            const image = images[code.code]
            return (
              <Box
                key={code.code}
                sx={{
                  display: 'flex',
                  gap: 1.75,
                  p: 1.75,
                  border: '1.5px solid rgba(46,61,47,0.12)',
                  borderRadius: SHAPE.card,
                  alignItems: 'center',
                }}
              >
                {image ? (
                  <Box
                    component="img"
                    src={image}
                    alt={`QR code for ${KIND_META[code.kind].label}`}
                    sx={{
                      width: 72,
                      height: 72,
                      flexShrink: 0,
                      borderRadius: SHAPE.sm,
                      bgcolor: '#fff',
                      p: 0.5,
                    }}
                  />
                ) : (
                  <Box
                    sx={{
                      width: 72,
                      height: 72,
                      flexShrink: 0,
                      borderRadius: SHAPE.sm,
                      bgcolor: 'rgba(46,61,47,0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <QrCode2RoundedIcon sx={{ color: 'rgba(46,61,47,0.35)', fontSize: 34 }} />
                  </Box>
                )}

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5, flexWrap: 'wrap' }}>
                    <Chip
                      label={KIND_META[code.kind].label}
                      size="small"
                      sx={{
                        borderRadius: SHAPE.sm,
                        fontWeight: 700,
                        bgcolor: 'rgba(46,61,47,0.08)',
                        color: 'primary.main',
                      }}
                    />
                    {typeof code.presetAmount === 'number' && (
                      <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
                        {formatCurrency(code.presetAmount, 'GHS')}
                      </Typography>
                    )}
                    <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', ml: 'auto' }}>
                      {code.scanCount} {code.scanCount === 1 ? 'scan' : 'scans'}
                    </Typography>
                  </Stack>

                  <Typography
                    component="a"
                    href={code.shortUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.5,
                      fontFamily: 'monospace',
                      fontSize: '0.8rem',
                      color: 'primary.main',
                      textDecoration: 'none',
                      wordBreak: 'break-all',
                      '&:hover': { textDecoration: 'underline' },
                    }}
                  >
                    {code.shortUrl}
                    <OpenInNewRoundedIcon sx={{ fontSize: 13 }} />
                  </Typography>

                  <Stack direction="row" spacing={0.5} sx={{ mt: 0.75 }}>
                    <Tooltip title={copiedCode === code.code ? 'Copied' : 'Copy link'} arrow>
                      <IconButton
                        size="small"
                        aria-label={`Copy short link for the ${KIND_META[code.kind].label} QR`}
                        onClick={() => handleCopy(code.code, code.shortUrl)}
                      >
                        {copiedCode === code.code ? (
                          <CheckRoundedIcon sx={{ fontSize: 18, color: 'success.main' }} />
                        ) : (
                          <ContentCopyRoundedIcon sx={{ fontSize: 18 }} />
                        )}
                      </IconButton>
                    </Tooltip>
                    {image && (
                      <Tooltip title="Download PNG" arrow>
                        <IconButton
                          size="small"
                          component="a"
                          href={image}
                          download={`qr-${code.kind}-${code.code}.png`}
                          aria-label={`Download the ${KIND_META[code.kind].label} QR image`}
                        >
                          <DownloadRoundedIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                </Box>
              </Box>
            )
          })}
        </Stack>
      )}
    </Box>
  )
}

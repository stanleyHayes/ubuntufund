import { useCallback, useEffect, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import { Link as RouterLink } from 'react-router-dom'
import { SHAPE, LoadingDots, formatCurrency } from '@ubuntu-fund/ui'
import type {
  CryptoAsset,
  CryptoAssetInfo,
  CryptoQuote,
  CryptoDepositView,
} from '@ubuntu-fund/types'
import {
  getCryptoAssets,
  createCryptoQuote,
  createCryptoDeposit,
} from '@/lib/crypto'
import { getDonationIntentStatus } from '@/lib/fundraising'

const FOREST = '#2E3D2F'
const GOLD = '#C7A24A'

interface Props {
  campaignId: string
  /** GHS amount the campaign should receive. */
  amount: number
  amountValid: boolean
  donorEmail: string
  emailValid: boolean
  donorName?: string
  message?: string
  isAnonymous: boolean
  /** Path back to the campaign for the success state. */
  campaignPath: string
}

function mmss(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

/**
 * The crypto contribution flow (Crypto Donations plan §3): pick asset + network,
 * get an expiring quote (You send X USDT → campaign receives GHS Y), then fund
 * the exact address on the exact network. The GHS-equivalent is locked at quote
 * time; the campaign is credited only once the deposit CONFIRMS (polled).
 */
export function CryptoDonatePanel({
  campaignId,
  amount,
  amountValid,
  donorEmail,
  emailValid,
  donorName,
  message,
  isAnonymous,
  campaignPath,
}: Props) {
  const [assets, setAssets] = useState<CryptoAssetInfo[]>([])
  const [asset, setAsset] = useState<CryptoAsset | null>(null)
  const [network, setNetwork] = useState<string | null>(null)
  const [phase, setPhase] = useState<'select' | 'quoted' | 'deposit' | 'confirmed' | 'failed'>('select')
  const [quote, setQuote] = useState<CryptoQuote | null>(null)
  const [deposit, setDeposit] = useState<CryptoDepositView | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let active = true
    getCryptoAssets()
      .then((r) => {
        if (active && r.enabled) setAssets(r.assets)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  // 1s ticker drives the quote/deposit countdowns.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // Poll the deposit status — the webhook, not this poll, is the source of truth.
  useEffect(() => {
    if (phase !== 'deposit' || !deposit) return
    let active = true
    const poll = async () => {
      try {
        const s = await getDonationIntentStatus(deposit.donationIntentId)
        if (!active) return
        if (s.status === 'SUCCEEDED') setPhase('confirmed')
        else if (['FAILED', 'EXPIRED', 'CANCELLED'].includes(s.status)) setPhase('failed')
      } catch {
        /* transient — try again next tick */
      }
    }
    void poll()
    const t = setInterval(poll, 5000)
    return () => {
      active = false
      clearInterval(t)
    }
  }, [phase, deposit])

  const networks = asset ? (assets.find((a) => a.asset === asset)?.networks ?? []) : []
  const quoteSecondsLeft = quote
    ? Math.round((new Date(quote.expiresAt).getTime() - now) / 1000)
    : 0
  const depositSecondsLeft = deposit
    ? Math.round((new Date(deposit.expiresAt).getTime() - now) / 1000)
    : 0
  const quoteExpired = Boolean(quote) && quoteSecondsLeft <= 0

  const getQuote = useCallback(async () => {
    if (!asset || !network) return
    setBusy(true)
    setError(null)
    try {
      const q = await createCryptoQuote(campaignId, { fiatAmount: amount, asset, network })
      setQuote(q)
      setPhase('quoted')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not get a quote. Please try again.')
    } finally {
      setBusy(false)
    }
  }, [asset, network, campaignId, amount])

  const continueToDeposit = useCallback(async () => {
    if (!quote) return
    setBusy(true)
    setError(null)
    try {
      const d = await createCryptoDeposit(campaignId, {
        quoteId: quote.quoteId,
        donorEmail,
        donorName: donorName || undefined,
        message: message || undefined,
        isAnonymous,
      })
      setDeposit(d)
      setPhase('deposit')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the deposit. Please try again.')
    } finally {
      setBusy(false)
    }
  }, [quote, campaignId, donorEmail, donorName, message, isAnonymous])

  function reset() {
    setPhase('select')
    setQuote(null)
    setDeposit(null)
    setError(null)
  }

  function copyAddress() {
    if (!deposit) return
    navigator.clipboard?.writeText(deposit.walletAddress).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1800)
      },
      () => {},
    )
  }

  const card = { p: 2.5, borderRadius: SHAPE.card, bgcolor: 'background.paper', boxShadow: 'var(--neu-raised)' }

  // ── Confirmed ──────────────────────────────────────────────────────────────
  if (phase === 'confirmed') {
    return (
      <Box sx={{ ...card, textAlign: 'center' }}>
        <CheckCircleRoundedIcon sx={{ fontSize: 56, color: 'var(--text-success)', mb: 1 }} />
        <Typography sx={{ fontWeight: 900, fontSize: '1.2rem', color: FOREST }}>
          Contribution confirmed
        </Typography>
        <Typography sx={{ color: 'text.secondary', mt: 0.5, mb: 2.5 }}>
          Thank you! Your {formatCurrency(amount, 'GHS')} contribution has been credited to the campaign.
        </Typography>
        <Button component={RouterLink} to={campaignPath} variant="contained" sx={{ borderRadius: '999px', fontWeight: 800, textTransform: 'none', px: 4 }}>
          Back to campaign
        </Button>
      </Box>
    )
  }

  // ── Failed ────────────────────────────────────────────────────────────────
  if (phase === 'failed') {
    return (
      <Box sx={card}>
        <Alert severity="error" sx={{ mb: 2 }}>
          This contribution didn’t complete. No funds were credited. If you sent crypto, contact support with your transaction hash.
        </Alert>
        <Button onClick={reset} variant="outlined" sx={{ borderRadius: '999px', textTransform: 'none', fontWeight: 700 }}>
          Start over
        </Button>
      </Box>
    )
  }

  // ── Deposit (awaiting payment) ──────────────────────────────────────────────
  if (phase === 'deposit' && deposit) {
    const expired = depositSecondsLeft <= 0
    return (
      <Box sx={card}>
        <Typography sx={{ fontWeight: 800, color: FOREST, mb: 0.5 }}>
          Send {deposit.cryptoAmount} {deposit.asset}
        </Typography>
        <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem', mb: 2 }}>
          on <strong>{deposit.network}</strong> · campaign receives {formatCurrency(deposit.fiatAmount, deposit.fiatCurrency)}
        </Typography>

        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <Box sx={{ p: 1.5, bgcolor: '#fff', borderRadius: SHAPE.sm, border: '1px solid rgba(46,61,47,0.12)' }}>
            <QRCodeCanvas value={deposit.walletAddress} size={168} fgColor={FOREST} />
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.25, borderRadius: SHAPE.sm, bgcolor: 'action.hover', mb: 2 }}>
          <Typography sx={{ flex: 1, fontSize: '0.8rem', wordBreak: 'break-all', fontFamily: 'monospace', color: FOREST }}>
            {deposit.walletAddress}
          </Typography>
          <IconButton size="small" onClick={copyAddress} aria-label="Copy address">
            <ContentCopyRoundedIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
        {copied && (
          <Typography sx={{ fontSize: '0.78rem', color: 'var(--text-success)', mb: 1.5 }}>Address copied</Typography>
        )}

        <Alert severity="warning" icon={<WarningAmberRoundedIcon />} sx={{ mb: 2 }}>
          <AlertTitle sx={{ fontWeight: 800 }}>Send only {deposit.asset} on {deposit.network}</AlertTitle>
          Sending any other asset or using a different network will permanently lose your funds.
        </Alert>

        {expired ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            This address’s quote window has passed. If you haven’t sent yet, start a new quote for a fresh rate.
          </Alert>
        ) : (
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', textAlign: 'center', mb: 1 }}>
            Rate locked · window closes in <strong>{mmss(depositSecondsLeft)}</strong>
          </Typography>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, color: 'text.secondary', mt: 1 }}>
          <LoadingDots size={6} />
          <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
            Waiting for your transaction — this page updates automatically.
          </Typography>
        </Box>
      </Box>
    )
  }

  // ── Quoted ─────────────────────────────────────────────────────────────────
  if (phase === 'quoted' && quote) {
    return (
      <Box sx={card}>
        <Box sx={{ textAlign: 'center', mb: 2 }}>
          <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>You send</Typography>
          <Typography sx={{ fontWeight: 900, fontSize: '2rem', color: FOREST }}>
            {quote.cryptoAmount} {quote.asset}
          </Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: '0.9rem' }}>
            on {quote.network} · campaign receives {formatCurrency(quote.fiatAmount, quote.fiatCurrency)}
          </Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: '0.8rem', mt: 0.5 }}>
            1 {quote.asset} = {formatCurrency(quote.rate, quote.fiatCurrency)}
          </Typography>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {quoteExpired ? (
          <Alert severity="warning" sx={{ mb: 2 }}>This quote has expired. Get a fresh one to lock the current rate.</Alert>
        ) : (
          <Typography sx={{ textAlign: 'center', fontSize: '0.85rem', color: GOLD, fontWeight: 700, mb: 2 }}>
            Quote expires in {mmss(quoteSecondsLeft)}
          </Typography>
        )}

        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button onClick={reset} variant="outlined" sx={{ flex: 1, borderRadius: '999px', textTransform: 'none', fontWeight: 700 }}>
            Change
          </Button>
          {quoteExpired ? (
            <Button onClick={getQuote} disabled={busy} variant="contained" sx={{ flex: 2, borderRadius: '999px', textTransform: 'none', fontWeight: 800 }}>
              New quote
            </Button>
          ) : (
            <Button onClick={continueToDeposit} disabled={busy} variant="contained" startIcon={busy ? <LoadingDots size={6} /> : undefined} sx={{ flex: 2, borderRadius: '999px', textTransform: 'none', fontWeight: 800 }}>
              Continue
            </Button>
          )}
        </Box>
      </Box>
    )
  }

  // ── Select asset + network ──────────────────────────────────────────────────
  return (
    <Box sx={card}>
      <Typography sx={{ fontWeight: 800, color: FOREST, mb: 1.5 }}>Pay with crypto</Typography>

      <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', mb: 1 }}>Asset</Typography>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        {assets.map((a) => (
          <Chip
            key={a.asset}
            label={a.asset}
            onClick={() => { setAsset(a.asset); setNetwork(null) }}
            variant={asset === a.asset ? 'filled' : 'outlined'}
            color={asset === a.asset ? 'primary' : 'default'}
            sx={{ fontWeight: 700 }}
          />
        ))}
      </Box>

      {asset && (
        <>
          <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', mb: 1 }}>Network</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
            {networks.map((n) => (
              <Chip
                key={n.id}
                label={n.label}
                onClick={() => setNetwork(n.id)}
                variant={network === n.id ? 'filled' : 'outlined'}
                color={network === n.id ? 'primary' : 'default'}
                sx={{ fontWeight: 700 }}
              />
            ))}
          </Box>
        </>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {!amountValid && <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 1 }}>Enter an amount above to get a quote.</Typography>}
      {amountValid && !emailValid && <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 1 }}>Enter your email above so we can send a receipt.</Typography>}

      <Button
        onClick={getQuote}
        disabled={busy || !amountValid || !emailValid || !asset || !network}
        variant="contained"
        fullWidth
        startIcon={busy ? <LoadingDots size={6} /> : undefined}
        sx={{ borderRadius: '999px', py: 1.3, fontWeight: 800, textTransform: 'none' }}
      >
        {busy ? 'Getting quote…' : 'Get a quote'}
      </Button>
    </Box>
  )
}

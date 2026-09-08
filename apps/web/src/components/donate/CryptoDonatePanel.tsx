import { useCallback, useEffect, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Skeleton from '@mui/material/Skeleton'
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded'
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded'
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
const GOLD = '#DCC07E'

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
  const [copied, setCopied] = useState<string | null>(null)
  const [assetsLoading, setAssetsLoading] = useState(true)

  useEffect(() => {
    let active = true
    getCryptoAssets()
      .then((r) => {
        if (active && r.enabled) setAssets(r.assets)
      })
      .catch(() => { if (active) setError('Could not load crypto options. Please reload to try again.') })
      .finally(() => { if (active) setAssetsLoading(false) })
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
    if (!asset || !network || !amountValid || !emailValid) return
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
  }, [asset, network, campaignId, amount, amountValid, emailValid])

  const continueToDeposit = useCallback(async () => {
    if (!quote || quoteExpired || quote.fiatAmount !== amount || !amountValid || !emailValid) return
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
  }, [quote, quoteExpired, amount, amountValid, emailValid, campaignId, donorEmail, donorName, message, isAnonymous])

  function reset() {
    setPhase('select')
    setQuote(null)
    setDeposit(null)
    setError(null)
    setCopied(null)
  }

  async function copyValue(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(label)
      setError(null)
    } catch {
      setError('Copy is unavailable. Select and copy the payment details below.')
    }
  }

  const card = { p: { xs: 2, sm: 3 }, borderRadius: SHAPE.card, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', boxShadow: 'var(--neu-subtle)' }
  const primaryButton = { borderRadius: '999px', minHeight: 48, textTransform: 'none' as const, fontWeight: 800 }
  const step = phase === 'select' ? 0 : phase === 'quoted' ? 1 : 2
  const staleQuote = Boolean(quote && quote.fiatAmount !== amount)
  const networkLabel = (id: string) => assets.flatMap((a) => a.networks).find((n) => n.id === id)?.label ?? id

  const progress = (
    <Box component="ol" aria-label="Contribution steps" sx={{ display: 'flex', listStyle: 'none', m: 0, mb: 3, p: 0, gap: 1 }}>
      {['Choose', 'Review', 'Transfer'].map((label, i) => (
        <Box component="li" key={label} aria-current={step === i ? 'step' : undefined} sx={{ flex: 1, borderTop: '3px solid', borderColor: i <= step ? 'primary.main' : 'divider', pt: 1, fontSize: '.75rem', fontWeight: 700, color: i <= step ? 'text.primary' : 'text.secondary' }}>
          {i + 1}. {label}
        </Box>
      ))}
    </Box>
  )

  function summary(value: CryptoQuote | CryptoDepositView) {
    return (
      <Box sx={{ bgcolor: '#1C261D', color: '#F5F2EA', borderRadius: 3, p: { xs: 2, sm: 3 }, mb: 2.5 }}>
        <Typography sx={{ fontSize: '.75rem', color: '#C5CCC2', mb: .5 }}>You send exactly</Typography>
        <Typography sx={{ fontSize: { xs: '1.65rem', sm: '2rem' }, fontWeight: 800, lineHeight: 1.2, overflowWrap: 'anywhere', fontVariantNumeric: 'tabular-nums' }}>
          {value.cryptoAmount} <Box component="span" sx={{ color: GOLD }}>{value.asset}</Box>
        </Typography>
        <Typography sx={{ fontSize: '.8rem', mt: 1, color: '#DCC07E' }}>{networkLabel(value.network)} network</Typography>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mt: 2, pt: 2, borderTop: '1px solid rgba(255,255,255,.16)' }}>
          <ArrowDownwardRoundedIcon sx={{ color: GOLD, fontSize: 20 }} />
          <Box>
            <Typography sx={{ color: '#C5CCC2', fontSize: '.75rem' }}>Campaign receives</Typography>
            <Typography sx={{ fontSize: '1.25rem', fontWeight: 750 }}>{formatCurrency(value.fiatAmount, value.fiatCurrency)}</Typography>
          </Box>
        </Box>
      </Box>
    )
  }

  function paymentDetail(label: string, value: string) {
    return (
      <Box sx={{ mt: 1.5 }}>
        <Typography sx={{ fontSize: '.75rem', fontWeight: 700, mb: .75 }}>{label}</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Typography sx={{ flex: 1, minWidth: 0, fontSize: '.8rem', overflowWrap: 'anywhere', fontFamily: 'monospace', userSelect: 'all' }}>{value}</Typography>
          <IconButton onClick={() => void copyValue(value, label)} aria-label={`Copy ${label.toLowerCase()}`} sx={{ width: 44, height: 44 }}>
            {copied === label ? <CheckCircleRoundedIcon color="success" /> : <ContentCopyRoundedIcon sx={{ fontSize: 20 }} />}
          </IconButton>
        </Box>
      </Box>
    )
  }

  if (phase === 'confirmed') {
    return (
      <Box sx={{ ...card, textAlign: 'center', py: 5 }} role="status">
        <CheckCircleRoundedIcon sx={{ fontSize: 56, color: 'success.main', mb: 2 }} />
        <Typography variant="h5" sx={{ fontWeight: 800 }}>Your contribution is confirmed</Typography>
        <Typography sx={{ color: 'text.secondary', mt: 1, mb: 3 }}>
          {formatCurrency(deposit?.fiatAmount ?? amount, deposit?.fiatCurrency ?? 'GHS')} has been credited to the campaign. Thank you for making a difference.
        </Typography>
        <Button component={RouterLink} to={campaignPath} variant="contained" sx={primaryButton}>Back to campaign</Button>
      </Box>
    )
  }

  if (phase === 'failed') {
    return (
      <Box sx={card}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>Contribution not completed</Typography>
        <Alert severity="warning" sx={{ mb: 2 }}>No contribution has been credited. If you already sent crypto, contact support with your transaction hash before trying again.</Alert>
        {deposit && paymentDetail('Payment reference', deposit.donationIntentId)}
        <Button onClick={reset} variant="outlined" sx={{ ...primaryButton, mt: 2 }}>Start over</Button>
      </Box>
    )
  }

  if (phase === 'deposit' && deposit) {
    const expired = depositSecondsLeft <= 0
    return (
      <Box sx={card}>
        {progress}
        <Typography variant="h6" sx={{ fontWeight: 800, mb: .5 }}>Complete your transfer</Typography>
        <Typography sx={{ color: 'text.secondary', fontSize: '.875rem', mb: 2.5 }}>Open your wallet and use the exact details below.</Typography>
        {summary(deposit)}
        <Alert severity="warning" icon={<WarningAmberRoundedIcon />} sx={{ mb: 2.5 }}>
          <AlertTitle sx={{ fontWeight: 800 }}>Send only {deposit.asset} on {networkLabel(deposit.network)}</AlertTitle>
          Using another asset or network can permanently lose your funds.
        </Alert>
        {expired ? (
          <Alert severity="warning" sx={{ mb: 2 }}>The payment window has closed. Do not send to this address now. If you already sent, keep this page open while we check for confirmation.</Alert>
        ) : (
          <>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, mb: 2 }}>
              <Box sx={{ p: 2, bgcolor: '#fff', borderRadius: 3, border: '1px solid #E0E5DE' }}>
                <QRCodeCanvas value={deposit.walletAddress} size={168} fgColor={FOREST} title="Payment wallet address" />
              </Box>
              <Typography sx={{ fontSize: '.75rem', color: 'text.secondary' }}>Scan the address with your wallet</Typography>
            </Box>
            {paymentDetail('Wallet address', deposit.walletAddress)}
            {deposit.addressTag && paymentDetail('Required memo / tag', deposit.addressTag)}
            {deposit.addressTag && <Typography sx={{ mt: 1, fontSize: '.8rem', color: 'text.secondary' }}>Include this memo / tag in your transfer. The QR code contains the address only.</Typography>}
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: .75, mt: 2 }}>
              <ScheduleRoundedIcon sx={{ fontSize: 16 }} />
              <Typography sx={{ fontSize: '.8rem', fontVariantNumeric: 'tabular-nums' }}>Send within {mmss(depositSecondsLeft)}</Typography>
            </Box>
          </>
        )}
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        <Typography role="status" sx={{ color: 'success.main', fontSize: '.8rem', mt: 1 }}>{copied ? `${copied} copied` : ''}</Typography>
        <Box role="status" sx={{ p: 2, mt: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
          <Typography sx={{ fontWeight: 750, fontSize: '.875rem' }}>Waiting for confirmation</Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: '.8rem', mt: .5 }}>This page checks automatically. Your contribution appears after the transfer is confirmed.</Typography>
        </Box>
      </Box>
    )
  }

  if (phase === 'quoted' && quote) {
    return (
      <Box sx={card}>
        {progress}
        <Typography variant="h6" sx={{ fontWeight: 800, mb: .5 }}>Review your contribution</Typography>
        <Typography sx={{ color: 'text.secondary', fontSize: '.875rem', mb: 2.5 }}>Check the amount and network before getting your payment address.</Typography>
        {summary(quote)}
        <Box sx={{ fontSize: '.8rem', color: 'text.secondary', mb: 2.5 }}>
          <Typography sx={{ fontSize: 'inherit' }}>Exchange rate: 1 {quote.asset} = {formatCurrency(quote.rate, quote.fiatCurrency)}</Typography>
          {quote.providerFeeFiat !== undefined && <Typography sx={{ fontSize: 'inherit', mt: .5 }}>Provider fee: {formatCurrency(quote.providerFeeFiat, quote.fiatCurrency)}</Typography>}
          {quote.networkFeeFiat !== undefined && <Typography sx={{ fontSize: 'inherit', mt: .5 }}>Network fee: {formatCurrency(quote.networkFeeFiat, quote.fiatCurrency)}</Typography>}
        </Box>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {quoteExpired || staleQuote ? (
          <Alert severity="warning" sx={{ mb: 2 }}>{staleQuote ? 'Your contribution amount changed. Get an updated quote.' : 'This quote expired. Refresh it to get the current rate.'}</Alert>
        ) : (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2, color: 'text.secondary' }}>
            <ScheduleRoundedIcon sx={{ fontSize: 18 }} />
            <Typography sx={{ fontSize: '.8rem', fontVariantNumeric: 'tabular-nums' }}>Rate reserved for {mmss(quoteSecondsLeft)}</Typography>
          </Box>
        )}
        {!emailValid && <Alert severity="info" sx={{ mb: 2 }}>Enter a valid email above to continue.</Alert>}
        <Button fullWidth onClick={quoteExpired || staleQuote ? getQuote : continueToDeposit} disabled={busy || !amountValid || !emailValid} variant="contained" startIcon={busy ? <LoadingDots size={6} /> : undefined} sx={primaryButton}>
          {busy ? 'Please wait…' : quoteExpired || staleQuote ? 'Refresh quote' : 'Get payment address'}
        </Button>
        <Button fullWidth onClick={reset} disabled={busy} sx={{ ...primaryButton, mt: .75 }}>Change currency or network</Button>
      </Box>
    )
  }

  return (
    <Box sx={card}>
      {progress}
      <Typography variant="h6" sx={{ fontWeight: 800, mb: .5 }}>Contribute with crypto</Typography>
      <Typography sx={{ color: 'text.secondary', fontSize: '.875rem', mb: 3 }}>Choose what’s in your wallet. You’ll review the exact amount before transferring.</Typography>
      <Typography sx={{ fontSize: '.8rem', fontWeight: 750, mb: 1 }}>Choose your currency</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1, mb: 3 }}>
        {assetsLoading ? [0, 1].map((n) => <Skeleton key={n} variant="rounded" height={76} />) : assets.map((a) => (
          <Button key={a.asset} aria-pressed={asset === a.asset} onClick={() => { setAsset(a.asset); setNetwork(null) }} sx={{ textTransform: 'none', p: 1.5, minWidth: 0, justifyContent: 'space-between', border: '1px solid', borderColor: asset === a.asset ? 'primary.main' : 'divider', bgcolor: asset === a.asset ? 'action.selected' : 'transparent', borderRadius: 2, textAlign: 'left' }}>
            <Box sx={{ minWidth: 0 }}><Typography sx={{ fontWeight: 800 }}>{a.asset}</Typography><Typography sx={{ fontSize: '.7rem', color: 'text.secondary', overflowWrap: 'anywhere' }}>{a.label}</Typography></Box>
            {asset === a.asset && <CheckCircleRoundedIcon sx={{ fontSize: 18, ml: .5 }} />}
          </Button>
        ))}
      </Box>
      {!assetsLoading && !assets.length && !error && <Alert severity="info" sx={{ mb: 2 }}>Crypto is currently unavailable. Choose Card / Mobile Money to contribute.</Alert>}
      {asset && <>
        <Typography sx={{ fontSize: '.8rem', fontWeight: 750, mb: .5 }}>Choose the network</Typography>
        <Typography sx={{ fontSize: '.8rem', color: 'text.secondary', mb: 1.5 }}>Match the network you’ll use in your wallet.</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>{networks.map((n) => (
          <Button key={n.id} aria-pressed={network === n.id} onClick={() => setNetwork(n.id)} variant={network === n.id ? 'contained' : 'outlined'} sx={{ ...primaryButton, px: 2, minHeight: 44 }}>{n.label}</Button>
        ))}</Box>
      </>}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {!amountValid && <Typography sx={{ fontSize: '.8rem', color: 'text.secondary', mb: 1.5 }}>Enter a contribution amount above to continue.</Typography>}
      {amountValid && !emailValid && <Typography sx={{ fontSize: '.8rem', color: 'text.secondary', mb: 1.5 }}>Enter your email above for your receipt.</Typography>}
      <Button onClick={getQuote} disabled={busy || !amountValid || !emailValid || !asset || !network} variant="contained" fullWidth startIcon={busy ? <LoadingDots size={6} /> : undefined} sx={primaryButton}>{busy ? 'Getting quote…' : 'Review quote'}</Button>
    </Box>
  )
}

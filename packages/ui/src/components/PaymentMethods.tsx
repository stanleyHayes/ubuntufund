import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import { keyframes } from '@mui/material/styles'
import { SHAPE } from '../theme'

// ─── Animations ─────────────────────────────────────────────────────────────

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
`

// ─── Payment Provider Data ──────────────────────────────────────────────────

interface PaymentProvider {
  name: string
  shortName?: string
  category: 'mobile_money' | 'card' | 'bank' | 'crypto' | 'wallet'
  iconPaths: string[]
  iconColor: string
  bgColor: string
  regions?: string[]
}

const PAYMENT_PROVIDERS: PaymentProvider[] = [
  {
    name: 'MTN Mobile Money',
    shortName: 'MTN MoMo',
    category: 'mobile_money',
    iconPaths: ['M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-4-8l3-3v2h4v2h-4v2l-3-3z'],
    iconColor: '#2E3D2F',
    bgColor: '#F2EFEA',
  },
  {
    name: 'Telecel Cash',
    category: 'mobile_money',
    iconPaths: ['M15.5 1h-8A2.5 2.5 0 005 3.5v17A2.5 2.5 0 007.5 23h8a2.5 2.5 0 002.5-2.5v-17A2.5 2.5 0 0015.5 1zm-4 21c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4.5-4H7V4h9v14z'],
    iconColor: '#2E3D2F',
    bgColor: '#F2EFEA',
  },
  {
    name: 'AT Money',
    category: 'mobile_money',
    iconPaths: ['M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z', 'M12 6a6 6 0 100 12 6 6 0 000-12z'],
    iconColor: '#2E3D2F',
    bgColor: '#F2EFEA',
  },
  {
    name: 'Visa',
    category: 'card',
    iconPaths: ['M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm1 6h14v2H5v-2zm0 4h6v1H5v-1z'],
    iconColor: '#2E3D2F',
    bgColor: '#F2EFEA',
  },
  {
    name: 'Mastercard',
    category: 'card',
    iconPaths: ['M15 9a6 6 0 11-6 0 6 6 0 010-12 6 6 0 016 12z', 'M9 9a6 6 0 116 0'],
    iconColor: '#2E3D2F',
    bgColor: '#F2EFEA',
  },
  {
    name: 'Bank Transfer',
    shortName: 'Bank',
    category: 'bank',
    iconPaths: ['M4 10h3v7H4v-7zm6.5 0h3v7h-3v-7zM2 19h20v3H2v-3zm15-9h3v7h-3v-7zm-5-9L2 6v2h20V6L12 1z'],
    iconColor: '#2E3D2F',
    bgColor: '#F2EFEA',
  },
  {
    name: 'UbuntuFund Wallet',
    shortName: 'Wallet',
    category: 'wallet',
    iconPaths: [
      'M21 7H3a1 1 0 00-1 1v10a1 1 0 001 1h18a1 1 0 001-1V8a1 1 0 00-1-1zM4 5h16a1 1 0 011 1H3a1 1 0 011-1zm14 10a2 2 0 110-4 2 2 0 010 4z',
    ],
    iconColor: '#2E3D2F',
    bgColor: '#E9EFE6',
  },
]

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  mobile_money: { label: 'Mobile Money', color: '#5E8F72' },
  card: { label: 'Cards', color: '#2E3D2F' },
  bank: { label: 'Bank', color: '#A07E33' },
  crypto: { label: 'Crypto', color: '#8B6F4E' },
  wallet: { label: 'UbuntuFund', color: '#C7A24A' },
}

const CATEGORY_ORDER = ['mobile_money', 'card', 'bank', 'crypto', 'wallet'] as const

// ─── Slug to icon mapping ───────────────────────────────────────────────────

function normalizeSlug(slug: string): string {
  return slug.toLowerCase().replace(/[_\s-]+/g, '-')
}

function getProviderBySlug(slug: string): PaymentProvider | undefined {
  const normalized = normalizeSlug(slug)

  const slugMap: Record<string, string> = {
    'mtn-mobile-money': 'MTN Mobile Money',
    'mtn-momo': 'MTN Mobile Money',
    'mtn': 'MTN Mobile Money',
    'momo': 'MTN Mobile Money',
    'telecel-cash': 'Telecel Cash',
    'telecel': 'Telecel Cash',
    'at-money': 'AT Money',
    'airteltigo': 'AT Money',
    'at': 'AT Money',
    'visa': 'Visa',
    'mastercard': 'Mastercard',
    'bank-transfer': 'Bank Transfer',
    'bank': 'Bank Transfer',
    'ubuntufund-wallet': 'UbuntuFund Wallet',
    'ubuntu-fund-wallet': 'UbuntuFund Wallet',
    'wallet': 'UbuntuFund Wallet',
  }

  const name = slugMap[normalized]
  if (!name) return undefined
  return PAYMENT_PROVIDERS.find((p) => p.name === name)
}

// ─── Exported types ─────────────────────────────────────────────────────────

export interface PaymentMethodData {
  id: string
  name: string
  slug: string
  type: 'mobile_money' | 'card' | 'bank' | 'crypto' | 'wallet'
  shortName?: string
}

export interface PaymentMethodsProps {
  showCategories?: boolean
  compact?: boolean
  categories?: Array<'mobile_money' | 'card' | 'bank' | 'crypto' | 'wallet'>
  title?: string
  providers?: PaymentMethodData[]
  onSelect?: (provider: PaymentMethodData) => void
  selectedSlug?: string
}

// ─── Provider Card ──────────────────────────────────────────────────────────

interface ProviderCardProps {
  provider: PaymentProvider
  index: number
  onSelect?: (provider: PaymentMethodData) => void
  selected?: boolean
  methodData?: PaymentMethodData
}

function ProviderCard({ provider, index, onSelect, selected, methodData }: ProviderCardProps) {
  const tooltipContent = provider.regions
    ? `${provider.name} — Available in ${provider.regions.join(', ')}`
    : provider.name

  const clickable = !!onSelect && !!methodData
  const isWallet = provider.category === 'wallet'

  return (
    <Tooltip title={tooltipContent} arrow>
      <Box
        onClick={clickable ? () => onSelect(methodData) : undefined}
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : undefined}
        onKeyDown={
          clickable
            ? (e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') onSelect(methodData)
              }
            : undefined
        }
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0.75,
          p: 1.25,
          borderRadius: SHAPE.sm,
          cursor: clickable ? 'pointer' : 'default',
          width: 80,
          animation: `${fadeIn} 0.4s ease ${index * 0.04}s both`,
          transition: 'background-color 0.15s ease',
          position: 'relative',
          ...(clickable && {
            '&:hover': { bgcolor: 'rgba(46, 61, 47, 0.05)' },
            '&:focus-visible': { outline: '2px solid #C7A24A', outlineOffset: 2 },
          }),
        }}
      >
        {selected && (
          <Box
            sx={{
              position: 'absolute',
              top: 4,
              right: 8,
              width: 16,
              height: 16,
              borderRadius: '50%',
              bgcolor: '#C7A24A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1,
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="#221B0E" />
            </svg>
          </Box>
        )}

        {isWallet ? (
          /* The UbuntuFund wallet tile carries the brand mark itself. */
          <Box
            className="provider-icon"
            sx={{
              width: 48,
              height: 48,
              borderRadius: SHAPE.sm,
              bgcolor: '#2E3D2F',
              border: '1.5px solid',
              borderColor: selected ? '#C7A24A' : 'rgba(199, 162, 74, 0.55)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: '"TT Squares", sans-serif',
              fontWeight: 900,
              fontSize: '0.85rem',
              color: '#C7A24A',
              transition: 'border-color 0.15s ease',
            }}
          >
            UF
          </Box>
        ) : (
          <Box
            className="provider-icon"
            sx={{
              width: 48,
              height: 48,
              borderRadius: SHAPE.sm,
              bgcolor: '#F2EFEA',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1.5px solid',
              borderColor: selected ? '#C7A24A' : '#E7E3D8',
              transition: 'border-color 0.15s ease',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              {provider.iconPaths.map((d, i) => (
                <path key={i} d={d} fill="#2E3D2F" fillOpacity={0.85} />
              ))}
            </svg>
          </Box>
        )}

        <Typography
          sx={{
            fontSize: '0.68rem',
            fontWeight: selected ? 700 : 600,
            color: selected ? '#A07E33' : 'text.secondary',
            textAlign: 'center',
            lineHeight: 1.2,
          }}
        >
          {provider.shortName ?? provider.name}
        </Typography>
      </Box>
    </Tooltip>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function PaymentMethods({
  showCategories = true,
  compact = false,
  categories,
  title,
  providers,
  onSelect,
  selectedSlug,
}: PaymentMethodsProps) {
  const filteredCategories = categories || CATEGORY_ORDER

  let displayProviders: PaymentProvider[] = []
  let providerMethodMap = new Map<string, PaymentMethodData>()

  if (providers && providers.length > 0) {
    for (const method of providers) {
      const matched = getProviderBySlug(method.slug)
      if (matched && filteredCategories.includes(matched.category)) {
        displayProviders.push(matched)
        providerMethodMap.set(matched.name, method)
      }
    }
  } else {
    displayProviders = PAYMENT_PROVIDERS.filter((p) =>
      filteredCategories.includes(p.category),
    )
  }

  if (compact) {
    return (
      <Box>
        {title && (
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              color: 'text.secondary',
              textTransform: 'uppercase',
              letterSpacing: 1,
              mb: 1.5,
              display: 'block',
            }}
          >
            {title}
          </Typography>
        )}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, justifyContent: 'center' }}>
          {displayProviders.map((p, i) => (
            <ProviderCard
              key={p.name}
              provider={p}
              index={i}
              onSelect={onSelect}
              selected={selectedSlug ? normalizeSlug(selectedSlug) === normalizeSlug(providerMethodMap.get(p.name)?.slug ?? '') : false}
              methodData={providerMethodMap.get(p.name)}
            />
          ))}
        </Box>
      </Box>
    )
  }

  // Grouped mode
  const grouped = filteredCategories
    .map((cat) => ({
      category: cat,
      meta: CATEGORY_META[cat],
      providers: displayProviders.filter((p) => p.category === cat),
    }))
    .filter((g) => g.providers.length > 0)

  let globalIndex = 0

  return (
    <Box>
      {title && (
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography variant="h5" sx={{ fontWeight: 900, mb: 0.5 }}>
            {title}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Pay the way that works for you — MTN MoMo, Telecel Cash, AT Money, cards, or bank transfer
          </Typography>
        </Box>
      )}

      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          justifyContent: 'center',
        }}
      >
        {grouped.map((group) => (
          <Box
            key={group.category}
            sx={{
              flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 8px)', md: '0 1 auto' },
              minWidth: { xs: 'auto', md: 160 },
              borderRadius: SHAPE.card,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              overflow: 'hidden',
              transition: 'border-color 0.2s',
              '&:hover': {
                borderColor: group.meta.color,
              },
            }}
          >
            {/* Category header strip */}
            {showCategories && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 2,
                  py: 1,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  backgroundColor: `${group.meta.color}10`,
                }}
              >
                <Box sx={{ width: 8, height: 8, borderRadius: '2px', transform: 'rotate(45deg)', bgcolor: group.meta.color }} />
                <Typography
                  sx={{
                    fontSize: '0.66rem',
                    fontWeight: 700,
                    color: group.meta.color,
                    textTransform: 'uppercase',
                    letterSpacing: '0.16em',
                  }}
                >
                  {group.meta.label}
                </Typography>
              </Box>
            )}

            {/* Provider grid */}
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                p: 1,
                gap: 0,
              }}
            >
              {group.providers.map((p) => {
                const idx = globalIndex++
                return (
                  <ProviderCard
                    key={p.name}
                    provider={p}
                    index={idx}
                    onSelect={onSelect}
                    selected={selectedSlug ? normalizeSlug(selectedSlug) === normalizeSlug(providerMethodMap.get(p.name)?.slug ?? '') : false}
                    methodData={providerMethodMap.get(p.name)}
                  />
                )
              })}
            </Box>
          </Box>
        ))}
      </Box>

      {/* Trust footer */}
      <Box
        sx={{
          mt: 3,
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0.75,
        }}
      >
        <Box
          sx={{
            width: 28,
            height: 2,
            borderRadius: SHAPE.bar,
            backgroundColor: 'rgba(46, 61, 47,0.4)',
          }}
        />
        <Typography
          variant="caption"
          sx={{
            color: '#2E3D2F',
            fontSize: '0.7rem',
            fontWeight: 600,
          }}
        >
          All transactions are encrypted and secured
        </Typography>
        <Box
          sx={{
            width: 28,
            height: 2,
            borderRadius: SHAPE.bar,
            backgroundColor: 'rgba(46, 61, 47,0.4)',
          }}
        />
      </Box>
    </Box>
  )
}

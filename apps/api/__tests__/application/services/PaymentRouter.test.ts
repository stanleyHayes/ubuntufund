import { describe, it, expect } from 'vitest'
import { PaymentRouter } from '../../../src/application/services/PaymentRouter.js'
import type {
  PaymentGatewayPort,
  ProviderCapabilities,
} from '../../../src/domain/ports/outbound/PaymentGatewayPort.js'
import type { PaymentsConfig } from '../../../src/infrastructure/config/index.js'

// A gateway that only implements the two methods routing reads; every other
// port method throws so a test fails loudly if routing ever calls them.
function fakeGateway(caps: ProviderCapabilities, configured = true): PaymentGatewayPort {
  const notRouting = () => {
    throw new Error('routing must not call provider I/O')
  }
  return {
    isConfigured: () => configured,
    capabilities: () => caps,
    initializeTransaction: notRouting,
    initializeCharge: notRouting,
    verifyTransaction: notRouting,
    verifyWebhookSignature: () => false,
    listBanks: notRouting,
    createTransferRecipient: notRouting,
    initiateTransfer: notRouting,
    verifyTransfer: notRouting,
    getBalance: notRouting,
  } as unknown as PaymentGatewayPort
}

const paystackCaps: ProviderCapabilities = {
  provider: 'paystack',
  countries: ['*'],
  currencies: ['GHS', 'USD', 'GBP', 'EUR', 'CAD'],
  methods: ['mobile_money', 'card', 'bank'],
  supportsInternationalCards: true,
}

const flutterwaveCaps: ProviderCapabilities = {
  provider: 'flutterwave',
  countries: ['*'],
  currencies: ['GHS', 'USD', 'GBP', 'EUR'],
  methods: ['card', 'bank'],
  supportsInternationalCards: true,
}

function config(overrides: Partial<PaymentsConfig> = {}): PaymentsConfig {
  return {
    paystackEnabled: true,
    flutterwaveEnabled: false,
    internationalCardsEnabled: false,
    multiCurrencyEnabled: false,
    defaultProvider: 'paystack',
    reconciliationEnabled: true,
    supportedCurrencies: ['GHS', 'USD', 'GBP', 'EUR', 'CAD'],
    fxSource: 'provider',
    ...overrides,
  }
}

function router(cfg: PaymentsConfig, opts: { flutterwave?: boolean; paystackConfigured?: boolean } = {}) {
  const gateways = new Map<string, PaymentGatewayPort>()
  gateways.set('paystack', fakeGateway(paystackCaps, opts.paystackConfigured ?? true))
  if (opts.flutterwave) gateways.set('flutterwave', fakeGateway(flutterwaveCaps))
  return new PaymentRouter(gateways, cfg)
}

describe('PaymentRouter (spec §7 routing rules)', () => {
  it('Ghana + Mobile Money → Paystack (the preserved path)', () => {
    const r = router(config()).route({ currency: 'GHS', method: 'mobile_money', country: 'GH' })
    expect(r.provider).toBe('paystack')
  })

  it('Ghana + Card → Paystack', () => {
    const r = router(config()).route({ currency: 'GHS', method: 'card', country: 'GH' })
    expect(r.provider).toBe('paystack')
  })

  it('rejects a non-GHS contribution when multi-currency is disabled', () => {
    expect(() => router(config()).route({ currency: 'USD', method: 'card', country: 'US' })).toThrow(
      /USD.*not enabled/
    )
  })

  it('rejects a diaspora card when international cards are disabled', () => {
    // GHS currency but a non-GH country is still an international card.
    expect(() =>
      router(config()).route({ currency: 'GHS', method: 'card', country: 'US' })
    ).toThrow(/International card contributions are not enabled/)
  })

  it('Diaspora + Card → Paystack international when both flags are on', () => {
    const cfg = config({ multiCurrencyEnabled: true, internationalCardsEnabled: true })
    const r = router(cfg).route({ currency: 'USD', method: 'card', country: 'US' })
    expect(r.provider).toBe('paystack')
  })

  it('honors an eligible provider preference over the default', () => {
    const cfg = config({
      multiCurrencyEnabled: true,
      internationalCardsEnabled: true,
      flutterwaveEnabled: true,
    })
    const r = router(cfg, { flutterwave: true }).route({
      currency: 'USD',
      method: 'card',
      country: 'GB',
      providerPreference: 'flutterwave',
    })
    expect(r.provider).toBe('flutterwave')
  })

  it('falls back to the default provider when the preference is ineligible', () => {
    // Flutterwave has no mobile_money capability, so a MoMo request must not pick it.
    const cfg = config({ flutterwaveEnabled: true })
    const r = router(cfg, { flutterwave: true }).route({
      currency: 'GHS',
      method: 'mobile_money',
      country: 'GH',
      providerPreference: 'flutterwave',
    })
    expect(r.provider).toBe('paystack')
  })

  it('never selects a disabled provider even when it is capable', () => {
    const cfg = config({ multiCurrencyEnabled: true, internationalCardsEnabled: true }) // flutterwave OFF
    const r = router(cfg, { flutterwave: true }).route({ currency: 'EUR', method: 'card', country: 'FR' })
    expect(r.provider).toBe('paystack')
  })

  it('never selects an unconfigured provider', () => {
    expect(() =>
      router(config(), { paystackConfigured: false }).route({
        currency: 'GHS',
        method: 'mobile_money',
        country: 'GH',
      })
    ).toThrow(/No payment provider/)
  })

  it('throws when no rail supports the requested method/currency', () => {
    const cfg = config({ multiCurrencyEnabled: true, internationalCardsEnabled: true, flutterwaveEnabled: true })
    // Flutterwave-only registry, mobile_money not supported by it.
    const gateways = new Map<string, PaymentGatewayPort>([['flutterwave', fakeGateway(flutterwaveCaps)]])
    const r = new PaymentRouter(gateways, cfg)
    expect(() => r.route({ currency: 'USD', method: 'mobile_money', country: 'US' })).toThrow(
      /No payment provider/
    )
  })

  it('availableProviders lists only enabled + configured rails', () => {
    const cfg = config({ flutterwaveEnabled: true })
    expect(router(cfg, { flutterwave: true }).availableProviders().sort()).toEqual([
      'flutterwave',
      'paystack',
    ])
    expect(router(config(), { flutterwave: true }).availableProviders()).toEqual(['paystack'])
  })
})

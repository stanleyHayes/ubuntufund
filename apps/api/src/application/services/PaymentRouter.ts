import type {
  PaymentGatewayPort,
  PaymentMethodKind,
} from '../../domain/ports/outbound/PaymentGatewayPort.js';
import type { PaymentsConfig } from '../../infrastructure/config/index.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

export interface RouteRequest {
  /** ISO-4217 currency the contributor authorizes in. */
  currency: string;
  /** How the contributor intends to pay. */
  method: PaymentMethodKind;
  /** ISO-3166 alpha-2 contributor country, when safely known. */
  country?: string;
  /** Explicit provider the caller asked for (honored only if eligible). */
  providerPreference?: string;
}

export interface RouteResult {
  provider: string;
  gateway: PaymentGatewayPort;
}

/** Home country / currency — anything else is treated as diaspora/international. */
const HOME_COUNTRY = 'GH';
const HOME_CURRENCY = 'GHS';

/**
 * Chooses a payment provider for a contribution from the registered gateways'
 * {@link PaymentGatewayPort.capabilities}, the routing rules (spec §7) and the
 * payments feature flags — so the campaign domain never names a provider.
 *
 * It only *selects a rail*; it never resubmits a charge to another provider
 * after an ambiguous/declined attempt (spec §7 — no silent double-charge). That
 * is the attempt/reconciliation layer's concern.
 */
export class PaymentRouter {
  constructor(
    private readonly gateways: Map<string, PaymentGatewayPort>,
    private readonly config: PaymentsConfig
  ) {}

  /** Provider keys that are flag-enabled AND configured, in preference order. */
  availableProviders(): string[] {
    return this.orderedProviders().filter((p) => this.isProviderUsable(p));
  }

  /**
   * Pick the best eligible gateway, or throw a clear error when none can serve
   * the request (unconfigured rail, disabled flag, unsupported currency/method).
   */
  route(req: RouteRequest): RouteResult {
    const currency = req.currency.toUpperCase();
    const country = req.country?.toUpperCase();
    const international = this.isInternational(currency, country);

    // Guard the policy flags up-front with actionable messages.
    if (currency !== HOME_CURRENCY && !this.config.multiCurrencyEnabled) {
      throw new AppError(`Contributions in ${currency} are not enabled`, 400);
    }
    if (req.method === 'card' && international && !this.config.internationalCardsEnabled) {
      throw new AppError('International card contributions are not enabled', 400);
    }

    const preference = req.providerPreference?.toLowerCase();
    const candidates = this.orderedProviders(preference).filter((provider) =>
      this.isEligible(provider, currency, req.method, country, international)
    );

    const chosen = candidates[0];
    if (!chosen) {
      throw new AppError(
        `No payment provider can accept a ${req.method} contribution in ${currency}`,
        400
      );
    }
    return { provider: chosen, gateway: this.gateways.get(chosen)! };
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private isInternational(currency: string, country?: string): boolean {
    return (country !== undefined && country !== HOME_COUNTRY) || currency !== HOME_CURRENCY;
  }

  /** Provider keys ordered by: explicit preference, default provider, then rest. */
  private orderedProviders(preference?: string): string[] {
    const keys = [...this.gateways.keys()];
    const rank = (p: string): number => {
      if (preference && p === preference) return 0;
      if (p === this.config.defaultProvider) return 1;
      return 2;
    };
    return keys.sort((a, b) => rank(a) - rank(b));
  }

  private isProviderUsable(provider: string): boolean {
    const gateway = this.gateways.get(provider);
    if (!gateway || !gateway.isConfigured()) return false;
    if (provider === 'paystack') return this.config.paystackEnabled;
    if (provider === 'flutterwave') return this.config.flutterwaveEnabled;
    // An unknown/future provider is usable once it's configured; add a flag when
    // one is introduced.
    return true;
  }

  private isEligible(
    provider: string,
    currency: string,
    method: PaymentMethodKind,
    country: string | undefined,
    international: boolean
  ): boolean {
    if (!this.isProviderUsable(provider)) return false;

    const cap = this.gateways.get(provider)!.capabilities();
    if (!cap.methods.includes(method)) return false;
    if (!(cap.currencies.includes('*') || cap.currencies.includes(currency))) return false;
    if (country && !(cap.countries.includes('*') || cap.countries.includes(country))) return false;
    if (method === 'card' && international && !cap.supportsInternationalCards) return false;

    return true;
  }
}

import { payoutInstitutionName } from '@ubuntu-fund/types'
import type { Bank } from '@ubuntu-fund/types'
import type { PaymentGatewayPort } from '../../domain/ports/outbound/PaymentGatewayPort.js'

/** The platform's only settlement currency. */
const DEFAULT_CURRENCY = 'GHS'

/**
 * List the banks (or, with `type: 'mobile_money'`, the telcos) a payout
 * recipient can be registered against. Delegates to the payment gateway, which
 * returns 501 when payouts are unconfigured.
 */
export class ListBanksUseCase {
  constructor(private readonly paymentGateway: PaymentGatewayPort) {}

  async execute(currency?: string, type?: string): Promise<Bank[]> {
    const banks = await this.paymentGateway.listBanks(currency ?? DEFAULT_CURRENCY, type)
    return banks
      .filter((b) => b.active !== false && b.name.trim().toLowerCase() !== 'bank of ghana')
      .map((b) => ({
        name: payoutInstitutionName(b.name, b.code),
        code: b.code,
        currency: b.currency,
        type: b.type,
        active: b.active,
      }))
  }
}

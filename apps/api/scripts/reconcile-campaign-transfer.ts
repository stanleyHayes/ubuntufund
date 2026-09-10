/** Read-only unless --apply is passed. Verifies provider details before existing idempotent settlement. */
import mongoose from 'mongoose'
import { PaystackGateway } from '../src/infrastructure/adapters/outbound/payments/PaystackGateway.js'
import { MongoPayoutRepository } from '../src/infrastructure/adapters/outbound/persistence/MongoPayoutRepository.js'
import { MongoCampaignBalanceRepository } from '../src/infrastructure/adapters/outbound/persistence/MongoCampaignBalanceRepository.js'
import { MongoLedgerRepository } from '../src/infrastructure/adapters/outbound/persistence/MongoLedgerRepository.js'
import { HandlePayoutWebhookUseCase } from '../src/application/use-cases/HandlePayoutWebhookUseCase.js'
import { PayoutTransferControlUseCase } from '../src/application/use-cases/PayoutTransferControlUseCase.js'
async function main() {
  const id = process.argv.find((a) => /^[0-9a-f]{24}$/.test(a))
  if (!id) throw new Error('Supply the payout ID')
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI required')
  await mongoose.connect(uri)
  try {
    const repo = new MongoPayoutRepository()
    const payout = await repo.findById(id)
    if (!payout?.providerRef || payout.isBatched || payout.provider !== 'paystack')
      throw new Error('Not a single Paystack payout')
    const gateway = new PaystackGateway({
      secretKey: process.env.PAYSTACK_SECRET_KEY ?? '',
      publicKey: '',
      publicWebUrl: 'https://app.ujimora.com',
    })
    const provider = await gateway.verifyTransfer(payout.providerRef)
    if (
      provider.reference !== payout.providerRef ||
      Number(provider.raw?.amount) !== Math.round(payout.netAmount * 100) ||
      provider.raw?.currency !== payout.currency
    )
      throw new Error('Provider details mismatch')
    console.log({
      id,
      localStatus: payout.status,
      providerStatus: provider.status,
      amount: payout.netAmount,
      apply: process.argv.includes('--apply'),
    })
    if (process.argv.includes('--apply')) {
      const handler = new HandlePayoutWebhookUseCase(
        repo,
        new MongoCampaignBalanceRepository(),
        new MongoLedgerRepository(),
      )
      const result = await new PayoutTransferControlUseCase(repo, gateway, handler).execute(
        id,
        'refresh',
      )
      console.log({ id: result.id, status: result.status, providerStatus: result.providerStatus })
    }
  } finally {
    await mongoose.disconnect()
  }
}
void main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})

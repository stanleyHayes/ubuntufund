import { it, expect, vi } from 'vitest'
import { PayoutEntity } from '../../../src/domain/entities/Payout.js'
import { PayoutTransferControlUseCase } from '../../../src/application/use-cases/PayoutTransferControlUseCase.js'
function setup(status = 'otp') {
  let local = 'PROCESSING'
  const properties = {
    id: 'p',
    campaignId: 'c',
    recipientId: 'r',
    amount: 100,
    netAmount: 95,
    fee: 5,
    currency: 'GHS',
    type: 'standard',
    provider: 'paystack',
    providerRef: 'ref',
    requestedBy: 'u',
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  const repo = {
    findById: vi.fn(async () => new PayoutEntity({ ...properties, status: local } as never)),
    setProviderStatus: vi.fn(),
  }
  const provider = {
    verifyTransfer: vi.fn(async () => ({
      reference: 'ref',
      transferCode: 'TRF_x',
      status,
      raw: { amount: 9500, currency: 'GHS' },
    })),
    finalizeTransfer: vi.fn(async () => {
      status = 'success'
    }),
    resendTransferOtp: vi.fn(),
  }
  const handler = {
    handleSuccess: vi.fn(async () => {
      local = 'PAID'
    }),
    handleFailed: vi.fn(async () => {
      local = 'FAILED'
    }),
    handleReversed: vi.fn(),
    repairSettlement: vi.fn(),
  }
  return {
    service: new PayoutTransferControlUseCase(repo as never, provider as never, handler as never),
    repo,
    provider,
    handler,
  }
}
it('authorizes the existing transfer then verifies and settles success', async () => {
  const t = setup()
  const p = await t.service.execute('p', 'authorize', '123456')
  expect(t.provider.finalizeTransfer).toHaveBeenCalledWith('TRF_x', '123456')
  expect(p.status).toBe('PAID')
  expect(t.handler.handleSuccess).toHaveBeenCalledWith('ref')
})
it.each(['abandoned', 'blocked', 'rejected'])(
  'reconciles %s without initiating a replacement',
  async (status) => {
    const t = setup(status)
    expect((await t.service.execute('p', 'refresh')).status).toBe('FAILED')
    expect(t.handler.handleFailed).toHaveBeenCalledWith('ref')
    expect(t.provider.finalizeTransfer).not.toHaveBeenCalled()
  },
)
it('leaves OTP pending on refresh and only resends for the existing code', async () => {
  const t = setup()
  expect((await t.service.execute('p', 'resend')).status).toBe('PROCESSING')
  expect(t.provider.resendTransferOtp).toHaveBeenCalledWith('TRF_x')
  expect(t.handler.handleFailed).not.toHaveBeenCalled()
})
it('rejects a mismatched provider amount before any settlement', async () => {
  const t = setup('success')
  t.provider.verifyTransfer.mockResolvedValue({
    reference: 'ref',
    transferCode: 'TRF_x',
    status: 'success',
    raw: { amount: 999, currency: 'GHS' },
  })
  await expect(t.service.execute('p', 'refresh')).rejects.toThrow('do not match')
  expect(t.handler.handleSuccess).not.toHaveBeenCalled()
})
it('will not authorize a completed transfer again', async () => {
  const t = setup('success')
  await expect(t.service.execute('p', 'authorize', '123456')).rejects.toThrow('no longer')
  expect(t.provider.finalizeTransfer).not.toHaveBeenCalled()
})

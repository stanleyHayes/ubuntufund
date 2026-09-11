import { describe, expect, it, vi } from 'vitest'
import { UpdateAffiliateReferralCodeUseCase } from '../../../src/application/use-cases/UpdateAffiliateReferralCodeUseCase.js'
import { validateReferralCode } from '@ubuntu-fund/types'

const affiliate = { id: 'aff-1', userId: 'user-1', referralCode: 'a1b2c3' }

function makeRepo(overrides: Record<string, unknown> = {}) {
  return {
    findByUserId: vi.fn(async () => affiliate),
    referralCodeExists: vi.fn(async () => false),
    updateReferralCode: vi.fn(async (_id: string, code: string) => ({
      ...affiliate,
      referralCode: code,
    })),
    ...overrides,
  } as never
}

describe('UpdateAffiliateReferralCodeUseCase', () => {
  it('stores a chosen code normalised to lower case', async () => {
    const repo = makeRepo()
    const uc = new UpdateAffiliateReferralCodeUseCase(repo)

    const result = await uc.execute('user-1', '  Ama-Fundraising  ')

    expect(result.referralCode).toBe('ama-fundraising')
    expect(
      (repo as unknown as { updateReferralCode: ReturnType<typeof vi.fn> }).updateReferralCode,
    ).toHaveBeenCalledWith('aff-1', 'ama-fundraising')
  })

  it('rejects a code someone else already holds', async () => {
    const repo = makeRepo({ referralCodeExists: vi.fn(async () => true) })
    const uc = new UpdateAffiliateReferralCodeUseCase(repo)

    await expect(uc.execute('user-1', 'taken-code')).rejects.toMatchObject({ statusCode: 409 })
  })

  it('rejects a code lost to a concurrent claim, even though it looked free', async () => {
    // The availability read and the write are not atomic: two affiliates can
    // both see a code as free. The unique index decides, and the repository
    // reports that as null rather than throwing a raw driver error.
    const repo = makeRepo({ updateReferralCode: vi.fn(async () => null) })
    const uc = new UpdateAffiliateReferralCodeUseCase(repo)

    await expect(uc.execute('user-1', 'contested')).rejects.toMatchObject({ statusCode: 409 })
  })

  it('rejects reserved and malformed codes without touching the repository', async () => {
    const repo = makeRepo()
    const uc = new UpdateAffiliateReferralCodeUseCase(repo)

    for (const bad of ['ujimora', 'support', 'ab', '-leading', 'trailing-', 'double--hyphen', 'has space']) {
      await expect(uc.execute('user-1', bad)).rejects.toMatchObject({ statusCode: 422 })
    }
    expect(
      (repo as unknown as { updateReferralCode: ReturnType<typeof vi.fn> }).updateReferralCode,
    ).not.toHaveBeenCalled()
  })

  it('treats re-submitting the current code as a no-op, not a conflict', async () => {
    // The uniqueness check would otherwise match the affiliate's own record and
    // report their existing code as taken.
    const repo = makeRepo({ referralCodeExists: vi.fn(async () => true) })
    const uc = new UpdateAffiliateReferralCodeUseCase(repo)

    const result = await uc.execute('user-1', 'A1B2C3')

    expect(result.referralCode).toBe('a1b2c3')
    expect(
      (repo as unknown as { updateReferralCode: ReturnType<typeof vi.fn> }).updateReferralCode,
    ).not.toHaveBeenCalled()
  })

  it('requires affiliate enrollment first', async () => {
    const repo = makeRepo({ findByUserId: vi.fn(async () => null) })
    const uc = new UpdateAffiliateReferralCodeUseCase(repo)

    await expect(uc.execute('user-1', 'valid-code')).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('validateReferralCode', () => {
  it('accepts the shapes affiliates actually want', () => {
    for (const good of ['ama', 'kwame-fundraising', 'gh2026', 'a-b-c']) {
      expect(validateReferralCode(good)).toBeNull()
    }
  })

  it('is case-insensitive, matching the lowercase unique index', () => {
    expect(validateReferralCode('AMA-Fundraising')).toBeNull()
  })
})

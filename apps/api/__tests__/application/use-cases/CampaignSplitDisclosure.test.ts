import { describe, expect, it, vi } from 'vitest';
import { CampaignSplitUseCase } from '../../../src/application/use-cases/CampaignSplitUseCase.js';
import { CampaignSplitVersionEntity } from '../../../src/domain/entities/CampaignSplitVersion.js';

/**
 * The donor-facing split disclosure must follow the same switch as the money
 * routing: with SPLIT_PROCEEDS_ENABLED off, SplitAccrualService.accrue splits
 * nothing, so a split activated earlier must not still be shown to donors.
 */
function useCase(splitEnabled: boolean, status = 'active') {
  const active = new CampaignSplitVersionEntity({
    id: 'split-1', campaignId: 'campaign-1', version: 1, status: 'active', locked: true,
    allocations: [
      { beneficiaryId: 'ama', name: 'Ama', shareBps: 6000, consent: 'accepted' },
      { beneficiaryId: 'kofi', name: 'Kofi', shareBps: 4000, consent: 'accepted' },
    ],
    createdBy: 'owner-1', createdAt: new Date(), updatedAt: new Date(),
  } as never);
  const campaignRepo = { findById: vi.fn(async () => ({ id: 'campaign-1', creatorId: 'owner-1', status })) };
  const splitRepo = { findActive: vi.fn(async () => active) };
  return {
    splitRepo,
    split: new CampaignSplitUseCase(campaignRepo as never, splitRepo as never, {} as never, {} as never, {} as never, splitEnabled),
  };
}

describe('CampaignSplitUseCase.getDisclosure', () => {
  it('discloses the active split while split proceeds are enabled', async () => {
    const { split } = useCase(true);
    const disclosure = await split.getDisclosure('campaign-1');
    expect(disclosure?.beneficiaries.map(b => [b.name, b.sharePercent])).toEqual([['Ama', 60], ['Kofi', 40]]);
  });

  it('discloses nothing once the kill switch is off, even for an already-active split', async () => {
    const { split, splitRepo } = useCase(false);
    await expect(split.getDisclosure('campaign-1')).resolves.toBeNull();
    await expect(split.getDisclosure('campaign-1', { userId: 'owner-1' })).resolves.toBeNull();
    expect(splitRepo.findActive).not.toHaveBeenCalled();
  });

  it('still answers 404 for a non-public campaign when the flag is off', async () => {
    const { split } = useCase(false, 'pending_review');
    await expect(split.getDisclosure('campaign-1')).rejects.toMatchObject({ statusCode: 404 });
  });
});

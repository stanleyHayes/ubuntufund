import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DonationModel } from '../../src/infrastructure/database/models/DonationModel.js';
import { UserModel } from '../../src/infrastructure/database/models/UserModel.js';
import { MongoLeaderboardRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoLeaderboardRepository.js';
vi.mock('../../src/infrastructure/database/models/DonationModel.js', () => ({ DonationModel: { aggregate: vi.fn() } }));
vi.mock('../../src/infrastructure/database/models/UserModel.js', () => ({ UserModel: { find: vi.fn() } }));
const id = '6aa184c66d4e5ed850d9e641';
const group = (donorId: string, amount = 200) => ({ _id: donorId, totalDonated: amount, donationCount: 1, currency: 'GHS', campaignIds: ['campaign'], allAnonymous: false });
const repo = new MongoLeaderboardRepository();
beforeEach(() => vi.resetAllMocks());
describe('leaderboard guest contributions', () => {
  it('keeps guest gifts in totals without inventing a registered donor', async () => {
    vi.mocked(DonationModel.aggregate).mockResolvedValue([{ ...group('guest', 4200), donationCount: 2 }]);
    vi.mocked(UserModel.find).mockResolvedValue([]);
    expect(await repo.getTopDonors({ period: 'lifetime', category: 'all', limit: 10 })).toEqual([]);
    expect(UserModel.find).toHaveBeenCalledWith({ _id: { $in: [] } });
    expect(await repo.getStats({ period: 'lifetime', category: 'all' })).toEqual({ totalAmount: 4200, totalDonations: 2, totalDonors: 0 });
  });
  it('ranks registered donors alongside guest gifts without querying the guest ID', async () => {
    vi.mocked(DonationModel.aggregate).mockResolvedValue([group('guest'), group(id, 500)]);
    vi.mocked(UserModel.find).mockResolvedValue([{ _id: id, name: 'Supporter', role: 'user' }]);
    const rows = await repo.getTopDonors({ period: 'monthly', category: 'all', limit: 10 });
    expect(UserModel.find).toHaveBeenCalledWith({ _id: { $in: [id] } });
    expect(rows).toEqual([expect.objectContaining({ userId: id, name: 'Supporter', totalDonated: 500 })]);
  });
  it.each(['user', 'organization'] as const)('filters %s stats without casting guest IDs', async category => {
    vi.mocked(DonationModel.aggregate).mockResolvedValue([group('guest'), group(id, 500)]);
    vi.mocked(UserModel.find).mockResolvedValue([{ _id: id, role: category }]);
    expect(await repo.getStats({ period: 'lifetime', category })).toEqual({ totalAmount: 500, totalDonations: 1, totalDonors: 1 });
    expect(UserModel.find).toHaveBeenCalledWith({ _id: { $in: [id] }, role: category });
  });
});

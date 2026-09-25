import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { connectTestDatabase, disconnectTestDatabase, dropTestDatabase } from '../helpers/testDatabase.js';
import { MongoDonationRepository } from '../../src/infrastructure/adapters/outbound/persistence/MongoDonationRepository.js';
import { DonationModel } from '../../src/infrastructure/database/models/DonationModel.js';

beforeAll(async () => { await connectTestDatabase(); });
afterAll(async () => { await dropTestDatabase(); await disconnectTestDatabase(); });

// I123: all guest donations share donorId 'guest', so a campaign with many
// guest donors showed "1 supporter" for all of them.
describe('distinct supporter counts', () => {
  it('counts each guest donation as a supporter and each account once', async () => {
    const campaignId = new mongoose.Types.ObjectId().toString();
    const other = new mongoose.Types.ObjectId().toString();
    const row = (donorId: string, cid = campaignId) => ({ campaignId: cid, donorId, amount: 10, currency: 'GHS', paymentMethod: 'card' });
    await DonationModel.insertMany([row('guest'), row('guest'), row('guest'), row('user-1'), row('user-1'), row('guest', other)]);
    const counts = await new MongoDonationRepository().countDistinctDonorsByCampaignIds([campaignId, other]);
    expect(counts[campaignId]).toBe(4);
    expect(counts[other]).toBe(1);
  });
});

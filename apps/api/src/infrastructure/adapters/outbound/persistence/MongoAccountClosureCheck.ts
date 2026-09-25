import type { PayoutStatus } from '@ubuntu-fund/types';
import type {
  AccountClosureBlocker,
  AccountClosureBlockerKind,
  AccountClosureCheck,
  AccountClosureCheckPort,
} from '../../../../domain/ports/outbound/AccountClosureCheckPort.js';
import { AffiliateBalanceModel } from '../../../database/models/AffiliateBalanceModel.js';
import { AffiliateModel } from '../../../database/models/AffiliateModel.js';
import { AffiliatePayoutModel } from '../../../database/models/AffiliatePayoutModel.js';
import { BeneficiaryPayoutModel } from '../../../database/models/BeneficiaryPayoutModel.js';
import { CampaignBalanceModel } from '../../../database/models/CampaignBalanceModel.js';
import { CampaignBeneficiaryBalanceModel } from '../../../database/models/CampaignBeneficiaryBalanceModel.js';
import { CampaignModel } from '../../../database/models/CampaignModel.js';
import { CreatorBalanceModel } from '../../../database/models/CreatorBalanceModel.js';
import { CreatorPayoutModel } from '../../../database/models/CreatorPayoutModel.js';
import { PayoutModel } from '../../../database/models/PayoutModel.js';
import { WalletModel } from '../../../database/models/WalletModel.js';

/** Payouts that have not reached a terminal state; FAILED/REVERSED return funds to a balance. */
const IN_FLIGHT: PayoutStatus[] = ['PENDING', 'PROCESSING', 'NEEDS_REVIEW'];
/** Ignore floating-point residue left by balance arithmetic. */
const EPSILON = 1e-9;

/**
 * Read-only check of everything a closed account would strand: wallet, campaign,
 * beneficiary, tip-jar and affiliate balances plus payouts still in flight.
 * Organizations are users, so their campaigns are covered by `creatorId`.
 */
export class MongoAccountClosureCheck implements AccountClosureCheckPort {
  async check(userId: string): Promise<AccountClosureCheck> {
    const now = new Date();
    const [wallets, campaigns, creator, affiliate, creatorPayouts] = await Promise.all([
      WalletModel.find({ userId }).select('currency balance').lean(),
      CampaignModel.find({ creatorId: userId }).select('_id status endDate deletedAt').lean(),
      CreatorBalanceModel.findOne({ userId }).select('currency availableBalance pendingBalance').lean(),
      AffiliateModel.findOne({ userId }).select('_id').lean(),
      CreatorPayoutModel.countDocuments({ creatorUserId: userId, status: { $in: IN_FLIGHT } }),
    ]);
    const campaignIds = campaigns.map(campaign => String(campaign._id));
    const affiliateId = affiliate ? String(affiliate._id) : null;
    const [campaignBalances, beneficiaryBalances, affiliateBalance, campaignPayouts, beneficiaryPayouts, affiliatePayouts] = await Promise.all([
      campaignIds.length ? CampaignBalanceModel.find({ campaignId: { $in: campaignIds } }).select('currency availableBalance pendingBalance').lean() : [],
      campaignIds.length ? CampaignBeneficiaryBalanceModel.find({ campaignId: { $in: campaignIds } }).select('currency availableBalance pendingBalance').lean() : [],
      affiliateId ? AffiliateBalanceModel.findOne({ affiliateId }).select('currency availableBalance pendingBalance').lean() : null,
      campaignIds.length ? PayoutModel.countDocuments({ campaignId: { $in: campaignIds }, status: { $in: IN_FLIGHT } }) : 0,
      campaignIds.length ? BeneficiaryPayoutModel.countDocuments({ campaignId: { $in: campaignIds }, status: { $in: IN_FLIGHT } }) : 0,
      affiliateId ? AffiliatePayoutModel.countDocuments({ affiliateId, status: { $in: IN_FLIGHT } }) : 0,
    ]);

    const totals = new Map<string, AccountClosureBlocker>();
    const add = (kind: AccountClosureBlockerKind, currency: string | undefined, amount: number | undefined) => {
      if (!amount || !Number.isFinite(amount)) return;
      const code = (currency || 'GHS').toUpperCase();
      const key = `${kind}:${code}`;
      const entry = totals.get(key) ?? { kind, currency: code, amount: 0 };
      entry.amount = (entry.amount ?? 0) + amount;
      totals.set(key, entry);
    };
    for (const wallet of wallets) add('wallet_balance', wallet.currency, wallet.balance);
    for (const row of campaignBalances) add('campaign_balance', row.currency, (row.availableBalance ?? 0) + (row.pendingBalance ?? 0));
    for (const row of beneficiaryBalances) add('beneficiary_balance', row.currency, (row.availableBalance ?? 0) + (row.pendingBalance ?? 0));
    if (creator) add('creator_balance', creator.currency, (creator.availableBalance ?? 0) + (creator.pendingBalance ?? 0));
    if (affiliateBalance) add('affiliate_balance', affiliateBalance.currency, (affiliateBalance.availableBalance ?? 0) + (affiliateBalance.pendingBalance ?? 0));

    const blockers: AccountClosureBlocker[] = [...totals.values()]
      .filter(entry => Math.abs(entry.amount ?? 0) > EPSILON)
      .map(entry => ({ ...entry, amount: Math.round((entry.amount ?? 0) * 1e8) / 1e8 }));
    const inFlight = creatorPayouts + campaignPayouts + beneficiaryPayouts + affiliatePayouts;
    if (inFlight > 0) blockers.push({ kind: 'pending_payout', count: inFlight });

    const openCampaigns = campaigns.filter(campaign => !campaign.deletedAt && (
      campaign.status === 'pending_review'
      || (['active', 'funded'].includes(campaign.status) && new Date(campaign.endDate) > now)
    )).length;
    return { blockers, openCampaigns };
  }
}

import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { TransactionType, TransactionStatus } from '@ubuntu-fund/types';
import type { PaymentGatewayPort } from '../../../../domain/ports/outbound/PaymentGatewayPort.js';
import { WalletTopUpModel } from '../../../database/models/WalletTopUpModel.js';
import { WalletModel } from '../../../database/models/WalletModel.js';
import { UserModel } from '../../../database/models/UserModel.js';
import { WalletTransactionModel } from '../../../database/models/WalletTransactionModel.js';
import { JournalEntryModel } from '../../../database/models/JournalEntryModel.js';
import { JournalLineModel } from '../../../database/models/JournalLineModel.js';
import { LedgerAccountModel } from '../../../database/models/LedgerAccountModel.js';
import { AppError } from '../../inbound/middleware/errorHandler.js';

/** Credits only server-verified Paystack charges; all financial writes commit together. */
export class WalletTopUpService {
  constructor(private readonly gateway: PaymentGatewayPort, private readonly enabled: boolean, private readonly mode: 'test' | 'live' = 'test') {}
  configuration() { return { enabled: this.enabled && this.gateway.isConfigured(), mode: this.mode }; }

  private reconciling = false;
  async reconcile() {
    if (this.reconciling || !this.enabled || !this.gateway.isConfigured()) return;
    this.reconciling = true;
    try {
      const pending = await WalletTopUpModel.find({ status: 'pending', updatedAt: { $lt: new Date(Date.now() - 5 * 60000) } }).sort({ updatedAt: 1 }).limit(50);
      for (const topup of pending) {
        try { await this.settle(topup.reference); }
        catch { /* Leave pending for the next sweep; never infer success. */ }
        await WalletTopUpModel.updateOne({ _id: topup.id, status: 'pending' }, { $set: { updatedAt: new Date() } });
      }
    } finally { this.reconciling = false; }
  }

  async initialize(userId: string, walletId: string, amount: number, key: string) {
    if (!this.enabled || !this.gateway.isConfigured()) throw new AppError('Wallet top-ups are not configured', 503);
    const minor = Math.round(amount * 100);
    if (!Number.isSafeInteger(minor) || amount !== minor / 100 || minor < 100 || minor > 1000000) throw new AppError('Enter an amount from GHS 1 to GHS 10,000 with at most two decimals', 400);
    const wallet = await WalletModel.findOne({ _id: walletId, userId, currency: 'GHS' });
    if (!wallet) throw new AppError('GHS wallet not found', 404);
    const user = await UserModel.findById(userId);
    if (!user?.email) throw new AppError('An account email is required', 400);
    let topup = await WalletTopUpModel.findOne({ userId, idempotencyKey: key });
    if (topup) {
      if (topup.amountMinor !== minor || topup.walletId !== walletId) throw new AppError('This request key belongs to a different top-up', 409);
      return this.view(topup);
    }
    try {
      topup = await WalletTopUpModel.create({ userId, walletId, amountMinor: minor, currency: 'GHS', reference: `wtop-${randomUUID()}`, idempotencyKey: key });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) throw new AppError('This top-up is already being processed', 409);
      throw error;
    }
    const result = await this.gateway.initializeCharge({ email: user.email, amount: minor / 100, referencePrefix: 'wtop', reference: topup.reference, callbackPath: '/wallet', metadata: { purpose: 'wallet_topup' } });
    if (result.reference !== topup.reference || !result.authorizationUrl.startsWith('https://')) throw new AppError('Invalid checkout response', 502);
    topup.authorizationUrl = result.authorizationUrl;
    await topup.save();
    return this.view(topup);
  }

  private view(topup: { reference: string; status: string; amountMinor: number; authorizationUrl?: string | null }) {
    return { reference: topup.reference, status: topup.status, amount: topup.amountMinor / 100, currency: 'GHS', authorizationUrl: topup.authorizationUrl };
  }

  async status(userId: string, reference: string) {
    const topup = await WalletTopUpModel.findOne({ userId, reference });
    if (!topup) throw new AppError('Top-up not found', 404);
    if (topup.status !== 'completed') await this.settle(reference);
    return this.view((await WalletTopUpModel.findOne({ userId, reference }))!);
  }

  async settle(reference: string) {
    const topup = await WalletTopUpModel.findOne({ reference });
    if (!topup || topup.status === 'completed') return;
    const verified = await this.gateway.verifyTransaction(reference);
    if (['failed', 'abandoned', 'reversed'].includes(verified.status)) { await WalletTopUpModel.updateOne({ reference, status: 'pending' }, { $set: { status: 'failed' } }); return; }
    if (verified.status !== 'success') return;
    const feeMinor = Math.round(verified.fees * 100);
    if (verified.reference !== reference || verified.currency !== 'GHS' || verified.amount !== topup.amountMinor / 100 || !Number.isSafeInteger(feeMinor) || feeMinor < 0 || feeMinor > topup.amountMinor) throw new AppError('Top-up payment verification mismatch', 409);
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const claimed = await WalletTopUpModel.findOneAndUpdate({ reference, status: { $in: ['pending', 'failed'] } }, { $set: { status: 'completed', feeMinor, settledAt: new Date() } }, { session, new: true });
        if (!claimed) return;
        const result = await WalletModel.updateOne({ _id: topup.walletId, userId: topup.userId, currency: 'GHS' }, [{ $set: { balance: { $round: [{ $add: ['$balance', topup.amountMinor / 100] }, 2] }, updatedAt: new Date() } }], { session });
        if (result.matchedCount !== 1) throw new AppError('Wallet no longer available', 409);
        await WalletTransactionModel.create([{ walletId: topup.walletId, userId: topup.userId, type: TransactionType.DEPOSIT, status: TransactionStatus.COMPLETED, amount: topup.amountMinor / 100, currency: 'GHS', reference, metadata: { provider: 'paystack', feeMinor } }], { session });
        const [entry] = await JournalEntryModel.create([{ externalRef: reference, memo: 'Verified Paystack wallet top-up', currency: 'GHS' }], { session });
        // Ujimora absorbs processor fees: credit the full requested amount to the wallet.
        const lines = [
          { kind: 'payment_clearing', owner: 'paystack', direction: 'debit', minor: topup.amountMinor - feeMinor },
          { kind: 'processor_fee', owner: 'platform', direction: 'debit', minor: feeMinor },
          { kind: 'wallet', owner: topup.walletId, direction: 'credit', minor: topup.amountMinor },
        ] as const;
        for (const line of lines) {
          if (!line.minor) continue;
          const account = await LedgerAccountModel.findOneAndUpdate({ kind: line.kind, ownerId: line.owner, currency: 'GHS' }, { $setOnInsert: { createdAt: new Date() } }, { upsert: true, new: true, session });
          await JournalLineModel.create([{ journalEntryId: entry.id, accountId: account.id, accountKind: line.kind, accountOwnerId: line.owner, direction: line.direction, amount: line.minor / 100, currency: 'GHS' }], { session });
        }
      });
    } finally { await session.endSession(); }
  }
}

import { PaymentMethod } from '@ubuntu-fund/types';
import { PaymentProviderEntity } from '../../../../domain/entities/PaymentProvider.js';
import type { PaymentProviderRepositoryPort } from '../../../../domain/ports/outbound/PaymentProviderRepositoryPort.js';
import {
  PaymentProviderModel,
  type PaymentProviderDocument,
} from '../../../database/models/PaymentProviderModel.js';

function toDomain(doc: PaymentProviderDocument): PaymentProviderEntity {
  return new PaymentProviderEntity({
    id: doc._id!.toString(),
    name: doc.name,
    slug: doc.slug,
    type: doc.type,
    enabled: doc.enabled,
    isDefault: doc.isDefault,
    feePercent: doc.feePercent,
    displayOrder: doc.displayOrder,
    createdAt: doc.createdAt,
  });
}

/**
 * Sensible defaults seeded the first time the collection is read and found
 * empty: wallet (on by default, platform default provider), M-Pesa (mobile
 * money), card/Stripe, and bank transfer.
 */
const DEFAULT_PROVIDERS = [
  {
    name: 'UbuntuFund Wallet',
    slug: 'wallet',
    type: PaymentMethod.WALLET,
    enabled: true,
    isDefault: true,
    feePercent: 0,
    displayOrder: 1,
  },
  {
    name: 'M-Pesa',
    slug: 'mpesa',
    type: PaymentMethod.MOBILE_MONEY,
    enabled: false,
    isDefault: false,
    feePercent: 1.5,
    displayOrder: 2,
  },
  {
    name: 'Stripe',
    slug: 'stripe',
    type: PaymentMethod.CARD,
    enabled: false,
    isDefault: false,
    feePercent: 2.9,
    displayOrder: 3,
  },
  {
    name: 'Bank Transfer',
    slug: 'bank-transfer',
    type: PaymentMethod.BANK_TRANSFER,
    enabled: false,
    isDefault: false,
    feePercent: 1.0,
    displayOrder: 4,
  },
];

export class MongoPaymentProviderRepository implements PaymentProviderRepositoryPort {
  private async ensureSeeded(): Promise<void> {
    const count = await PaymentProviderModel.countDocuments();
    if (count === 0) {
      await PaymentProviderModel.insertMany(DEFAULT_PROVIDERS);
    }
  }

  async findAll(): Promise<PaymentProviderEntity[]> {
    await this.ensureSeeded();
    const docs = await PaymentProviderModel.find().sort({ displayOrder: 1 });
    return docs.map(toDomain);
  }

  async findEnabled(): Promise<PaymentProviderEntity[]> {
    await this.ensureSeeded();
    const docs = await PaymentProviderModel.find({ enabled: true }).sort({
      displayOrder: 1,
    });
    return docs.map(toDomain);
  }

  async findById(id: string): Promise<PaymentProviderEntity | null> {
    await this.ensureSeeded();
    const doc = await PaymentProviderModel.findById(id);
    return doc ? toDomain(doc) : null;
  }

  async toggleEnabled(id: string): Promise<PaymentProviderEntity | null> {
    const existing = await PaymentProviderModel.findById(id);
    if (!existing) {
      return null;
    }
    existing.enabled = !existing.enabled;
    await existing.save();
    return toDomain(existing);
  }
}

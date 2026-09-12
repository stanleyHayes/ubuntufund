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
 * empty: wallet (on by default, platform default provider), Ghana mobile
 * money rails (MTN MoMo, Telecel Cash, AT Money), cards, and bank transfer.
 */
/**
 * The gateway rails, as opposed to the payment *methods* below.
 *
 * `mtn-momo`, `card` and friends describe what checkout advertises, and most
 * are simply things Paystack accepts — there is no separate MTN integration to
 * switch on, which is why enabling them was refused. These two rows are the
 * rails themselves, so toggling one genuinely stops that rail taking money.
 *
 * Their initial `enabled` comes from the env flags, so introducing them changes
 * nothing on deploy: a deployment already running Paystack keeps running it.
 */
function gatewayProviders() {
  return [
    {
      name: 'Paystack',
      slug: 'paystack',
      type: PaymentMethod.GATEWAY,
      enabled: process.env.PAYMENTS_PAYSTACK_ENABLED !== 'false',
      isDefault: false,
      feePercent: 0,
      displayOrder: 90,
    },
    {
      name: 'Flutterwave',
      slug: 'flutterwave',
      type: PaymentMethod.GATEWAY,
      enabled: process.env.PAYMENTS_FLUTTERWAVE_ENABLED === 'true',
      isDefault: false,
      feePercent: 0,
      displayOrder: 91,
    },
  ];
}

const DEFAULT_PROVIDERS = [
  {
    name: 'Ujimora Wallet',
    slug: 'wallet',
    type: PaymentMethod.WALLET,
    enabled: true,
    isDefault: true,
    feePercent: 0,
    displayOrder: 1,
  },
  {
    name: 'MTN Mobile Money (MoMo)',
    slug: 'mtn-momo',
    type: PaymentMethod.MOBILE_MONEY,
    enabled: false,
    isDefault: false,
    feePercent: 1.5,
    displayOrder: 2,
  },
  {
    name: 'Telecel Cash',
    slug: 'telecel-cash',
    type: PaymentMethod.MOBILE_MONEY,
    enabled: false,
    isDefault: false,
    feePercent: 1.5,
    displayOrder: 3,
  },
  {
    name: 'AT Money',
    slug: 'at-money',
    type: PaymentMethod.MOBILE_MONEY,
    enabled: false,
    isDefault: false,
    feePercent: 1.5,
    displayOrder: 4,
  },
  {
    name: 'Visa & Mastercard',
    slug: 'card',
    type: PaymentMethod.CARD,
    enabled: false,
    isDefault: false,
    feePercent: 2.9,
    displayOrder: 5,
  },
  {
    name: 'Bank Transfer',
    slug: 'bank-transfer',
    type: PaymentMethod.BANK_TRANSFER,
    enabled: false,
    isDefault: false,
    feePercent: 1.0,
    displayOrder: 6,
  },
];

export class MongoPaymentProviderRepository implements PaymentProviderRepositoryPort {
  private async ensureSeeded(): Promise<void> {
    const count = await PaymentProviderModel.countDocuments();
    if (count === 0) {
      await PaymentProviderModel.insertMany(DEFAULT_PROVIDERS);
    }

    // Backfill the gateway rows separately. Existing deployments already have
    // the six method rows, so the count check above would never add these —
    // and a missing gateway row is now the difference between a rail being
    // live and not. `$setOnInsert` so an admin's own toggle is never
    // overwritten by a later boot.
    for (const gateway of gatewayProviders()) {
      await PaymentProviderModel.updateOne(
        { slug: gateway.slug },
        { $setOnInsert: gateway },
        { upsert: true }
      );
    }
  }

  /**
   * Whether a gateway rail is switched on in the dashboard.
   *
   * Fails OPEN: an unreadable or absent record returns true, so a database
   * hiccup can never silently stop the platform taking money. The env flag is
   * the other half of the decision and still has to allow the rail.
   */
  async isGatewayEnabled(slug: string): Promise<boolean> {
    try {
      const doc = await PaymentProviderModel.findOne({
        slug,
        type: PaymentMethod.GATEWAY,
      }).select('enabled').lean();
      return doc ? doc.enabled !== false : true;
    } catch {
      return true;
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

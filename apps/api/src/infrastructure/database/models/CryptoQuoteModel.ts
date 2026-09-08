import mongoose, { Schema, type Document } from 'mongoose';

/**
 * A server-persisted crypto price quote (Crypto Donations plan §9). The rate is
 * locked here at quote time and read back at deposit time so the contributor —
 * never the client — dictates the GHS-equivalent. A TTL index purges quotes an
 * hour after expiry (the "quote expiry cleanup" worker, §19); the deposit
 * use-case still enforces `expiresAt` as the authority.
 */
export interface CryptoQuoteDocument extends Document {
  quoteId: string;
  campaignId: string;
  provider: string;
  asset: string;
  network: string;
  fiatCurrency: string;
  fiatAmount: number;
  cryptoAmount: number;
  rate: number;
  providerFeeFiat: number;
  networkFeeFiat: number;
  requiredConfirmations: number;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<CryptoQuoteDocument>(
  {
    quoteId: { type: String, required: true, unique: true },
    campaignId: { type: String, required: true, index: true },
    provider: { type: String, required: true },
    asset: { type: String, required: true },
    network: { type: String, required: true },
    fiatCurrency: { type: String, required: true },
    fiatAmount: { type: Number, required: true },
    cryptoAmount: { type: Number, required: true },
    rate: { type: Number, required: true },
    providerFeeFiat: { type: Number, default: 0 },
    networkFeeFiat: { type: Number, default: 0 },
    requiredConfirmations: { type: Number, default: 1 },
    expiresAt: { type: Date, required: true },
  },
  { collection: 'cryptoquotes', timestamps: true }
);

// Auto-purge one hour after expiry (deposit still enforces expiresAt in code).
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });

export const CryptoQuoteModel = mongoose.model<CryptoQuoteDocument>(
  'CryptoQuote',
  schema
);

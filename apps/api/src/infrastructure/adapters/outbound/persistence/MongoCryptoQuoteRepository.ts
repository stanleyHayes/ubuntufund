import type { CryptoAsset } from '@ubuntu-fund/types';
import type {
  CryptoQuoteRepositoryPort,
  StoredCryptoQuote,
} from '../../../../domain/ports/outbound/CryptoQuoteRepositoryPort.js';
import {
  CryptoQuoteModel,
  type CryptoQuoteDocument,
} from '../../../database/models/CryptoQuoteModel.js';

function toDomain(doc: CryptoQuoteDocument): StoredCryptoQuote {
  return {
    quoteId: doc.quoteId,
    campaignId: doc.campaignId,
    provider: doc.provider,
    asset: doc.asset as CryptoAsset,
    network: doc.network,
    fiatCurrency: doc.fiatCurrency,
    fiatAmount: doc.fiatAmount,
    cryptoAmount: doc.cryptoAmount,
    rate: doc.rate,
    providerFeeFiat: doc.providerFeeFiat,
    networkFeeFiat: doc.networkFeeFiat,
    requiredConfirmations: doc.requiredConfirmations,
    expiresAt: doc.expiresAt,
  };
}

export class MongoCryptoQuoteRepository implements CryptoQuoteRepositoryPort {
  async save(quote: StoredCryptoQuote): Promise<void> {
    await CryptoQuoteModel.create(quote);
  }

  async findByQuoteId(quoteId: string): Promise<StoredCryptoQuote | null> {
    const doc = await CryptoQuoteModel.findOne({ quoteId });
    return doc ? toDomain(doc) : null;
  }
}

import type { CryptoAssetInfo } from '@ubuntu-fund/types';
import type { CryptoConfig } from '../../infrastructure/config/index.js';
import type { CryptoPaymentProviderPort } from '../../domain/ports/outbound/CryptoPaymentProviderPort.js';

export interface CryptoAssetsResult {
  enabled: boolean;
  assets: CryptoAssetInfo[];
}

/**
 * The crypto assets + networks the frontend may offer (plan §22 #4). The list is
 * the provider's supported capability intersected with the server-side allowlist
 * — never dictated by the client. Returns `enabled: false` with an empty list
 * when the rail is off, so the UI can simply hide the crypto option.
 */
export class GetCryptoAssetsUseCase {
  constructor(
    private readonly provider: CryptoPaymentProviderPort,
    private readonly config: CryptoConfig
  ) {}

  async execute(): Promise<CryptoAssetsResult> {
    if (!this.config.enabled || !this.provider.isConfigured()) {
      return { enabled: false, assets: [] };
    }
    const supported = await this.provider.getSupportedAssets();
    const assets = supported.filter((a) =>
      this.config.allowedAssets.includes(a.asset)
    );
    return { enabled: true, assets };
  }
}

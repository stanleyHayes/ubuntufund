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
    private readonly config: CryptoConfig,
    private readonly fallbackProviders: CryptoPaymentProviderPort[] = []
  ) {}

  async execute(): Promise<CryptoAssetsResult> {
    if (!this.config.enabled) return { enabled: false, assets: [] };
    const assets = new Map<string, CryptoAssetInfo>();
    for (const provider of [this.provider, ...this.fallbackProviders]) {
      if (!provider.isConfigured()) continue;
      try {
        for (const asset of await provider.getSupportedAssets()) {
          if (!this.config.allowedAssets.includes(asset.asset)) continue;
          const previous = assets.get(asset.asset);
          assets.set(asset.asset, previous ? { ...previous, networks: [...previous.networks, ...asset.networks.filter(n => !previous.networks.some(p => p.id === n.id))] } : asset);
        }
      } catch { /* Expose only reachable, configured providers. */ }
    }
    return { enabled: assets.size > 0, assets: [...assets.values()] };
  }
}

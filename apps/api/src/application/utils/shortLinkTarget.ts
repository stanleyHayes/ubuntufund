import type { QrKind } from '@ubuntu-fund/types';

export interface ShortLinkTargetParams {
  kind: QrKind;
  /** The campaign's slug when available, otherwise its id. */
  campaignRef: string;
  creatorId: string;
  liveSessionId?: string;
  presetAmount?: number;
  label?: string;
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * Build the public destination URL a short link resolves to, from the web
 * app's base URL and the link's kind. Pure and deterministic — the same inputs
 * always produce the same target (used at both create and list time).
 */
export function buildShortLinkTarget(
  publicWebUrl: string,
  params: ShortLinkTargetParams
): string {
  const base = stripTrailingSlash(publicWebUrl);
  const campaign = `${base}/c/${params.campaignRef}`;

  switch (params.kind) {
    case 'live':
      return params.liveSessionId
        ? `${campaign}/live/${encodeURIComponent(params.liveSessionId)}`
        : `${campaign}/live`;
    case 'amount': {
      const donate = `${campaign}/donate`;
      return params.presetAmount != null
        ? `${donate}?amount=${encodeURIComponent(String(params.presetAmount))}`
        : donate;
    }
    case 'creator':
      return `${base}/u/${params.creatorId}`;
    case 'event':
      return params.label
        ? `${campaign}?ref=${encodeURIComponent(params.label)}`
        : campaign;
    case 'campaign':
    default:
      return campaign;
  }
}

/** Build the human-readable short URL (`${PUBLIC_API_URL}/r/:code`) for a code. */
export function buildShortUrl(publicApiUrl: string, code: string): string {
  return `${stripTrailingSlash(publicApiUrl)}/r/${code}`;
}

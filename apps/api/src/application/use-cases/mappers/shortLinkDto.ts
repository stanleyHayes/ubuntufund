import type { ShortLink, ShortLinkView } from '@ubuntu-fund/types';
import type { ShortLinkEntity } from '../../../domain/entities/ShortLink.js';
import { buildShortUrl } from '../../utils/shortLinkTarget.js';

/** Shared mapper from the domain entity to the wire-format DTO. */
function toShortLinkDto(entity: ShortLinkEntity): ShortLink {
  const plain = entity.toPlain();
  return {
    id: plain.id,
    code: plain.code,
    campaignId: plain.campaignId,
    liveSessionId: plain.liveSessionId,
    kind: plain.kind,
    presetAmount: plain.presetAmount,
    label: plain.label,
    createdBy: plain.createdBy,
    target: plain.target,
    scanCount: plain.scanCount,
    createdAt: plain.createdAt,
  };
}

/** DTO plus the human-readable short URL derived from the API base + code. */
export function toShortLinkView(
  entity: ShortLinkEntity,
  publicApiUrl: string
): ShortLinkView {
  const dto = toShortLinkDto(entity);
  return { ...dto, shortUrl: buildShortUrl(publicApiUrl, dto.code) };
}

import type { PublicationApplyHandler } from '../../../../../domain/ports/outbound/PublicationApplyPort.js';
import type { PublicationApplyDeps } from './deps.js';
import { notBuiltYet } from './notBuiltYet.js';

/**
 * campaign.slug: moves the campaign to the approved web address, design §4.8.
 * Not built yet: approvals end as not_published/unavailable before anything is written.
 */
export function campaignSlugHandler(_deps: PublicationApplyDeps): PublicationApplyHandler {
  return notBuiltYet('campaign.slug');
}

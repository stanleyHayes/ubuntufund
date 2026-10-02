import type { PublicationApplyHandler } from '../../../../../domain/ports/outbound/PublicationApplyPort.js';
import type { PublicationApplyDeps } from './deps.js';
import { notBuiltYet } from './notBuiltYet.js';

/**
 * creator.profile: saves the approved creator page, design §4.6.
 * Not built yet: approvals end as not_published/unavailable before anything is written.
 */
export function creatorProfileHandler(_deps: PublicationApplyDeps): PublicationApplyHandler {
  return notBuiltYet('creator.profile');
}

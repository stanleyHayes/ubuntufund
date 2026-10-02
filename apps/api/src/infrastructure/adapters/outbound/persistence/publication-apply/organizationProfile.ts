import type { PublicationApplyHandler } from '../../../../../domain/ports/outbound/PublicationApplyPort.js';
import type { PublicationApplyDeps } from './deps.js';
import { notBuiltYet } from './notBuiltYet.js';

/**
 * organization.profile: applies the approved organization name and website, design §4.5.
 * Not built yet: approvals end as not_published/unavailable before anything is written.
 */
export function organizationProfileHandler(_deps: PublicationApplyDeps): PublicationApplyHandler {
  return notBuiltYet('organization.profile');
}

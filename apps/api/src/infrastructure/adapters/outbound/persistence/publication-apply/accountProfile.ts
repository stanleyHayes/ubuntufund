import type { PublicationApplyHandler } from '../../../../../domain/ports/outbound/PublicationApplyPort.js';
import type { PublicationApplyDeps } from './deps.js';
import { notBuiltYet } from './notBuiltYet.js';

/**
 * account.profile: applies the approved public identity through the account profile writer, design §4.4.
 * Not built yet: approvals end as not_published/unavailable before anything is written.
 */
export function accountProfileHandler(_deps: PublicationApplyDeps): PublicationApplyHandler {
  return notBuiltYet('account.profile');
}

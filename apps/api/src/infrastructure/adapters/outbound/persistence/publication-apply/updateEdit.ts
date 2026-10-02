import type { PublicationApplyHandler } from '../../../../../domain/ports/outbound/PublicationApplyPort.js';
import type { PublicationApplyDeps } from './deps.js';
import { notBuiltYet } from './notBuiltYet.js';

/**
 * update.edit: applies the approved edit onto the exact version it was proposed against, design §4.3.
 * Not built yet: approvals end as not_published/unavailable before anything is written.
 */
export function updateEditHandler(_deps: PublicationApplyDeps): PublicationApplyHandler {
  return notBuiltYet('update.edit');
}

import type { PublicationApplyHandler } from '../../../../../domain/ports/outbound/PublicationApplyPort.js';
import type { PublicationApplyDeps } from './deps.js';
import { notBuiltYet } from './notBuiltYet.js';

/**
 * update.create: posts the approved campaign update through the campaign content writer, design §4.2.
 * Not built yet: approvals end as not_published/unavailable before anything is written.
 */
export function updateCreateHandler(_deps: PublicationApplyDeps): PublicationApplyHandler {
  return notBuiltYet('update.create');
}

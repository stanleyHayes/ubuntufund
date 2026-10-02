import type { PublicationApplyHandler } from '../../../../../domain/ports/outbound/PublicationApplyPort.js';
import type { PublicationApplyDeps } from './deps.js';
import { notBuiltYet } from './notBuiltYet.js';

/**
 * thank_you.send: queues the approved thank-you message once (the delivery worker emails it), design §4.7.
 * Not built yet: approvals end as not_published/unavailable before anything is written.
 */
export function thankYouSendHandler(_deps: PublicationApplyDeps): PublicationApplyHandler {
  return notBuiltYet('thank_you.send');
}

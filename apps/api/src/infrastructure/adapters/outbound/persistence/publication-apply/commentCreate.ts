import type { PublicationApplyHandler } from '../../../../../domain/ports/outbound/PublicationApplyPort.js';
import type { PublicationApplyDeps } from './deps.js';
import { notBuiltYet } from './notBuiltYet.js';

/**
 * comment.create: posts the approved comment through the comment writer (MongoCommentCreation), design §4.1.
 * Not built yet: approvals end as not_published/unavailable before anything is written.
 */
export function commentCreateHandler(_deps: PublicationApplyDeps): PublicationApplyHandler {
  return notBuiltYet('comment.create');
}

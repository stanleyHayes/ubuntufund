import type { PublicationApplyHandler, PublicationApplyHandlers } from '../../../../../domain/ports/outbound/PublicationApplyPort.js';
import type { PublicationApplyDeps } from './deps.js';
import { commentCreateHandler } from './commentCreate.js';
import { updateCreateHandler } from './updateCreate.js';
import { updateEditHandler } from './updateEdit.js';
import { accountProfileHandler } from './accountProfile.js';
import { organizationProfileHandler } from './organizationProfile.js';
import { creatorProfileHandler } from './creatorProfile.js';
import { thankYouSendHandler } from './thankYouSend.js';
import { campaignSlugHandler } from './campaignSlug.js';

export type { PublicationApplyDeps } from './deps.js';

/** The handler that publishes each publish-on-approval action, by action. */
export function createPublicationApplyHandlers(deps: PublicationApplyDeps): PublicationApplyHandlers {
  const handlers: PublicationApplyHandler[] = [
    commentCreateHandler(deps), updateCreateHandler(deps), updateEditHandler(deps),
    accountProfileHandler(deps), organizationProfileHandler(deps), creatorProfileHandler(deps),
    thankYouSendHandler(deps), campaignSlugHandler(deps),
  ];
  return new Map(handlers.map(handler => [handler.action, handler]));
}

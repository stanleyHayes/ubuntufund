import type { UnitOfWorkPort } from '../../../../../domain/ports/outbound/UnitOfWorkPort.js';
import type { PlanLimitsService } from '../../../../../application/services/PlanLimitsService.js';
import type { ThankYouSettings } from '../../../../../application/services/CommercialConfigService.js';
import type { MongoCreatorProfileRepository } from '../MongoCreatorProfileRepository.js';
import type { MongoCreatorBalanceRepository } from '../MongoCreatorBalanceRepository.js';
import type { MongoAccountProfileWrite } from '../MongoAccountProfileWrite.js';
import type { MongoDonorThankYous } from '../MongoDonorThankYous.js';
import type { MongoCampaignRepository } from '../MongoCampaignRepository.js';
import type { MongoCampaignUpdateRepository } from '../MongoCampaignUpdateRepository.js';
import type { MongoCampaignCommentRepository } from '../MongoCampaignCommentRepository.js';
import type { MongoUserBlockRepository } from '../MongoUserBlockRepository.js';

/**
 * What the publication handlers are built with (app.ts). Concrete adapters,
 * so a handler can reach the transactional writer its action already uses.
 */
export interface PublicationApplyDeps {
  uow: UnitOfWorkPort;
  planLimits: PlanLimitsService;
  creatorProfiles: MongoCreatorProfileRepository;
  creatorBalances: MongoCreatorBalanceRepository;
  accountProfileWrite: MongoAccountProfileWrite;
  donorThankYous: MongoDonorThankYous;
  thankYouConfig: { resolveThankYouConfig(): Promise<ThankYouSettings> };
  campaignRepo: MongoCampaignRepository;
  campaignUpdateRepo: MongoCampaignUpdateRepository;
  commentRepo: MongoCampaignCommentRepository;
  userBlocks: MongoUserBlockRepository;
}

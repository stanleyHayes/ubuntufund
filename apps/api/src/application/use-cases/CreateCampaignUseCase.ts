import {
  CampaignStatus,
  type CreateCampaignInput,
  type Campaign,
} from '@ubuntu-fund/types';
import { CampaignEntity } from '../../domain/entities/Campaign.js';
import { Money } from '../../domain/value-objects/Money.js';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { UserRepositoryPort } from '../../domain/ports/outbound/UserRepositoryPort.js';
import type { PlanLimitsService } from '../services/PlanLimitsService.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import { generateUniqueSlug } from '../utils/slug.js';
import {
  deriveCampaignTier,
  tierRequiresManualReview,
} from '../../domain/services/campaignTier.js';
import type { CampaignsConfig } from '../../infrastructure/config/index.js';

export class CreateCampaignUseCase {
  constructor(
    private readonly campaignRepo: CampaignRepositoryPort,
    private readonly userRepo: UserRepositoryPort,
    private readonly planLimits: PlanLimitsService,
    // Risk-tiering + review policy (spec §4). Optional so existing unit tests that
    // don't exercise tiering still construct the use-case; absent ⇒ no tier is
    // assigned and every campaign is held for review (the pre-tiering behaviour).
    private readonly campaignsConfig?: CampaignsConfig,
    /**
     * Resolves the effective tiering rules from the versioned store, so an
     * admin can change what auto-approves without a deploy. Absent, the static
     * config above is used unchanged.
     */
    private readonly configService?: { resolveCampaignsConfig(): Promise<CampaignsConfig> },
    /** Tells the review team a campaign is waiting. Absent ⇒ no alert. */
    private readonly reviewAlerts?: {
      campaignPendingReview(input: {
        campaignId: string
        title: string
        goalAmount: number
        currency: string
        tier: number
      }): Promise<void>
    }
  ) {}

  async execute(input: CreateCampaignInput, creatorId: string): Promise<Campaign> {
    if (input.currency !== 'GHS') throw new AppError('Campaign goals must be in GHS', 422);
    if (!Number.isFinite(new Date(input.endDate).getTime()) || new Date(input.endDate).getTime() <= Date.now()) throw new AppError('End date must be in the future', 422);
    const user = await this.userRepo.findById(creatorId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    const campaignCount = await this.campaignRepo.countByCreatorId(creatorId);
    if (!user.canCreateCampaign(campaignCount)) {
      throw new AppError(
        `User cannot create more campaigns. Limit: ${user.getCampaignLimit()}, current: ${campaignCount}`,
        403
      );
    }

    // Enforce the creator's subscription-plan limits AND the compliance-approved
    // ceiling: active-campaign count (403) and the effective goal cap =
    // MIN(plan cap, compliance cap) (422 over the cap).
    await this.planLimits.assertCanCreateCampaign(
      creatorId,
      input.goalAmount,
      user.complianceApprovedCampaignLimit,
      input.imageUrls?.length ?? 0
    );

    const slug = await generateUniqueSlug(input.title, async (candidate) => {
      const existing = await this.campaignRepo.findBySlug(candidate);
      return existing !== null;
    });

    // Risk-tier the campaign (spec §4). Low tiers auto-approve (go live now);
    // high tiers are held in PENDING_REVIEW for manual compliance review. Without
    // the tiering config, keep the legacy "everything is reviewed" behaviour.
    let tier: number | undefined;
    let status = CampaignStatus.PENDING_REVIEW;
    // Prefer the versioned store so a dashboard change takes effect on the next
    // campaign, not the next deploy. A lookup failure falls back to the static
    // config rather than failing creation: the worst case is one campaign
    // tiered by slightly stale rules, which beats refusing to create it.
    let tiering = this.campaignsConfig;
    if (this.configService) {
      try {
        tiering = await this.configService.resolveCampaignsConfig();
      } catch {
        tiering = this.campaignsConfig;
      }
    }
    if (tiering) {
      tier = deriveCampaignTier(input.goalAmount, tiering.tierThresholds);
      status = tierRequiresManualReview(tier, tiering.autoApproveMaxTier)
        ? CampaignStatus.PENDING_REVIEW
        : CampaignStatus.ACTIVE;
    }

    // Lock the platform fee % from the organizer's plan at creation (ADR-5
    // grandfathering), so a later admin fee change never surprises this campaign.
    const lockedPlatformFeePercent = await this.planLimits.platformFeePercent(creatorId);

    const now = new Date();
    const campaign = new CampaignEntity({
      id: '', // Will be assigned by the repository
      slug,
      title: input.title,
      description: input.description,
      goalAmount: new Money(input.goalAmount, input.currency),
      raisedAmount: new Money(0, input.currency),
      category: input.category,
      priority: input.priority,
      status,
      creatorId,
      beneficiaries: input.beneficiaries,
      imageUrls: input.imageUrls ?? [],
      startDate: now,
      endDate: new Date(input.endDate),
      createdAt: now,
      updatedAt: now,
      tier,
      lockedPlatformFeePercent,
    });

    const saved = await this.campaignRepo.save(campaign);
    const plain = saved.toPlain();

    // A held campaign is invisible to donors until someone approves it, and
    // nothing else says so — the organizer just sees "Donations closed". Fired
    // after the save so the alert always names a campaign that exists, and
    // awaited only for its own error handling: the adapter never throws.
    if (status === CampaignStatus.PENDING_REVIEW && this.reviewAlerts) {
      await this.reviewAlerts.campaignPendingReview({
        campaignId: plain.id,
        title: plain.title,
        goalAmount: plain.goalAmount.amount,
        currency: plain.goalAmount.currency,
        tier: tier ?? 0,
      });
    }

    return {
      id: plain.id,
      slug: plain.slug || undefined,
      title: plain.title,
      description: plain.description,
      goalAmount: plain.goalAmount.amount,
      raisedAmount: plain.raisedAmount.amount,
      currency: plain.goalAmount.currency,
      category: plain.category,
      priority: plain.priority,
      status: plain.status,
      creatorId: plain.creatorId,
      beneficiaries: plain.beneficiaries,
      imageUrls: plain.imageUrls,
      startDate: plain.startDate,
      endDate: plain.endDate,
      createdAt: plain.createdAt,
      updatedAt: plain.updatedAt,
      tier: plain.tier,
    };
  }
}

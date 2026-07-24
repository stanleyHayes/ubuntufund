import {
  CampaignStatus,
  CampaignCategory,
  CampaignPriority,
  type CreateCampaignInput,
  type Campaign,
} from '@ubuntu-fund/types';
import { CampaignEntity } from '../../domain/entities/Campaign.js';
import { Money } from '../../domain/value-objects/Money.js';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { UserRepositoryPort } from '../../domain/ports/outbound/UserRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

export class CreateCampaignUseCase {
  constructor(
    private readonly campaignRepo: CampaignRepositoryPort,
    private readonly userRepo: UserRepositoryPort
  ) {}

  async execute(input: CreateCampaignInput, creatorId: string): Promise<Campaign> {
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

    const now = new Date();
    const campaign = new CampaignEntity({
      id: '', // Will be assigned by the repository
      title: input.title,
      description: input.description,
      goalAmount: new Money(input.goalAmount, input.currency),
      raisedAmount: new Money(0, input.currency),
      category: input.category,
      priority: input.priority,
      status: CampaignStatus.PENDING_REVIEW,
      creatorId,
      beneficiaries: input.beneficiaries,
      imageUrls: [],
      startDate: now,
      endDate: new Date(input.endDate),
      createdAt: now,
      updatedAt: now,
    });

    const saved = await this.campaignRepo.save(campaign);
    const plain = saved.toPlain();

    return {
      id: plain.id,
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
    };
  }
}

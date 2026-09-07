import { randomUUID } from 'node:crypto';
import type {
  BeneficiaryConsentStatus,
  BeneficiaryStatement,
  CampaignBeneficiaryBalance,
  CampaignSplitDisclosure,
  CampaignSplitVersion,
  CreateSplitInput,
} from '@ubuntu-fund/types';
import { CampaignSplitVersionEntity } from '../../domain/entities/CampaignSplitVersion.js';
import type { CampaignRepositoryPort } from '../../domain/ports/outbound/CampaignRepositoryPort.js';
import type { CampaignSplitRepositoryPort } from '../../domain/ports/outbound/CampaignSplitRepositoryPort.js';
import type { CampaignBeneficiaryBalanceRepositoryPort } from '../../domain/ports/outbound/CampaignBeneficiaryBalanceRepositoryPort.js';
import type { CampaignBeneficiaryAccrualRepositoryPort } from '../../domain/ports/outbound/CampaignBeneficiaryAccrualRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import { toSplitDto, toSplitDisclosure, toBeneficiaryStatement } from './mappers/splitDto.js';

/** The platform's only settlement currency. */
const CURRENCY = 'GHS';

export interface SplitRequester {
  userId: string;
  role?: string;
}

/**
 * Manage a campaign's split-proceeds configuration (spec §17 / ADR-3):
 * create/amend immutable versions, capture per-beneficiary consent, activate a
 * consented version (superseding the prior), and expose the donor-facing
 * disclosure. Money accrual + per-beneficiary payouts build on this in later
 * slices; nothing here moves funds.
 */
export class CampaignSplitUseCase {
  constructor(
    private readonly campaignRepo: CampaignRepositoryPort,
    private readonly splitRepo: CampaignSplitRepositoryPort,
    private readonly beneficiaryBalanceRepo: CampaignBeneficiaryBalanceRepositoryPort,
    private readonly accrualRepo: CampaignBeneficiaryAccrualRepositoryPort
  ) {}

  /** Owner/admin: create a new (draft) split version for a campaign. */
  async createSplit(
    campaignId: string,
    input: CreateSplitInput,
    requester: SplitRequester
  ): Promise<CampaignSplitVersion> {
    await this.assertOwnerOrAdmin(campaignId, requester);

    if (!input.allocations || input.allocations.length === 0) {
      throw new AppError('At least one allocation is required', 400);
    }
    const allocations = input.allocations.map((a) => ({
      beneficiaryId: a.beneficiaryId?.trim() || randomUUID(),
      name: a.name?.trim(),
      email: a.email?.trim() || undefined,
      shareBps: a.shareBps,
      consent: 'pending' as BeneficiaryConsentStatus,
    }));
    if (allocations.some((a) => !a.name)) {
      throw new AppError('Each beneficiary needs a name', 400);
    }

    // Construction enforces the split invariants (sum = 100%, ≥ 2, etc.).
    let entity: CampaignSplitVersionEntity;
    const version = await this.splitRepo.nextVersion(campaignId);
    try {
      entity = new CampaignSplitVersionEntity({
        id: randomUUID(),
        campaignId,
        version,
        status: 'draft',
        allocations,
        locked: false,
        createdBy: requester.userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } catch (error) {
      throw new AppError(
        error instanceof Error ? error.message : 'Invalid split allocations',
        400
      );
    }

    const created = await this.splitRepo.create(entity);
    return toSplitDto(created);
  }

  /** Public: the active split's donor-facing disclosure (null when none). */
  async getDisclosure(
    campaignId: string
  ): Promise<CampaignSplitDisclosure | null> {
    const active = await this.splitRepo.findActive(campaignId);
    return active ? toSplitDisclosure(active) : null;
  }

  /** Owner/admin: every split version for the campaign (newest first). */
  async listVersions(
    campaignId: string,
    requester: SplitRequester
  ): Promise<CampaignSplitVersion[]> {
    await this.assertOwnerOrAdmin(campaignId, requester);
    const versions = await this.splitRepo.findAllByCampaign(campaignId);
    return versions.map(toSplitDto);
  }

  /**
   * Record a beneficiary's consent on a version. Allowed for the campaign
   * owner/admin (recording consent received) or the beneficiary themselves when
   * their id is a platform user id.
   */
  async setConsent(
    campaignId: string,
    version: number,
    beneficiaryId: string,
    status: BeneficiaryConsentStatus,
    requester: SplitRequester
  ): Promise<CampaignSplitVersion> {
    const isSelf = requester.userId === beneficiaryId;
    if (!isSelf) {
      await this.assertOwnerOrAdmin(campaignId, requester);
    }
    if (status !== 'accepted' && status !== 'declined') {
      throw new AppError('Consent must be "accepted" or "declined"', 400);
    }
    const updated = await this.splitRepo.setConsent(
      campaignId,
      version,
      beneficiaryId,
      status
    );
    if (!updated) {
      // Either the version/beneficiary was not found or the version is locked.
      const existing = await this.splitRepo.findByCampaignAndVersion(
        campaignId,
        version
      );
      if (existing?.locked) {
        throw new AppError('A locked split version cannot change consent', 409);
      }
      throw new AppError('Split version or beneficiary not found', 404);
    }
    return toSplitDto(updated);
  }

  /**
   * Owner/admin: make a version the active split. Requires every beneficiary to
   * have accepted; supersedes the prior active version (prospective amendment).
   */
  async activate(
    campaignId: string,
    version: number,
    requester: SplitRequester
  ): Promise<CampaignSplitVersion> {
    await this.assertOwnerOrAdmin(campaignId, requester);
    const target = await this.splitRepo.findByCampaignAndVersion(
      campaignId,
      version
    );
    if (!target) {
      throw new AppError('Split version not found', 404);
    }
    if (!target.allConsented()) {
      throw new AppError(
        'Every beneficiary must accept their allocation before activation',
        422
      );
    }
    const activated = await this.splitRepo.activate(campaignId, version);
    if (!activated) {
      throw new AppError('Split version could not be activated', 409);
    }
    return toSplitDto(activated);
  }

  /** Owner/admin: the per-beneficiary balances accrued for this campaign. */
  async listBeneficiaryBalances(
    campaignId: string,
    requester: SplitRequester
  ): Promise<CampaignBeneficiaryBalance[]> {
    await this.assertOwnerOrAdmin(campaignId, requester);
    return this.beneficiaryBalanceRepo.listByCampaign(campaignId);
  }

  /**
   * A beneficiary's statement for a campaign: current balance + accrual history.
   * Visible to the campaign owner/admin or the beneficiary themselves.
   */
  async getBeneficiaryStatement(
    campaignId: string,
    beneficiaryId: string,
    requester: SplitRequester
  ): Promise<BeneficiaryStatement> {
    const isSelf = requester.userId === beneficiaryId;
    if (!isSelf) {
      await this.assertOwnerOrAdmin(campaignId, requester);
    }
    const balance =
      (await this.beneficiaryBalanceRepo.findOne(campaignId, beneficiaryId, CURRENCY)) ??
      {
        campaignId,
        beneficiaryId,
        currency: CURRENCY,
        pendingBalance: 0,
        availableBalance: 0,
        paidOutBalance: 0,
        updatedAt: new Date(),
      };
    const accruals = await this.accrualRepo.listByBeneficiary(campaignId, beneficiaryId);
    return toBeneficiaryStatement(campaignId, beneficiaryId, balance, accruals);
  }

  private async assertOwnerOrAdmin(
    campaignId: string,
    requester: SplitRequester
  ): Promise<void> {
    const campaign = await this.campaignRepo.findById(campaignId);
    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }
    const isOwner = campaign.creatorId === requester.userId;
    const isAdmin = requester.role === 'admin';
    if (!isOwner && !isAdmin) {
      throw new AppError(
        'Only the campaign owner can manage its split',
        403
      );
    }
  }
}

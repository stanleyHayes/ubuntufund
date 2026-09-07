import {
  SPLIT_TOTAL_BPS,
  type BeneficiaryAllocation,
  type SplitStatus,
} from '@ubuntu-fund/types';

export interface CampaignSplitVersionProps {
  id: string;
  campaignId: string;
  version: number;
  status: SplitStatus;
  allocations: BeneficiaryAllocation[];
  locked: boolean;
  lockedAt?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * An immutable snapshot of a campaign's beneficiary split (spec §17 / ADR-3).
 *
 * Invariants enforced at construction so an invalid split can never exist:
 *  - at least two beneficiaries (a split needs someone to split with);
 *  - every share is a positive integer basis-point value ≤ 100%;
 *  - the shares total exactly 100% (10000 bps) — no float, no drift;
 *  - beneficiary ids are unique within the version.
 *
 * Lifecycle (draft → active → superseded) and the single-active-per-campaign
 * rule are enforced by the repository's atomic transitions; this entity guards
 * the shape and the consent/lock rules.
 */
export class CampaignSplitVersionEntity {
  private props: CampaignSplitVersionProps;

  constructor(props: CampaignSplitVersionProps) {
    CampaignSplitVersionEntity.assertValidAllocations(props.allocations);
    this.props = { ...props };
  }

  /** Validate an allocation set; throws with a specific message on any breach. */
  static assertValidAllocations(allocations: BeneficiaryAllocation[]): void {
    if (allocations.length < 2) {
      throw new Error('A split needs at least two beneficiaries');
    }
    const ids = new Set<string>();
    let total = 0;
    for (const a of allocations) {
      if (!a.beneficiaryId) {
        throw new Error('Each beneficiary needs an id');
      }
      if (ids.has(a.beneficiaryId)) {
        throw new Error(`Duplicate beneficiary: ${a.beneficiaryId}`);
      }
      ids.add(a.beneficiaryId);
      if (!Number.isInteger(a.shareBps) || a.shareBps <= 0 || a.shareBps > SPLIT_TOTAL_BPS) {
        throw new Error(
          `Each share must be an integer between 1 and ${SPLIT_TOTAL_BPS} basis points`
        );
      }
      total += a.shareBps;
    }
    if (total !== SPLIT_TOTAL_BPS) {
      throw new Error(
        `Shares must total 100% (${SPLIT_TOTAL_BPS} bps); got ${total}`
      );
    }
  }

  get id(): string {
    return this.props.id;
  }
  get campaignId(): string {
    return this.props.campaignId;
  }
  get version(): number {
    return this.props.version;
  }
  get status(): SplitStatus {
    return this.props.status;
  }
  get allocations(): BeneficiaryAllocation[] {
    return this.props.allocations.map((a) => ({ ...a }));
  }
  get locked(): boolean {
    return this.props.locked;
  }
  get createdBy(): string {
    return this.props.createdBy;
  }

  /** True when every beneficiary has accepted their allocation. */
  allConsented(): boolean {
    return this.props.allocations.every((a) => a.consent === 'accepted');
  }

  /** The beneficiary ids and their basis-point shares, for distribution. */
  shareVector(): { beneficiaryId: string; shareBps: number }[] {
    return this.props.allocations.map((a) => ({
      beneficiaryId: a.beneficiaryId,
      shareBps: a.shareBps,
    }));
  }

  toPlain(): CampaignSplitVersionProps {
    return {
      ...this.props,
      allocations: this.props.allocations.map((a) => ({ ...a })),
    };
  }
}

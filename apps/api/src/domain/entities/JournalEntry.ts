import type {
  DonationSettlementBreakdown,
  JournalDirection,
  LedgerAccountKind,
} from '@ubuntu-fund/types';
import { PLATFORM_ACCOUNT_OWNER } from '@ubuntu-fund/types';

/** A journal line before persistence — no ids assigned yet. */
export interface DraftJournalLine {
  accountKind: LedgerAccountKind;
  accountOwnerId: string;
  direction: JournalDirection;
  amount: number;
  currency: string;
}

export interface JournalEntryProps {
  donationId?: string;
  donationIntentId?: string;
  memo: string;
  currency: string;
  lines: DraftJournalLine[];
}

/** Round to 2 decimal places (the ledger's minor-unit precision). */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * A balanced, append-only ledger entry. Constructing one asserts the
 * double-entry invariant (Σ debits === Σ credits); an unbalanced set of lines
 * is a programming error and throws before anything is persisted.
 */
export class JournalEntryEntity {
  private readonly props: JournalEntryProps;

  constructor(props: JournalEntryProps) {
    this.props = { ...props, lines: props.lines.map((l) => ({ ...l })) };
    this.assertBalanced();
  }

  get donationId(): string | undefined {
    return this.props.donationId;
  }
  get donationIntentId(): string | undefined {
    return this.props.donationIntentId;
  }
  get memo(): string {
    return this.props.memo;
  }
  get currency(): string {
    return this.props.currency;
  }
  get lines(): DraftJournalLine[] {
    return this.props.lines.map((l) => ({ ...l }));
  }

  totalDebits(): number {
    return round2(
      this.props.lines
        .filter((l) => l.direction === 'debit')
        .reduce((sum, l) => sum + l.amount, 0)
    );
  }

  totalCredits(): number {
    return round2(
      this.props.lines
        .filter((l) => l.direction === 'credit')
        .reduce((sum, l) => sum + l.amount, 0)
    );
  }

  private assertBalanced(): void {
    if (this.props.lines.length === 0) {
      throw new Error('Journal entry must have at least one line');
    }
    if (this.totalDebits() !== this.totalCredits()) {
      throw new Error(
        `Unbalanced journal entry: debits ${this.totalDebits()} !== credits ${this.totalCredits()}`
      );
    }
  }

  /**
   * Build the balanced double-entry for a settled donation from its money
   * breakdown. The campaign-directed `amount` is debited to the campaign
   * account and split across beneficiary-net + platform + processor credits;
   * an optional tip is a separate balanced debit(tip)/credit(platform_fee)
   * pair. Zero-value legs are omitted.
   */
  static forDonation(
    breakdown: DonationSettlementBreakdown,
    refs: { campaignId: string; donationId: string; donationIntentId: string; memo?: string }
  ): JournalEntryEntity {
    const { amount, tip, processorFee, platformFee, beneficiaryNet, currency } =
      breakdown;

    if (round2(beneficiaryNet) !== round2(amount - platformFee - processorFee)) {
      throw new Error('beneficiaryNet must equal amount - platformFee - processorFee');
    }
    if (beneficiaryNet < 0) {
      throw new Error('beneficiaryNet cannot be negative');
    }

    const campaign = refs.campaignId;
    const lines: DraftJournalLine[] = [];

    // Campaign-directed donation: debit the campaign, credit the split.
    lines.push({
      accountKind: 'campaign',
      accountOwnerId: campaign,
      direction: 'debit',
      amount: round2(amount),
      currency,
    });
    lines.push({
      accountKind: 'beneficiary',
      accountOwnerId: campaign,
      direction: 'credit',
      amount: round2(beneficiaryNet),
      currency,
    });
    if (platformFee > 0) {
      lines.push({
        accountKind: 'platform_fee',
        accountOwnerId: PLATFORM_ACCOUNT_OWNER,
        direction: 'credit',
        amount: round2(platformFee),
        currency,
      });
    }
    if (processorFee > 0) {
      lines.push({
        accountKind: 'processor_fee',
        accountOwnerId: PLATFORM_ACCOUNT_OWNER,
        direction: 'credit',
        amount: round2(processorFee),
        currency,
      });
    }

    // Optional tip: a self-balancing debit(tip)/credit(platform_fee) pair.
    if (tip > 0) {
      lines.push({
        accountKind: 'tip',
        accountOwnerId: PLATFORM_ACCOUNT_OWNER,
        direction: 'debit',
        amount: round2(tip),
        currency,
      });
      lines.push({
        accountKind: 'platform_fee',
        accountOwnerId: PLATFORM_ACCOUNT_OWNER,
        direction: 'credit',
        amount: round2(tip),
        currency,
      });
    }

    return new JournalEntryEntity({
      donationId: refs.donationId,
      donationIntentId: refs.donationIntentId,
      memo: refs.memo ?? `donation ${refs.donationId}`,
      currency,
      lines,
    });
  }
}

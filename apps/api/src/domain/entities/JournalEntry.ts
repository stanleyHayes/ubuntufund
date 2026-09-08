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
  /**
   * A caller-supplied idempotency key for non-donation entries (e.g. payout
   * disbursement/reversal, which have no donation intent). Posting is exactly-
   * once per externalRef, so re-running a settlement never double-posts.
   */
  externalRef?: string;
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
  get externalRef(): string | undefined {
    return this.props.externalRef;
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

  /**
   * Build the balanced double-entry for a payout disbursement: the beneficiary's
   * owed funds leave the platform. Debit the campaign's `beneficiary` account
   * (reducing what is owed) and credit its `payout` account (funds disbursed).
   */
  static forPayoutDisbursement(refs: {
    campaignId: string;
    amount: number;
    currency: string;
    memo?: string;
    externalRef?: string;
  }): JournalEntryEntity {
    const amount = round2(refs.amount);
    if (amount <= 0) {
      throw new Error('Payout amount must be greater than zero');
    }
    return new JournalEntryEntity({
      externalRef: refs.externalRef,
      memo: refs.memo ?? `payout for campaign ${refs.campaignId}`,
      currency: refs.currency,
      lines: [
        {
          accountKind: 'beneficiary',
          accountOwnerId: refs.campaignId,
          direction: 'debit',
          amount,
          currency: refs.currency,
        },
        {
          accountKind: 'payout',
          accountOwnerId: refs.campaignId,
          direction: 'credit',
          amount,
          currency: refs.currency,
        },
      ],
    });
  }

  /**
   * Build the balanced reversing entry for a reversed payout: money came back to
   * the platform. The mirror of {@link forPayoutDisbursement} — debit `payout`,
   * credit `beneficiary`. Posted as a NEW entry (posted entries are never
   * mutated).
   */
  static forPayoutReversal(refs: {
    campaignId: string;
    amount: number;
    currency: string;
    memo?: string;
    externalRef?: string;
  }): JournalEntryEntity {
    const amount = round2(refs.amount);
    if (amount <= 0) {
      throw new Error('Payout amount must be greater than zero');
    }
    return new JournalEntryEntity({
      externalRef: refs.externalRef,
      memo: refs.memo ?? `payout reversal for campaign ${refs.campaignId}`,
      currency: refs.currency,
      lines: [
        {
          accountKind: 'payout',
          accountOwnerId: refs.campaignId,
          direction: 'debit',
          amount,
          currency: refs.currency,
        },
        {
          accountKind: 'beneficiary',
          accountOwnerId: refs.campaignId,
          direction: 'credit',
          amount,
          currency: refs.currency,
        },
      ],
    });
  }

  /**
   * Build the balanced COMPENSATING entry for a refund (spec §14): the mirror of
   * the donation's campaign/beneficiary/fee legs, posted as a NEW entry — the
   * original settlement journal is never edited. Credits the campaign account
   * (reducing raised) and debits back the beneficiary-net + fees for the
   * refunded portion. `amount` must equal beneficiaryNet + platformFee +
   * processorFee (the campaign-directed portion refunded). Tips are not
   * reversed (kept by the platform). The exact fee treatment is a §10
   * accountant-review item; the engineering guarantee is a balanced, auditable,
   * append-only record.
   */
  static forDonationRefund(refs: {
    campaignId: string;
    donationId?: string;
    donationIntentId?: string;
    amount: number;
    beneficiaryNet: number;
    platformFee: number;
    processorFee: number;
    currency: string;
    memo?: string;
  }): JournalEntryEntity {
    const amount = round2(refs.amount);
    const beneficiaryNet = round2(refs.beneficiaryNet);
    const platformFee = round2(refs.platformFee);
    const processorFee = round2(refs.processorFee);
    if (amount <= 0) {
      throw new Error('Refund amount must be greater than zero');
    }
    if (amount !== round2(beneficiaryNet + platformFee + processorFee)) {
      throw new Error('Refund amount must equal beneficiaryNet + platformFee + processorFee');
    }
    const lines: DraftJournalLine[] = [
      {
        accountKind: 'campaign',
        accountOwnerId: refs.campaignId,
        direction: 'credit',
        amount,
        currency: refs.currency,
      },
      {
        accountKind: 'beneficiary',
        accountOwnerId: refs.campaignId,
        direction: 'debit',
        amount: beneficiaryNet,
        currency: refs.currency,
      },
    ];
    if (platformFee > 0) {
      lines.push({
        accountKind: 'platform_fee',
        accountOwnerId: PLATFORM_ACCOUNT_OWNER,
        direction: 'debit',
        amount: platformFee,
        currency: refs.currency,
      });
    }
    if (processorFee > 0) {
      lines.push({
        accountKind: 'processor_fee',
        accountOwnerId: PLATFORM_ACCOUNT_OWNER,
        direction: 'debit',
        amount: processorFee,
        currency: refs.currency,
      });
    }
    return new JournalEntryEntity({
      donationId: refs.donationId,
      donationIntentId: refs.donationIntentId,
      memo: refs.memo ?? `refund for donation ${refs.donationId ?? refs.donationIntentId}`,
      currency: refs.currency,
      lines,
    });
  }
}

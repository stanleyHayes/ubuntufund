import type {
  ContributionMethod,
  CryptoAsset,
  DonationIntentStatus,
  DonationProvider,
  PaymentRail,
} from '@ubuntu-fund/types';

export interface DonationIntentProps {
  id: string;
  campaignId: string;
  liveSessionId?: string;
  amount: number;
  currency: string;
  donorUserId: string | null;
  donorEmail?: string;
  donorName?: string;
  message?: string;
  isAnonymous: boolean;
  tip: number;
  status: DonationIntentStatus;
  provider: DonationProvider;
  providerRef?: string;
  idempotencyKey: string;
  attribution?: string;
  createdAt: Date;
  updatedAt: Date;
  // Multi-currency & settlement (spec §8) — optional/additive; legacy GHS
  // records omit them and derive from amount/currency.
  originalAmountMinor?: number;
  originalCurrency?: string;
  settlementAmountMinor?: number;
  settlementCurrency?: string;
  fxRate?: number;
  fxSource?: string;
  country?: string;
  paymentMethod?: ContributionMethod;
  providerFeeMinor?: number;
  platformFeeMinor?: number;
  netCampaignAmountMinor?: number;
  // Cumulative refunded campaign-amount in minor units (spec §14). Absent on
  // never-refunded intents. The refund claim caps against the original amount.
  refundedAmountMinor?: number;
  // Idempotency keys of refunds already applied — a repeated refund with the
  // same key is a no-op (exactly-once, even for partial refunds).
  refundKeys?: string[];
  // ── Crypto rail (Crypto Donations plan §6) — optional/additive ────────────
  paymentRail?: PaymentRail;
  cryptoAsset?: CryptoAsset;
  cryptoNetwork?: string;
  walletAddress?: string;
  transactionHash?: string;
  confirmationCount?: number;
  requiredConfirmations?: number;
  quoteId?: string;
  quoteExpiresAt?: Date;
}

/**
 * Legal state transitions (spec §9). CREATED can go straight to SUCCEEDED for
 * the synchronous wallet rail; hosted rails move through PENDING (and possibly
 * REQUIRES_ACTION for 3-DS / PROCESSING) first. Post-success money movements —
 * refunds, disputes, chargebacks — extend out of SUCCEEDED. FAILED, EXPIRED,
 * CANCELLED, REFUNDED and CHARGEBACK are terminal. A delayed/replayed webhook
 * can never move a terminal payment backward (transitions are validated).
 */
const ALLOWED_TRANSITIONS: Record<DonationIntentStatus, DonationIntentStatus[]> = {
  CREATED: ['PENDING', 'REQUIRES_ACTION', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'CANCELLED'],
  PENDING: ['REQUIRES_ACTION', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'CANCELLED'],
  REQUIRES_ACTION: ['PROCESSING', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'CANCELLED'],
  PROCESSING: ['SUCCEEDED', 'FAILED', 'EXPIRED', 'CANCELLED'],
  SUCCEEDED: ['REFUND_PENDING', 'PARTIALLY_REFUNDED', 'DISPUTED'],
  REFUND_PENDING: ['REFUNDED', 'PARTIALLY_REFUNDED', 'FAILED'],
  PARTIALLY_REFUNDED: ['REFUND_PENDING', 'REFUNDED', 'DISPUTED'],
  DISPUTED: ['CHARGEBACK', 'SUCCEEDED'],
  REFUNDED: [],
  CHARGEBACK: [],
  FAILED: [],
  CANCELLED: [],
  EXPIRED: [],
};

/**
 * A guest-capable donation intent — the money-changing record a donation flows
 * through. Guards its own status transitions so an illegal move (e.g.
 * re-settling a FAILED intent) throws rather than silently corrupting state.
 */
export class DonationIntentEntity {
  private props: DonationIntentProps;

  constructor(props: DonationIntentProps) {
    if (props.amount <= 0) {
      throw new Error('Donation amount must be greater than zero');
    }
    if (props.tip < 0) {
      throw new Error('Tip cannot be negative');
    }
    this.props = { ...props };
  }

  get id(): string {
    return this.props.id;
  }
  get campaignId(): string {
    return this.props.campaignId;
  }
  get liveSessionId(): string | undefined {
    return this.props.liveSessionId;
  }
  get amount(): number {
    return this.props.amount;
  }
  get currency(): string {
    return this.props.currency;
  }
  get donorUserId(): string | null {
    return this.props.donorUserId;
  }
  get donorEmail(): string | undefined {
    return this.props.donorEmail;
  }
  get donorName(): string | undefined {
    return this.props.donorName;
  }
  get message(): string | undefined {
    return this.props.message;
  }
  get isAnonymous(): boolean {
    return this.props.isAnonymous;
  }
  get tip(): number {
    return this.props.tip;
  }
  get status(): DonationIntentStatus {
    return this.props.status;
  }
  get provider(): DonationProvider {
    return this.props.provider;
  }
  get providerRef(): string | undefined {
    return this.props.providerRef;
  }
  get idempotencyKey(): string {
    return this.props.idempotencyKey;
  }
  get attribution(): string | undefined {
    return this.props.attribution;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }
  get originalAmountMinor(): number | undefined {
    return this.props.originalAmountMinor;
  }
  get originalCurrency(): string | undefined {
    return this.props.originalCurrency;
  }
  get settlementAmountMinor(): number | undefined {
    return this.props.settlementAmountMinor;
  }
  get settlementCurrency(): string | undefined {
    return this.props.settlementCurrency;
  }
  get fxRate(): number | undefined {
    return this.props.fxRate;
  }
  get country(): string | undefined {
    return this.props.country;
  }
  get paymentMethod(): ContributionMethod | undefined {
    return this.props.paymentMethod;
  }
  get providerFeeMinor(): number | undefined {
    return this.props.providerFeeMinor;
  }
  get platformFeeMinor(): number | undefined {
    return this.props.platformFeeMinor;
  }
  get netCampaignAmountMinor(): number | undefined {
    return this.props.netCampaignAmountMinor;
  }
  get refundedAmountMinor(): number | undefined {
    return this.props.refundedAmountMinor;
  }
  get refundKeys(): string[] | undefined {
    return this.props.refundKeys;
  }
  get paymentRail(): PaymentRail | undefined {
    return this.props.paymentRail;
  }
  get cryptoAsset(): CryptoAsset | undefined {
    return this.props.cryptoAsset;
  }
  get cryptoNetwork(): string | undefined {
    return this.props.cryptoNetwork;
  }
  get walletAddress(): string | undefined {
    return this.props.walletAddress;
  }
  get transactionHash(): string | undefined {
    return this.props.transactionHash;
  }
  get confirmationCount(): number | undefined {
    return this.props.confirmationCount;
  }
  get requiredConfirmations(): number | undefined {
    return this.props.requiredConfirmations;
  }
  get quoteId(): string | undefined {
    return this.props.quoteId;
  }
  get quoteExpiresAt(): Date | undefined {
    return this.props.quoteExpiresAt;
  }

  /** Record on-chain progress observed from a provider webhook (additive). */
  recordCryptoFields(fields: {
    transactionHash?: string;
    confirmationCount?: number;
  }): void {
    this.props = { ...this.props, ...fields, updatedAt: new Date() };
  }

  /** Total the donor is charged: campaign-directed amount plus any tip. */
  get gross(): number {
    return Math.round((this.props.amount + this.props.tip) * 100) / 100;
  }

  isTerminal(): boolean {
    return ALLOWED_TRANSITIONS[this.props.status].length === 0;
  }

  canTransitionTo(next: DonationIntentStatus): boolean {
    return ALLOWED_TRANSITIONS[this.props.status].includes(next);
  }

  private transition(next: DonationIntentStatus): void {
    if (!this.canTransitionTo(next)) {
      throw new Error(
        `Illegal donation-intent transition: ${this.props.status} → ${next}`
      );
    }
    this.props.status = next;
    this.props.updatedAt = new Date();
  }

  markPending(providerRef?: string): void {
    this.transition('PENDING');
    if (providerRef) this.props.providerRef = providerRef;
  }

  markSucceeded(providerRef?: string): void {
    this.transition('SUCCEEDED');
    if (providerRef) this.props.providerRef = providerRef;
  }

  markFailed(providerRef?: string): void {
    this.transition('FAILED');
    if (providerRef) this.props.providerRef = providerRef;
  }

  markExpired(): void {
    this.transition('EXPIRED');
  }

  markRequiresAction(providerRef?: string): void {
    this.transition('REQUIRES_ACTION');
    if (providerRef) this.props.providerRef = providerRef;
  }

  markProcessing(providerRef?: string): void {
    this.transition('PROCESSING');
    if (providerRef) this.props.providerRef = providerRef;
  }

  markCancelled(): void {
    this.transition('CANCELLED');
  }

  markRefundPending(): void {
    this.transition('REFUND_PENDING');
  }

  markRefunded(): void {
    this.transition('REFUNDED');
  }

  markPartiallyRefunded(): void {
    this.transition('PARTIALLY_REFUNDED');
  }

  markDisputed(): void {
    this.transition('DISPUTED');
  }

  markChargeback(): void {
    this.transition('CHARGEBACK');
  }

  /**
   * Record the verified settlement money split (spec §8) in integer minor units.
   * Additive: leaves the legacy major-unit `amount`/`currency`/`tip` fields as-is.
   */
  recordSettlementFinancials(fields: {
    originalAmountMinor?: number;
    originalCurrency?: string;
    settlementAmountMinor?: number;
    settlementCurrency?: string;
    fxRate?: number;
    fxSource?: string;
    providerFeeMinor?: number;
    platformFeeMinor?: number;
    netCampaignAmountMinor?: number;
  }): void {
    this.props = { ...this.props, ...fields, updatedAt: new Date() };
  }

  toPlain(): DonationIntentProps {
    return { ...this.props };
  }
}

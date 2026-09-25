/** What a provider-originated money event is about. */
export type ProviderPaymentSubject = 'donation' | 'tip' | 'subscription' | 'wallet_topup' | 'unknown';

/**
 * A chargeback/dispute or refund event a payment provider sent us (never one we
 * initiated in-app). Recorded once per provider event, with no balance
 * mutation, so staff can see and account for money the provider moved.
 * Holds no customer details — only references, amounts and statuses.
 */
export interface ProviderPaymentEvent {
  id: string;
  provider: 'paystack';
  /** Provider event name, e.g. 'charge.dispute.create', 'refund.processed'. */
  event: string;
  kind: 'dispute' | 'refund';
  /** Idempotency key derived from the provider's ids + status. */
  eventKey: string;
  /** The original charge's reference. */
  reference?: string;
  subject: ProviderPaymentSubject;
  /** Our record the reference resolves to (intent id for donations). */
  subjectId?: string;
  campaignId?: string;
  /** Provider's dispute id, or refund reference, when given. */
  providerCaseId?: string;
  amountMinor?: number;
  currency?: string;
  providerStatus?: string;
  providerResolution?: string;
  /** 'open' until staff acknowledge it. */
  reviewStatus: 'open' | 'acknowledged';
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  createdAt: Date;
}

export type NewProviderPaymentEvent = Omit<ProviderPaymentEvent, 'id' | 'reviewStatus' | 'acknowledgedBy' | 'acknowledgedAt' | 'createdAt'>;

export interface ProviderPaymentEventRepositoryPort {
  /** Insert unless an event with the same eventKey exists (replays are no-ops). */
  recordOnce(event: NewProviderPaymentEvent): Promise<{ event: ProviderPaymentEvent; created: boolean }>;
  list(params: { reviewStatus?: 'open' | 'acknowledged'; limit?: number }): Promise<ProviderPaymentEvent[]>;
  acknowledge(id: string, adminId: string): Promise<boolean>;
}

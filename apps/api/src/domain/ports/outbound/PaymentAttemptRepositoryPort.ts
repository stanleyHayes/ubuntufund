import type {
  DonationProvider,
  PaymentAttempt,
  PaymentAttemptStatus,
} from '@ubuntu-fund/types';

export interface RecordPaymentAttemptInput {
  intentId: string;
  provider: DonationProvider;
  providerRef?: string;
  status: PaymentAttemptStatus;
  raw?: Record<string, unknown>;
}

export interface PaymentAttemptRepositoryPort {
  record(input: RecordPaymentAttemptInput): Promise<PaymentAttempt>;
  findByIntentId(intentId: string): Promise<PaymentAttempt[]>;
}


export interface CreatorBalance {
  userId: string;
  currency: string;
  availableBalance: number;
  pendingBalance: number;
  paidOutBalance: number;
  totalReceived: number;
  platformFees: number;
  payoutFees: number;
}

export interface CreatorBalanceRepositoryPort {
  /** Upsert a zeroed balance on first activity, returning it either way. */
  ensure(userId: string, currency: string): Promise<CreatorBalance>;
  findByUserId(userId: string): Promise<CreatorBalance | null>;

  /**
   * Credit a settled tip: totalReceived += gross, platformFees += fee,
   * availableBalance += net. Applied at most once per `settleRef` (a duplicate
   * webhook is a no-op). Returns the updated balance, or null if the guard
   * blocked (already applied).
   */
  creditTip(
    userId: string,
    gross: number,
    fee: number,
    net: number,
    settleRef: string
  ): Promise<CreatorBalance | null>;

  /** Reserve funds for a withdrawal: availableBalance -= amount (guarded ≥). */
  reserveForPayout(userId: string, amount: number): Promise<CreatorBalance | null>;
  /** Return a reserved amount to available (failed/reversed withdrawal). */
  returnToAvailable(userId: string, amount: number, settleRef?: string): Promise<CreatorBalance | null>;
  /** Confirm a paid-out withdrawal: paidOutBalance += net, payoutFees += fee. */
  markPaidOut(userId: string, net: number, fee: number, settleRef?: string): Promise<CreatorBalance | null>;
  /** Reverse a paid-out withdrawal (bounced): paidOut -= net, payoutFees -= fee, available += net + fee. */
  reverseFromPaidOut(userId: string, net: number, settleRef?: string, fee?: number): Promise<CreatorBalance | null>;
}

/** Money that must be withdrawn or resolved before an account can be closed. */
export type AccountClosureBlockerKind =
  | 'wallet_balance'
  | 'campaign_balance'
  | 'beneficiary_balance'
  | 'creator_balance'
  | 'affiliate_balance'
  | 'pending_payout'
  /** Money on its way in (a wallet top-up, or a donation or tip to this account) not yet confirmed. */
  | 'pending_payment';

export interface AccountClosureBlocker {
  kind: AccountClosureBlockerKind;
  /** Set for balances: the non-zero total for one currency. */
  currency?: string;
  amount?: number;
  /** Set for pending payouts and pending payments: how many are still in flight. */
  count?: number;
}

export interface AccountClosureCheck {
  blockers: AccountClosureBlocker[];
  /** Live or in-review campaigns that closing the account will end. */
  openCampaigns: number;
}

export interface AccountClosureCheckPort {
  check(userId: string): Promise<AccountClosureCheck>;
}

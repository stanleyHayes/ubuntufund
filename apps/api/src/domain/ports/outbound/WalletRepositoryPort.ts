import type { Money } from '../../value-objects/Money.js';
import type { WalletEntity } from '../../entities/Wallet.js';

export interface WalletRepositoryPort {
  save(wallet: WalletEntity): Promise<WalletEntity>;
  findById(id: string): Promise<WalletEntity | null>;
  findByUserId(userId: string): Promise<WalletEntity[]>;
  update(wallet: WalletEntity): Promise<WalletEntity>;
  /**
   * Atomically add funds to the owner's wallet. Returns the updated wallet, or
   * null when the wallet does not exist, belongs to someone else, or the
   * currency does not match.
   */
  depositAtomic(walletId: string, userId: string, amount: Money): Promise<WalletEntity | null>;
  /**
   * Atomically deduct funds only when the balance covers the amount. Returns
   * the updated wallet, or null when the wallet is missing, foreign-owned,
   * currency-mismatched, or has insufficient balance.
   */
  withdrawIfSufficient(
    walletId: string,
    userId: string,
    amount: Money
  ): Promise<WalletEntity | null>;
}

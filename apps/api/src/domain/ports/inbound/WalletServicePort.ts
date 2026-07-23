import type { Wallet } from '@ubuntu-fund/types';

export interface WalletServicePort {
  getByUserId(userId: string): Promise<Wallet[]>;
  getById(walletId: string, userId: string): Promise<Wallet | null>;
  deposit(walletId: string, userId: string, amount: number, currency: string): Promise<Wallet>;
  withdraw(walletId: string, userId: string, amount: number, currency: string): Promise<Wallet>;
}

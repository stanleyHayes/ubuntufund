import type { WalletEntity } from '../../entities/Wallet.js';

export interface WalletRepositoryPort {
  save(wallet: WalletEntity): Promise<WalletEntity>;
  findById(id: string): Promise<WalletEntity | null>;
  findByUserId(userId: string): Promise<WalletEntity[]>;
  update(wallet: WalletEntity): Promise<WalletEntity>;
}

export enum WalletType {
  LOCAL = 'local',
  FOREIGN = 'foreign',
  CRYPTO = 'crypto',
}

export enum TransactionType {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
  TRANSFER = 'transfer',
  DONATION = 'donation',
  REFUND = 'refund',
  ESCROW_LOCK = 'escrow_lock',
  ESCROW_RELEASE = 'escrow_release',
}

export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REVERSED = 'reversed',
}

export interface Wallet {
  id: string
  userId: string
  type: WalletType
  currency: string
  balance: number
  createdAt: Date
  updatedAt: Date
}

export interface Transaction {
  id: string
  walletId: string
  type: TransactionType
  status: TransactionStatus
  amount: number
  currency: string
  reference: string
  metadata?: Record<string, unknown>
  createdAt: Date
}

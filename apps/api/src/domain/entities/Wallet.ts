import type { WalletType } from '@ubuntu-fund/types';
import { Money } from '../value-objects/Money.js';

export interface WalletProps {
  id: string;
  userId: string;
  type: WalletType;
  balance: Money;
  createdAt: Date;
  updatedAt: Date;
}

export class WalletEntity {
  private props: WalletProps;

  constructor(props: WalletProps) {
    this.props = { ...props };
  }

  get id(): string {
    return this.props.id;
  }
  get userId(): string {
    return this.props.userId;
  }
  get type(): WalletType {
    return this.props.type;
  }
  get balance(): Money {
    return this.props.balance;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  deposit(amount: Money): void {
    this.props.balance = this.props.balance.add(amount);
    this.props.updatedAt = new Date();
  }

  withdraw(amount: Money): void {
    if (!this.hasBalance(amount)) {
      throw new Error('Insufficient wallet balance');
    }
    this.props.balance = this.props.balance.subtract(amount);
    this.props.updatedAt = new Date();
  }

  hasBalance(amount: Money): boolean {
    return (
      this.props.balance.isGreaterThan(amount) ||
      this.props.balance.equals(amount)
    );
  }

  toPlain(): WalletProps {
    return { ...this.props };
  }
}

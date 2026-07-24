import type { PaymentMethod } from '@ubuntu-fund/types';

export interface PaymentProviderProps {
  id: string;
  name: string;
  slug: string;
  type: PaymentMethod;
  enabled: boolean;
  isDefault: boolean;
  feePercent: number;
  displayOrder: number;
  createdAt: Date;
}

export class PaymentProviderEntity {
  private props: PaymentProviderProps;

  constructor(props: PaymentProviderProps) {
    this.props = { ...props };
  }

  get id(): string {
    return this.props.id;
  }
  get name(): string {
    return this.props.name;
  }
  get slug(): string {
    return this.props.slug;
  }
  get type(): PaymentMethod {
    return this.props.type;
  }
  get enabled(): boolean {
    return this.props.enabled;
  }
  get isDefault(): boolean {
    return this.props.isDefault;
  }
  get feePercent(): number {
    return this.props.feePercent;
  }
  get displayOrder(): number {
    return this.props.displayOrder;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }

  /** Flips the enabled flag in-memory; caller is responsible for persisting. */
  toggle(): void {
    this.props.enabled = !this.props.enabled;
  }

  toPlain(): PaymentProviderProps {
    return { ...this.props };
  }
}

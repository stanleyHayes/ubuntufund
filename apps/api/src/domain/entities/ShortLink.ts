import type { QrKind, ShortLinkScan } from '@ubuntu-fund/types';

export interface ShortLinkProps {
  id: string;
  code: string;
  campaignId: string;
  liveSessionId?: string;
  kind: QrKind;
  presetAmount?: number;
  label?: string;
  createdBy: string;
  target: string;
  scanCount: number;
  scans: ShortLinkScan[];
  createdAt: Date;
}

export class ShortLinkEntity {
  private props: ShortLinkProps;

  constructor(props: ShortLinkProps) {
    this.props = { ...props, scans: [...props.scans] };
  }

  get id(): string {
    return this.props.id;
  }
  get code(): string {
    return this.props.code;
  }
  get campaignId(): string {
    return this.props.campaignId;
  }
  get liveSessionId(): string | undefined {
    return this.props.liveSessionId;
  }
  get kind(): QrKind {
    return this.props.kind;
  }
  get presetAmount(): number | undefined {
    return this.props.presetAmount;
  }
  get label(): string | undefined {
    return this.props.label;
  }
  get createdBy(): string {
    return this.props.createdBy;
  }
  get target(): string {
    return this.props.target;
  }
  get scanCount(): number {
    return this.props.scanCount;
  }
  get scans(): ShortLinkScan[] {
    return [...this.props.scans];
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }

  toPlain(): ShortLinkProps {
    return { ...this.props, scans: [...this.props.scans] };
  }
}

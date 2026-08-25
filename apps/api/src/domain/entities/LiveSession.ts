import type { LiveSessionStatus, LiveSessionStats } from '@ubuntu-fund/types';

export interface LiveSessionProps {
  id: string;
  campaignId: string;
  title?: string;
  targetAmount?: number;
  status: LiveSessionStatus;
  overlayToken: string;
  showDonorNames: boolean;
  showDonorMessages: boolean;
  showAmounts: boolean;
  privacyMode: boolean;
  startedAt: Date;
  endedAt?: Date;
  stats: LiveSessionStats;
}

export interface LiveSessionPrivacyUpdate {
  showDonorNames?: boolean;
  showDonorMessages?: boolean;
  showAmounts?: boolean;
  privacyMode?: boolean;
}

export class LiveSessionEntity {
  private props: LiveSessionProps;

  constructor(props: LiveSessionProps) {
    this.props = { ...props, stats: { ...props.stats } };
  }

  get id(): string {
    return this.props.id;
  }
  get campaignId(): string {
    return this.props.campaignId;
  }
  get title(): string | undefined {
    return this.props.title;
  }
  get targetAmount(): number | undefined {
    return this.props.targetAmount;
  }
  get status(): LiveSessionStatus {
    return this.props.status;
  }
  get overlayToken(): string {
    return this.props.overlayToken;
  }
  get showDonorNames(): boolean {
    return this.props.showDonorNames;
  }
  get showDonorMessages(): boolean {
    return this.props.showDonorMessages;
  }
  get showAmounts(): boolean {
    return this.props.showAmounts;
  }
  get privacyMode(): boolean {
    return this.props.privacyMode;
  }
  get startedAt(): Date {
    return this.props.startedAt;
  }
  get endedAt(): Date | undefined {
    return this.props.endedAt;
  }
  get stats(): LiveSessionStats {
    return { ...this.props.stats };
  }

  isActive(): boolean {
    return this.props.status === 'active';
  }

  /** Names are visible only when explicitly enabled and privacy mode is off. */
  namesVisible(): boolean {
    return this.props.showDonorNames && !this.props.privacyMode;
  }

  /** Messages are visible only when explicitly enabled and privacy mode is off. */
  messagesVisible(): boolean {
    return this.props.showDonorMessages && !this.props.privacyMode;
  }

  amountsVisible(): boolean {
    return this.props.showAmounts;
  }

  end(): void {
    if (this.props.status === 'ended') return;
    this.props.status = 'ended';
    this.props.endedAt = new Date();
  }

  updatePrivacy(update: LiveSessionPrivacyUpdate): void {
    if (update.showDonorNames !== undefined) {
      this.props.showDonorNames = update.showDonorNames;
    }
    if (update.showDonorMessages !== undefined) {
      this.props.showDonorMessages = update.showDonorMessages;
    }
    if (update.showAmounts !== undefined) {
      this.props.showAmounts = update.showAmounts;
    }
    if (update.privacyMode !== undefined) {
      this.props.privacyMode = update.privacyMode;
    }
  }

  rotateOverlayToken(token: string): void {
    this.props.overlayToken = token;
  }

  toPlain(): LiveSessionProps {
    return { ...this.props, stats: { ...this.props.stats } };
  }
}

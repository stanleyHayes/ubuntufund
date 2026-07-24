import { CollaboratorRole, CollaborationStatus } from '@ubuntu-fund/types';

export interface CollaborationProps {
  id: string;
  campaignId: string;
  /** The user/org being invited to collaborate */
  userId: string;
  /** The user/org who sent the invitation */
  invitedBy: string;
  role: CollaboratorRole;
  status: CollaborationStatus;
  revenueSharePercent: number;
  displayName: string;
  logoUrl?: string;
  inviteMessage?: string;
  respondedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReinviteParams {
  invitedBy: string;
  role: CollaboratorRole;
  revenueSharePercent: number;
  inviteMessage?: string;
}

export class CollaborationEntity {
  private props: CollaborationProps;

  constructor(props: CollaborationProps) {
    if (props.revenueSharePercent < 0 || props.revenueSharePercent > 100) {
      throw new Error('Revenue share percent must be between 0 and 100');
    }
    this.props = { ...props };
  }

  get id(): string {
    return this.props.id;
  }
  get campaignId(): string {
    return this.props.campaignId;
  }
  get userId(): string {
    return this.props.userId;
  }
  get invitedBy(): string {
    return this.props.invitedBy;
  }
  get role(): CollaboratorRole {
    return this.props.role;
  }
  get status(): CollaborationStatus {
    return this.props.status;
  }
  get revenueSharePercent(): number {
    return this.props.revenueSharePercent;
  }
  get displayName(): string {
    return this.props.displayName;
  }
  get logoUrl(): string | undefined {
    return this.props.logoUrl;
  }
  get inviteMessage(): string | undefined {
    return this.props.inviteMessage;
  }
  get respondedAt(): Date | undefined {
    return this.props.respondedAt;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  isPending(): boolean {
    return this.props.status === CollaborationStatus.PENDING;
  }

  accept(): void {
    if (!this.isPending()) {
      throw new Error('Only pending invitations can be accepted');
    }
    this.props.status = CollaborationStatus.ACCEPTED;
    this.props.respondedAt = new Date();
    this.props.updatedAt = new Date();
  }

  decline(): void {
    if (!this.isPending()) {
      throw new Error('Only pending invitations can be declined');
    }
    this.props.status = CollaborationStatus.DECLINED;
    this.props.respondedAt = new Date();
    this.props.updatedAt = new Date();
  }

  remove(): void {
    if (this.props.status === CollaborationStatus.REMOVED) {
      throw new Error('Collaborator has already been removed');
    }
    this.props.status = CollaborationStatus.REMOVED;
    this.props.updatedAt = new Date();
  }

  /** Reactivate a declined/removed record as a fresh pending invitation. */
  reinvite(params: ReinviteParams): void {
    if (
      params.revenueSharePercent < 0 ||
      params.revenueSharePercent > 100
    ) {
      throw new Error('Revenue share percent must be between 0 and 100');
    }
    this.props.invitedBy = params.invitedBy;
    this.props.role = params.role;
    this.props.revenueSharePercent = params.revenueSharePercent;
    this.props.inviteMessage = params.inviteMessage;
    this.props.status = CollaborationStatus.PENDING;
    this.props.respondedAt = undefined;
    this.props.updatedAt = new Date();
  }

  toPlain(): CollaborationProps {
    return { ...this.props };
  }
}

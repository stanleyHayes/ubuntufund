export type DomainEventType =
  | 'user.registered'
  | 'user.verified'
  | 'campaign.created'
  | 'campaign.approved'
  | 'campaign.rejected'
  | 'campaign.funded'
  | 'campaign.blocked'
  | 'donation.created'
  | 'donation.completed'
  | 'milestone.reached'
  | 'milestone.released'
  | 'dispute.opened'
  | 'dispute.resolved'
  | 'verification.submitted'
  | 'verification.approved'
  | 'verification.rejected'
  | 'subscription.created'
  | 'subscription.cancelled'
  | 'refund.requested'
  | 'refund.processed'
  | 'comment.added'
  | 'collaboration.invited';

export interface DomainEvent<T = unknown> {
  id: string;
  type: DomainEventType;
  payload: T;
  aggregateId: string;
  aggregateType: string;
  occurredAt: Date;
}

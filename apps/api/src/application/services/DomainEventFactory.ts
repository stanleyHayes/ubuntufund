import { randomUUID } from 'crypto';
import type { DomainEvent, DomainEventType } from '@ubuntu-fund/types';

export class DomainEventFactory {
  static create<T>(
    type: DomainEventType,
    payload: T,
    aggregateId: string,
    aggregateType: string
  ): DomainEvent<T> {
    return {
      id: randomUUID(),
      type,
      payload,
      aggregateId,
      aggregateType,
      occurredAt: new Date(),
    };
  }
}

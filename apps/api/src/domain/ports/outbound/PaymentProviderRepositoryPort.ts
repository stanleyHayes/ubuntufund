import type { PaymentProviderEntity } from '../../entities/PaymentProvider.js';

export interface PaymentProviderRepositoryPort {
  /** All providers, seeding sensible defaults first if the collection is empty. */
  findAll(): Promise<PaymentProviderEntity[]>;
  /** Only enabled providers, seeding sensible defaults first if the collection is empty. */
  findEnabled(): Promise<PaymentProviderEntity[]>;
  findById(id: string): Promise<PaymentProviderEntity | null>;
  /**
   * Flips the enabled flag and persists it. Returns the updated entity, or
   * null when no provider exists with the given id.
   */
  toggleEnabled(id: string): Promise<PaymentProviderEntity | null>;
}

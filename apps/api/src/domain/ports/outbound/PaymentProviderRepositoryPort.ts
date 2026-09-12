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

  /**
   * Whether a gateway rail is switched on in the admin dashboard.
   *
   * Fails open on any read problem: this sits in the donation path, and a
   * database hiccup must not stop the platform taking money.
   */
  isGatewayEnabled(slug: string): Promise<boolean>;
}

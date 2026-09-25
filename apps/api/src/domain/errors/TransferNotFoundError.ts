/**
 * The provider has no transfer under this reference (HTTP 404 / "Transfer not
 * found" on verify). Never proof on its own that money did not move — a
 * just-created transfer can lag — so callers only escalate on it after a dwell
 * window, and an admin resolves the payout from there.
 */
export class TransferNotFoundError extends Error {
  constructor(public readonly reference: string) {
    super('The payment provider has no transfer under this reference.');
    this.name = 'TransferNotFoundError';
  }
}

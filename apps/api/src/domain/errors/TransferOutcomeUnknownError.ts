/** Provider may have accepted a transfer. Keep its reference/reservation for reconciliation. */
export class TransferOutcomeUnknownError extends Error {
  constructor() {
    super('Transfer confirmation is pending. Do not submit another transfer; reconciliation will verify this reference.');
    this.name = 'TransferOutcomeUnknownError';
  }
}

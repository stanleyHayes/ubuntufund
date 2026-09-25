/** Re-authentication for sensitive account actions made with an existing session. */
export interface StepUpAuthPort {
  /** Rejects unless `password` is current and, when MFA is on, `code` is valid. */
  verifyStepUp(userId: string, password: string, code?: string): Promise<void>;
}

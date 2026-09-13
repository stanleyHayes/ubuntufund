export interface MfaPort {
  verifyLogin(userId: string, authVersion: string, code?: string): Promise<void>;
}

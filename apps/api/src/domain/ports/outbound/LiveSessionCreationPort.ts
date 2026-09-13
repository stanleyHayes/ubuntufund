export interface LiveSessionCreationPort {
  run<T>(campaignId: string, ownerId: string, userId: string, authVersion: string, work: () => Promise<T>): Promise<T>;
}

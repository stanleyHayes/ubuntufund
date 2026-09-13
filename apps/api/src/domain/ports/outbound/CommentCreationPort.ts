export interface CommentCreationPort {
  run<T>(authorId: string, authVersion: string, campaignId: string, ownerId: string, work: () => Promise<T>): Promise<T>;
}

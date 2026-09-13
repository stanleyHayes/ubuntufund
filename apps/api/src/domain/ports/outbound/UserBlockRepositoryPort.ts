export interface UserBlockRepositoryPort {
  excludedUserIds(userId: string): Promise<string[]>;
  isBlocked(firstUserId: string, secondUserId: string): Promise<boolean>;
  list(userId: string): Promise<string[]>;
  block(userId: string, blockedUserId: string): Promise<void>;
  unblock(userId: string, blockedUserId: string): Promise<void>;
}

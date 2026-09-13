/** Current public profile eligibility; never used to deny private account/funds access. */
export interface PublicProfileVisibilityPort {
  /** Public contributions stay published when only the profile page is private. */
  hiddenContentAuthorIds(userIds: string[], viewerId?: string): Promise<Set<string>>;
  hiddenUserIds(userIds: string[], viewerId?: string): Promise<Set<string>>;
}

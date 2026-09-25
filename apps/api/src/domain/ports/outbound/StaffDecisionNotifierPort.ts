/** In-app service notice about a staff decision on the recipient's own case. */
export interface StaffDecisionNoticeInput {
  /** Stable identity of the decision; at most one notice is written per key. */
  key: string;
  userId?: string;
  title: string;
  body: string;
  path?: string;
}

export interface StaffDecisionNotifierPort {
  notify(notice: StaffDecisionNoticeInput): Promise<void>;
}

/**
 * A creator's public "tip jar" profile (buy-me-a-coffee style): a claimable
 * handle plus the presentation + tipping settings for their public page. Kept
 * separate from the User entity so tips are a self-contained module that does not
 * touch the campaign donation pipeline. Keyed 1:1 to a userId.
 */
export interface CreatorProfileProps {
  id: string;
  userId: string;
  /** Unique, lowercase URL handle: the public page lives at /@{handle}. */
  handle: string;
  displayName: string;
  tagline?: string;
  bio?: string;
  avatarUrl?: string;
  /** Whether the public page currently accepts tips. */
  tipsEnabled: boolean;
  /** Suggested tip amounts (major units) shown as quick-pick buttons. */
  presetAmounts: number[];
  currency: string;
  /** Shown to a supporter after a successful tip. */
  thankYouMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

/** A handle is 3–30 chars: lowercase letters, digits, underscore, hyphen. */
const HANDLE_RE = /^[a-z0-9][a-z0-9_-]{2,29}$/;

export class CreatorProfileEntity {
  private props: CreatorProfileProps;

  constructor(props: CreatorProfileProps) {
    this.props = { ...props };
  }

  static normalizeHandle(raw: string): string {
    return raw.trim().toLowerCase().replace(/^@/, '');
  }

  static isValidHandle(raw: string): boolean {
    return HANDLE_RE.test(CreatorProfileEntity.normalizeHandle(raw));
  }

  get id(): string {
    return this.props.id;
  }
  get userId(): string {
    return this.props.userId;
  }
  get handle(): string {
    return this.props.handle;
  }
  get displayName(): string {
    return this.props.displayName;
  }
  get tagline(): string | undefined {
    return this.props.tagline;
  }
  get bio(): string | undefined {
    return this.props.bio;
  }
  get avatarUrl(): string | undefined {
    return this.props.avatarUrl;
  }
  get tipsEnabled(): boolean {
    return this.props.tipsEnabled;
  }
  get presetAmounts(): number[] {
    return this.props.presetAmounts;
  }
  get currency(): string {
    return this.props.currency;
  }
  get thankYouMessage(): string | undefined {
    return this.props.thankYouMessage;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  toPlain(): CreatorProfileProps {
    return { ...this.props };
  }
}

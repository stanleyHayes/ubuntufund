export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  push: boolean;
  donationReceipts: boolean;
  campaignUpdates: boolean;
  marketingEmails: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  email: true,
  sms: false,
  push: true,
  donationReceipts: true,
  campaignUpdates: true,
  marketingEmails: false,
};

export interface ProfileProps {
  id: string;
  userId: string;
  phone?: string;
  bio?: string;
  notificationPreferences: NotificationPreferences;
  preferredCurrency: string;
  language: string;
  darkMode: boolean;
  anonymousDonations: boolean;
  showLeaderboards: boolean;
  publicProfile: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class ProfileEntity {
  private props: ProfileProps;

  constructor(props: ProfileProps) {
    this.props = {
      ...props,
      notificationPreferences: { ...props.notificationPreferences },
    };
  }

  static createDefault(userId: string): ProfileEntity {
    const now = new Date();
    return new ProfileEntity({
      id: '',
      userId,
      notificationPreferences: { ...DEFAULT_NOTIFICATION_PREFERENCES },
      preferredCurrency: 'GHS',
      language: 'English',
      darkMode: false,
      anonymousDonations: false,
      showLeaderboards: true,
      publicProfile: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  get id(): string {
    return this.props.id;
  }
  get userId(): string {
    return this.props.userId;
  }
  get phone(): string | undefined {
    return this.props.phone;
  }
  get bio(): string | undefined {
    return this.props.bio;
  }
  get notificationPreferences(): NotificationPreferences {
    return { ...this.props.notificationPreferences };
  }
  get preferredCurrency(): string {
    return this.props.preferredCurrency;
  }
  get language(): string {
    return this.props.language;
  }
  get darkMode(): boolean {
    return this.props.darkMode;
  }
  get anonymousDonations(): boolean {
    return this.props.anonymousDonations;
  }
  get showLeaderboards(): boolean {
    return this.props.showLeaderboards;
  }
  get publicProfile(): boolean {
    return this.props.publicProfile;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  updateContactInfo(input: { phone?: string; bio?: string }): void {
    if (input.phone !== undefined) {
      this.props.phone = input.phone;
    }
    if (input.bio !== undefined) {
      this.props.bio = input.bio;
    }
    this.props.updatedAt = new Date();
  }

  updateNotificationPreferences(
    partial: Partial<NotificationPreferences>
  ): void {
    this.props.notificationPreferences = {
      ...this.props.notificationPreferences,
      ...partial,
    };
    this.props.updatedAt = new Date();
  }

  updatePreferences(input: {
    preferredCurrency?: string;
    language?: string;
    darkMode?: boolean;
  }): void {
    if (input.preferredCurrency !== undefined) {
      this.props.preferredCurrency = input.preferredCurrency;
    }
    if (input.language !== undefined) {
      this.props.language = input.language;
    }
    if (input.darkMode !== undefined) {
      this.props.darkMode = input.darkMode;
    }
    this.props.updatedAt = new Date();
  }

  updatePrivacySettings(input: {
    anonymousDonations?: boolean;
    showLeaderboards?: boolean;
    publicProfile?: boolean;
  }): void {
    if (input.anonymousDonations !== undefined) {
      this.props.anonymousDonations = input.anonymousDonations;
    }
    if (input.showLeaderboards !== undefined) {
      this.props.showLeaderboards = input.showLeaderboards;
    }
    if (input.publicProfile !== undefined) {
      this.props.publicProfile = input.publicProfile;
    }
    this.props.updatedAt = new Date();
  }

  toPlain(): ProfileProps {
    return {
      ...this.props,
      notificationPreferences: { ...this.props.notificationPreferences },
    };
  }
}

import type { AccountProfileChanges, AccountProfileWritePort } from '../../domain/ports/outbound/AccountProfileWritePort.js';
import type { ProfileDTO } from './GetProfileUseCase.js';

export type UpdateProfileInput = AccountProfileChanges;

export class UpdateProfileUseCase {
  constructor(private readonly writer: AccountProfileWritePort) {}

  async execute(userId: string, input: UpdateProfileInput, authVersion = ''): Promise<ProfileDTO> {
    const { user, profile } = await this.writer.write(userId, input, authVersion);
    const userPlain = user.toPlain();
    const profilePlain = profile.toPlain();

    return {
      id: userPlain.id,
      email: userPlain.email.value,
      name: userPlain.name,
      organizationName: userPlain.organizationName,
      avatarUrl: userPlain.avatarUrl,
      coverUrl: userPlain.coverUrl,
      role: userPlain.role,
      verificationLevel: userPlain.verificationLevel,
      trustScore: userPlain.trustScore.value,
      country: userPlain.country,
      phone: profilePlain.phone,
      bio: profilePlain.bio,
      notificationPreferences: profilePlain.notificationPreferences,
      preferredCurrency: profilePlain.preferredCurrency,
      language: profilePlain.language,
      darkMode: profilePlain.darkMode,
      anonymousDonations: profilePlain.anonymousDonations,
      showLeaderboards: profilePlain.showLeaderboards,
      publicProfile: profilePlain.publicProfile,
      createdAt: userPlain.createdAt,
      updatedAt: userPlain.updatedAt,
    };
  }
}

import { UserEntity } from '../../domain/entities/User.js';
import {
  ProfileEntity,
  type NotificationPreferences,
} from '../../domain/entities/Profile.js';
import type { UserRepositoryPort } from '../../domain/ports/outbound/UserRepositoryPort.js';
import type { ProfileRepositoryPort } from '../../domain/ports/outbound/ProfileRepositoryPort.js';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';
import type { ProfileDTO } from './GetProfileUseCase.js';

export interface UpdateProfileInput {
  name?: string;
  phone?: string;
  bio?: string;
  country?: string;
  notificationPreferences?: Partial<NotificationPreferences>;
  preferredCurrency?: string;
  language?: string;
  darkMode?: boolean;
  anonymousDonations?: boolean;
  showLeaderboards?: boolean;
  publicProfile?: boolean;
}

export class UpdateProfileUseCase {
  constructor(
    private readonly userRepo: UserRepositoryPort,
    private readonly profileRepo: ProfileRepositoryPort
  ) {}

  async execute(
    userId: string,
    input: UpdateProfileInput
  ): Promise<ProfileDTO> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    let updatedUser = user;
    if (input.name !== undefined || input.country !== undefined) {
      const plain = user.toPlain();
      const nextUser = new UserEntity({
        ...plain,
        name: input.name ?? plain.name,
        country: input.country ?? plain.country,
      });
      updatedUser = await this.userRepo.update(nextUser);
    }

    let profile = await this.profileRepo.findByUserId(userId);
    const isNewProfile = !profile;
    if (!profile) {
      profile = ProfileEntity.createDefault(userId);
    }

    profile.updateContactInfo({ phone: input.phone, bio: input.bio });
    if (input.notificationPreferences) {
      profile.updateNotificationPreferences(input.notificationPreferences);
    }
    profile.updatePreferences({
      preferredCurrency: input.preferredCurrency,
      language: input.language,
      darkMode: input.darkMode,
    });
    profile.updatePrivacySettings({
      anonymousDonations: input.anonymousDonations,
      showLeaderboards: input.showLeaderboards,
      publicProfile: input.publicProfile,
    });

    const savedProfile = isNewProfile
      ? await this.profileRepo.save(profile)
      : await this.profileRepo.update(profile);

    const userPlain = updatedUser.toPlain();
    const profilePlain = savedProfile.toPlain();

    return {
      id: userPlain.id,
      email: userPlain.email.value,
      name: userPlain.name,
      avatarUrl: userPlain.avatarUrl,
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

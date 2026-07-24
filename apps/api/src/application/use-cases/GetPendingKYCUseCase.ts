import type {
  KYCRepositoryPort,
  KYCVerificationRecord,
} from '../../domain/ports/outbound/KYCRepositoryPort.js';
import type { UserRepositoryPort } from '../../domain/ports/outbound/UserRepositoryPort.js';

/** KYC verification enriched with the submitting user's display name, for the admin queue. */
export type AdminKYCVerificationDTO = KYCVerificationRecord & {
  userName: string;
};

export class GetPendingKYCUseCase {
  constructor(
    private readonly kycRepo: KYCRepositoryPort,
    private readonly userRepo: UserRepositoryPort
  ) {}

  async execute(): Promise<AdminKYCVerificationDTO[]> {
    const records = await this.kycRepo.findPending();

    const userIds = Array.from(new Set(records.map((r) => r.userId)));
    const userNameById = new Map<string, string>();
    await Promise.all(
      userIds.map(async (id) => {
        const user = await this.userRepo.findById(id);
        userNameById.set(id, user ? user.name : 'Unknown User');
      })
    );

    return records.map((record) => ({
      ...record,
      userName: userNameById.get(record.userId) ?? 'Unknown User',
    }));
  }
}

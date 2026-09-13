import type { UserEntity } from '../../entities/User.js';

export interface UserRepositoryPort {
  save(user: UserEntity): Promise<UserEntity>;
  findById(id: string): Promise<UserEntity | null>;
  findByEmail(email: string): Promise<UserEntity | null>;
  update(user: UserEntity): Promise<UserEntity>;
  /** Raise KYC level without rewriting credentials, consent or other account fields. */
  raiseVerificationLevel(id: string, level: number): Promise<boolean>;
  delete(id: string): Promise<void>;
}

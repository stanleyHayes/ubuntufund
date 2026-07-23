import type { CreateUserInput, LoginInput, AuthTokens, User } from '@ubuntu-fund/types';

export interface AuthServicePort {
  register(input: CreateUserInput): Promise<{ user: User; tokens: AuthTokens }>;
  login(input: LoginInput): Promise<{ user: User; tokens: AuthTokens }>;
  refreshToken(token: string): Promise<AuthTokens>;
}

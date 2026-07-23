import * as jwt from 'jsonwebtoken';
import type { AuthTokens } from '@ubuntu-fund/types';

export interface TokenPayload {
  userId: string;
  role: string;
}

export class AuthTokenService {
  constructor(
    private readonly jwtSecret: string,
    private readonly jwtRefreshSecret: string,
    private readonly accessTokenTTL: string = '15m',
    private readonly refreshTokenTTL: string = '7d'
  ) {}

  generateTokens(payload: TokenPayload): AuthTokens {
    const accessToken = jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.accessTokenTTL as jwt.SignOptions['expiresIn'],
    });

    const refreshToken = jwt.sign(payload, this.jwtRefreshSecret, {
      expiresIn: this.refreshTokenTTL as jwt.SignOptions['expiresIn'],
    });

    return { accessToken, refreshToken };
  }

  verifyAccessToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, this.jwtSecret) as TokenPayload;
    } catch {
      throw new Error('Invalid or expired access token');
    }
  }

  verifyRefreshToken(token: string): TokenPayload {
    try {
      return jwt.verify(token, this.jwtRefreshSecret) as TokenPayload;
    } catch {
      throw new Error('Invalid or expired refresh token');
    }
  }

  refreshTokens(refreshToken: string): AuthTokens {
    const payload = this.verifyRefreshToken(refreshToken);
    return this.generateTokens({
      userId: payload.userId,
      role: payload.role,
    });
  }
}

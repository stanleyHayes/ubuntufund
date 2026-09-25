import { randomUUID } from 'node:crypto';
import * as jwt from 'jsonwebtoken';
import type { AuthTokens } from '@ubuntu-fund/types';
import {
  InMemoryTokenRevocationStore,
  type TokenRevocationStore,
} from './TokenRevocationStore.js';

export interface TokenPayload {
  userId: string;
  role: string;
  authVersion?: string;
  /**
   * Session id (`sid` claim), stable across refreshes of one sign-in so the
   * session can be signed out on the server. A new id is minted when absent.
   */
  sessionId?: string;
}

type DecodedToken = jwt.JwtPayload & TokenPayload & { sid?: string };

function toPayload(decoded: DecodedToken): TokenPayload {
  return {
    userId: decoded.userId,
    role: decoded.role,
    ...(decoded.authVersion !== undefined ? { authVersion: decoded.authVersion } : {}),
    ...(typeof decoded.sid === 'string' ? { sessionId: decoded.sid } : {}),
  };
}

export class AuthTokenService {
  constructor(
    private readonly jwtSecret: string,
    private readonly jwtRefreshSecret: string,
    private readonly accessTokenTTL: string = '15m',
    private readonly refreshTokenTTL: string = '7d',
    private readonly revocationStore: TokenRevocationStore = new InMemoryTokenRevocationStore()
  ) {}

  /** Invalidate every outstanding token for the user (e.g. after a password change). */
  revokeAllTokens(userId: string): void {
    this.revocationStore.revokeAllForUser(userId);
  }

  private assertNotRevoked(decoded: jwt.JwtPayload & TokenPayload): void {
    if (decoded.iat && this.revocationStore.isRevoked(decoded.userId, decoded.iat * 1000)) {
      throw new Error('Token has been revoked');
    }
  }

  generateTokens(payload: TokenPayload, options?: { iatSeconds?: number }): AuthTokens {
    const { sessionId, ...rest } = payload;
    const base = { ...rest, sid: sessionId ?? randomUUID() };
    const claims = options?.iatSeconds ? { ...base, iat: options.iatSeconds } : base;
    const accessToken = jwt.sign(claims, this.jwtSecret, {
      expiresIn: this.accessTokenTTL as jwt.SignOptions['expiresIn'],
    });

    const refreshToken = jwt.sign(claims, this.jwtRefreshSecret, {
      expiresIn: this.refreshTokenTTL as jwt.SignOptions['expiresIn'],
    });

    return { accessToken, refreshToken };
  }

  /**
   * Revoke every outstanding token for the user, then mint a fresh pair that
   * survives the revocation cutoff. JWT iat has second granularity while the
   * cutoff is milliseconds, so the fresh pair is issued one second in the
   * future — otherwise it would be flagged as revoked by its own cutoff.
   */
  rotateAllTokens(payload: TokenPayload): AuthTokens {
    this.revokeAllTokens(payload.userId);
    return this.generateTokens(payload, {
      iatSeconds: Math.floor(Date.now() / 1000) + 1,
    });
  }

  verifyAccessToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as DecodedToken;
      this.assertNotRevoked(decoded);
      return toPayload(decoded);
    } catch {
      throw new Error('Invalid or expired access token');
    }
  }

  /**
   * The session id of a refresh token whose signature is valid, even if it has
   * expired or been revoked. Used only to sign that session out.
   */
  refreshTokenSessionId(token: string): { userId: string; sessionId: string } | null {
    try {
      const decoded = jwt.verify(token, this.jwtRefreshSecret, { ignoreExpiration: true }) as DecodedToken;
      return typeof decoded.sid === 'string' && typeof decoded.userId === 'string' ? { userId: decoded.userId, sessionId: decoded.sid } : null;
    } catch {
      return null;
    }
  }

  verifyRefreshToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, this.jwtRefreshSecret) as DecodedToken;
      this.assertNotRevoked(decoded);
      return toPayload(decoded);
    } catch {
      throw new Error('Invalid or expired refresh token');
    }
  }

  refreshTokens(refreshToken: string): AuthTokens {
    const payload = this.verifyRefreshToken(refreshToken);
    return this.generateTokens({
      userId: payload.userId,
      role: payload.role,
      authVersion: payload.authVersion,
      sessionId: payload.sessionId,
    });
  }
}

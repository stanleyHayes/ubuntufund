import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcryptjs';
import QRCode from 'qrcode';
import type { MfaPort } from '../../../../domain/ports/outbound/MfaPort.js';
import type { AuthTokenService } from '../../../../application/services/AuthTokenService.js';
import { TotpCipher, matchTotp, newRecoveryCodes, newTotpSecret, recoveryDigest } from '../../../../application/services/Totp.js';
import { MfaModel } from '../../../database/models/MfaModel.js';
import { UserModel } from '../../../database/models/UserModel.js';
import { AuditLogModel } from '../../../database/models/AuditLogModel.js';
import { MongoUnitOfWork } from './MongoUnitOfWork.js';
import { AppError } from '../../inbound/middleware/errorHandler.js';

const invalid = () => new AppError('Enter a valid authenticator code or an unused recovery code.', 401, { mfaCode: ['required'] });
export class MongoMfa implements MfaPort {
  private readonly cipher: TotpCipher;
  constructor(key: string, private readonly tokens: AuthTokenService, private readonly publicWebUrl: string) { this.cipher = new TotpCipher(key); }
  private requireConfigured() { if (!this.cipher.configured) throw new AppError('Authenticator setup is temporarily unavailable.', 503); }
  async status(userId: string) {
    const row = await MfaModel.findOne({ userId });
    return { enabled: row?.enabled ?? false, available: this.cipher.configured, recoveryCodesRemaining: row?.enabled ? row.recoveryHashes.length : 0 };
  }
  private async password(userId: string, password: string) {
    const user = await UserModel.findOne({ _id: userId, deletedAt: { $exists: false } });
    if (!user || !await bcrypt.compare(password, user.passwordHash)) throw new AppError('Current password is incorrect.', 401);
    return user;
  }
  async begin(userId: string, password: string) {
    this.requireConfigured();
    const user = await this.password(userId, password);
    const secret = newTotpSecret(), enrollmentId = randomUUID(), expiresAt = new Date(Date.now() + 10 * 60_000);
    const secretCipher = this.cipher.encrypt(secret, userId);
    await new MongoUnitOfWork().run(async () => {
      const existing = await MfaModel.findOne({ userId });
      if (existing?.enabled) throw new AppError('Authenticator protection is already enabled.', 409);
      await MfaModel.findOneAndUpdate({ userId }, { $set: { secretCipher, enrollmentId, enrollmentAuthVersion: user.authVersion ?? '', expiresAt, enabled: false, lastCounter: -1, recoveryHashes: [], attempts: 0, windowUntil: new Date(0) } }, { upsert: true });
    });
    const params = new URLSearchParams({ secret, issuer: 'Ujimora', algorithm: 'SHA1', digits: '6', period: '30', image: new URL('/favicon-192.png', this.publicWebUrl).href });
    const uri = `otpauth://totp/${encodeURIComponent(`Ujimora:${user.email}`)}?${params}`;
    return { enrollmentId, secret, uri, qrCode: await QRCode.toDataURL(uri, { errorCorrectionLevel: 'M', width: 320, margin: 4 }), expiresAt };
  }
  private async reserveAttempt(userId: string) {
    const now = new Date();
    await MfaModel.updateOne({ userId, windowUntil: { $lte: now } }, { $set: { attempts: 0, windowUntil: new Date(now.getTime() + 10 * 60_000) } });
    if (!await MfaModel.findOneAndUpdate({ userId, attempts: { $lt: 10 } }, { $inc: { attempts: 1 } })) throw new AppError('Too many code attempts. Try again in 10 minutes.', 429);
  }
  private async consume(userId: string, code: string) {
    const row = await MfaModel.findOne({ userId, enabled: true });
    if (!row) throw invalid();
    if (/^[a-fA-F0-9\s-]+$/.test(code) && code.replace(/[\s-]/g, '').length === 32) {
      const digest = recoveryDigest(code);
      if (!(await MfaModel.updateOne({ _id: row._id, enabled: true, recoveryHashes: digest }, { $pull: { recoveryHashes: digest } })).modifiedCount) throw invalid();
    } else {
      this.requireConfigured();
      const counter = matchTotp(this.cipher.decrypt(row.secretCipher, userId), code);
      if (counter === null || !(await MfaModel.updateOne({ _id: row._id, enabled: true, secretCipher: row.secretCipher, lastCounter: { $lt: counter } }, { $set: { lastCounter: counter } })).modifiedCount) throw invalid();
    }
  }
  async verifyLogin(userId: string, authVersion: string, code?: string) {
    const row = await MfaModel.findOne({ userId, enabled: true });
    if (!row) return;
    if (!code) throw invalid();
    await this.reserveAttempt(userId);
    await new MongoUnitOfWork().run(async () => {
      const user = await UserModel.findOne({ _id: userId, deletedAt: { $exists: false } });
      if (!user || (user.authVersion ?? '') !== authVersion) throw invalid();
      await this.consume(userId, code);
    });
  }
  private async rotateSessions(userId: string, passwordHash: string, action: string) {
    const authVersion = randomUUID();
    const user = await UserModel.findOneAndUpdate({ _id: userId, passwordHash, deletedAt: { $exists: false } }, { $set: { authVersion } }, { new: true });
    if (!user) throw new AppError('Account changed. Sign in and try again.', 409);
    await AuditLogModel.create({ actorId: userId, actorRole: user.role, action, resource: 'account-security', details: action, method: 'POST', path: '/auth/mfa', statusCode: 200 });
    return this.tokens.generateTokens({ userId, role: user.role, authVersion });
  }
  async enable(userId: string, password: string, enrollmentId: string, code: string) {
    const user = await this.password(userId, password);
    await this.reserveAttempt(userId);
    return new MongoUnitOfWork().run(async () => {
      this.requireConfigured();
      const row = await MfaModel.findOne({ userId, enabled: false, enrollmentId, enrollmentAuthVersion: user.authVersion ?? '', expiresAt: { $gt: new Date() } });
      if (!row) throw new AppError('Setup expired or changed. Start authenticator setup again.', 409);
      const counter = matchTotp(this.cipher.decrypt(row.secretCipher, userId), code);
      if (counter === null) throw invalid();
      const recoveryCodes = newRecoveryCodes();
      await MfaModel.updateOne({ _id: row._id }, { $set: { enabled: true, lastCounter: counter, recoveryHashes: recoveryCodes.map(recoveryDigest) }, $unset: { expiresAt: 1, enrollmentAuthVersion: 1 } });
      const tokens = await this.rotateSessions(userId, user.passwordHash, 'mfa.enabled');
      return { recoveryCodes, tokens };
    });
  }
  async change(userId: string, password: string, code: string, disable: boolean) {
    const user = await this.password(userId, password);
    await this.reserveAttempt(userId);
    return new MongoUnitOfWork().run(async () => {
      await this.consume(userId, code);
      const recoveryCodes = disable ? [] : newRecoveryCodes();
      if (disable) await MfaModel.deleteOne({ userId });
      else await MfaModel.updateOne({ userId }, { $set: { recoveryHashes: recoveryCodes.map(recoveryDigest) } });
      const tokens = await this.rotateSessions(userId, user.passwordHash, disable ? 'mfa.disabled' : 'mfa.recovery-regenerated');
      return { tokens, recoveryCodes };
    });
  }
}

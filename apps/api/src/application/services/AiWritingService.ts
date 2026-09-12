import { isObjectIdOrHexString } from 'mongoose'
import { UserModel } from '../../infrastructure/database/models/UserModel.js'
import type { AiWritingRequest } from '@ubuntu-fund/types'
import type { AiWritingProviderPort } from '../../domain/ports/outbound/AiWritingProviderPort.js'
import { AiQuotaModel, AiUsageModel } from '../../infrastructure/database/models/AiUsageModel.js'
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js'
export class AiWritingService {
  constructor(
    private readonly provider: AiWritingProviderPort,
    private readonly dailyLimit: number,
    private readonly globalDailyLimit: number,
  ) {}
  private key(userId: string) {
    return `${new Date().toISOString().slice(0, 10)}:${userId}`
  }
  async configuration(userId: string) {
    const quota = await AiQuotaModel.findById(this.key(userId)).lean()
    return {
      enabled: this.provider.isConfigured(),
      dailyLimit: this.dailyLimit,
      remainingRequests: Math.max(0, this.dailyLimit - (quota?.used ?? 0)),
    }
  }
  /**
   * Claim one unit of quota, or refuse because the cap is genuinely reached.
   *
   * The upsert makes a duplicate-key error ambiguous, and conflating the two
   * meanings was a bug: with no quota document yet, concurrent callers all fail
   * the `used < limit` filter (nothing matches), all attempt the insert, one
   * wins and the rest get E11000. Reporting that as "daily limit reached" told
   * users their cap was spent when not a single request had been served.
   *
   * A retry disambiguates. Once the document exists the filter does its real
   * job, so a second E11000 — or a null result — means the cap truly is full.
   * The loop is bounded: every collision implies another writer succeeded, so
   * it cannot spin.
   */
  private async reserve(key: string, limit: number) {
    const atCap = () =>
      new AppError(
        'The daily AI writing limit has been reached. Please try again tomorrow (UTC).',
        429,
      )

    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        const reserved = await AiQuotaModel.findOneAndUpdate(
          { _id: key, used: { $lt: limit } },
          { $inc: { used: 1 }, $setOnInsert: { expiresAt: new Date(Date.now() + 3 * 86400000) } },
          { upsert: true, new: true },
        )
        if (reserved) return reserved
        // Filter matched nothing and no insert happened: the cap is real.
        throw atCap()
      } catch (error) {
        if ((error as { code?: number }).code !== 11000) throw error
        // Someone else created or advanced the document. Look again.
      }
    }
    throw atCap()
  }
  async write(userId: string, input: AiWritingRequest) {
    if (!this.provider.isConfigured()) throw new AppError('AI writing is not configured', 503)
    const userKey = this.key(userId),
      globalKey = this.key('platform')
    const quota = await this.reserve(userKey, this.dailyLimit)
    try {
      await this.reserve(globalKey, this.globalDailyLimit)
    } catch (error) {
      await AiQuotaModel.updateOne({ _id: userKey }, { $inc: { used: -1 } })
      throw error
    }
    // Usage is persisted before the billable request; raw input/output is never stored.
    const usage = await AiUsageModel.create({
      userId,
      action: input.action,
      inputLength: input.text.length + (input.prompt?.length ?? 0),
    })
    try {
      const result = await this.provider.write(input)
      await AiUsageModel.updateOne(
        { _id: usage.id },
        {
          $set: {
            status: 'success',
            outputLength: result.text.length,
            model: result.model,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
          },
        },
      )
      return {
        result: result.text,
        action: input.action,
        originalLength: input.text.length,
        resultLength: result.text.length,
        remainingRequests: Math.max(0, this.dailyLimit - quota!.used!),
      }
    } catch (error) {
      await AiUsageModel.updateOne({ _id: usage.id }, { $set: { status: 'error' } })
      throw error
    }
  }
  async stats() {
    const now = new Date(),
      today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
      month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const [data] = await AiUsageModel.aggregate([
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          requestsToday: { $sum: { $cond: [{ $gte: ['$timestamp', today] }, 1, 0] } },
          requestsThisMonth: { $sum: { $cond: [{ $gte: ['$timestamp', month] }, 1, 0] } },
          lastUsedAt: { $max: '$timestamp' },
          inputTokens: { $sum: '$inputTokens' },
          outputTokens: { $sum: '$outputTokens' },
          errors: { $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] } },
        },
      },
    ])
    return {
      userId: 'platform',
      totalRequests: 0,
      requestsToday: 0,
      requestsThisMonth: 0,
      lastUsedAt: null,
      inputTokens: 0,
      outputTokens: 0,
      errors: 0,
      ...data,
      enabled: this.provider.isConfigured(),
    }
  }
  async usage(page: number, pageSize: number) {
    const [rows, total] = await Promise.all([
      AiUsageModel.find()
        .sort({ timestamp: -1, _id: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      AiUsageModel.countDocuments(),
    ])
    const users = await UserModel.find({
      _id: { $in: rows.map((row) => row.userId).filter(isObjectIdOrHexString) },
    })
      .select('_id name')
      .lean()
    const names = new Map(users.map((user) => [user._id.toString(), user.name]))
    return {
      data: rows.map(({ _id, __v, ...row }) => ({
        ...row,
        userName: names.get(row.userId) || 'Unavailable account',
        id: _id.toString(),
      })),
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    }
  }
}

import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../../middleware/validate.js'
import { donationIntentRateLimiter } from '../../middleware/rateLimiter.js'
import type { AuthenticatedRequest, createAuthMiddleware } from '../../middleware/authMiddleware.js'
import type { PayoutAccountService } from '../../../../../application/services/PayoutAccountService.js'
export function createPayoutAccountRoutes(
  service: PayoutAccountService,
  auth: ReturnType<typeof createAuthMiddleware>,
) {
  const r = Router()
  r.use(auth)
  r.get('/', async (req: AuthenticatedRequest, res, next) => {
    try {
      res.json({ data: await service.list(req.userId!) })
    } catch (e) {
      next(e)
    }
  })
  r.post(
    '/',
    donationIntentRateLimiter,
    validate(
      z.object({
        type: z.enum(['ghipss', 'mobile_money']),
        accountNumber: z.string().trim().min(1).max(50),
        bankCode: z.string().trim().min(1).max(20),
        accountName: z.string().trim().min(2).max(200),
      }),
    ),
    async (req: AuthenticatedRequest, res, next) => {
      try {
        await service.add(req.userId!, req.body)
        res.status(201).json({ data: await service.list(req.userId!) })
      } catch (e) {
        next(e)
      }
    },
  )
  r.delete('/:id', async (req: AuthenticatedRequest, res, next) => {
    try {
      await service.remove(req.userId!, req.params.id as string)
      res.json({ data: await service.list(req.userId!) })
    } catch (e) {
      next(e)
    }
  })
  return r
}

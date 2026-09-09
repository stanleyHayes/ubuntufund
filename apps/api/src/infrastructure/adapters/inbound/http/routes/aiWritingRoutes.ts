import { Router, type RequestHandler } from 'express'
import { z } from 'zod'
import { AiWritingAction } from '@ubuntu-fund/types'
import type { AiWritingService } from '../../../../../application/services/AiWritingService.js'
import type { AuthenticatedRequest, createAuthMiddleware } from '../../middleware/authMiddleware.js'
import { AppError } from '../../middleware/errorHandler.js'
import { validate } from '../../middleware/validate.js'
const inputSchema = z
  .object({
    text: z.string().trim().min(1).max(12000),
    action: z.nativeEnum(AiWritingAction),
    prompt: z.string().trim().max(1000).optional(),
    targetLanguage: z.string().trim().min(2).max(60).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.action === AiWritingAction.TRANSLATE && !value.targetLanguage)
      ctx.addIssue({
        code: 'custom',
        path: ['targetLanguage'],
        message: 'Select the language to translate into',
      })
  })
export function createAiWritingRoutes(
  service: AiWritingService,
  auth: ReturnType<typeof createAuthMiddleware>,
  requireAdmin: RequestHandler,
) {
  const router = Router()
  router.use(auth)
  router.get('/config', async (req: AuthenticatedRequest, res, next) => {
    try {
      res.set('Cache-Control', 'no-store').json({ data: await service.configuration(req.userId!) })
    } catch (error) {
      next(error)
    }
  })
  router.post('/', validate(inputSchema), async (req: AuthenticatedRequest, res, next) => {
    try {
      res
        .set('Cache-Control', 'no-store')
        .json({ data: await service.write(req.userId!, inputSchema.parse(req.body)) })
    } catch (error) {
      next(error)
    }
  })
  router.get('/stats', requireAdmin, async (_req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store').json({ data: await service.stats() })
    } catch (error) {
      next(error)
    }
  })
  router.get('/usage', requireAdmin, async (req, res, next) => {
    try {
      const { page, pageSize } = z
        .object({
          page: z.coerce.number().int().min(1).max(100000).default(1),
          pageSize: z.coerce.number().int().min(1).max(100).default(20),
        })
        .parse(req.query)
      res.set('Cache-Control', 'no-store').json({ data: await service.usage(page, pageSize) })
    } catch (error) {
      next(error instanceof z.ZodError ? new AppError('Invalid pagination', 400) : error)
    }
  })
  return router
}

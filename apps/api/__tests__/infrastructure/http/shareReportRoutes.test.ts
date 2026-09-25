import { describe, expect, it, vi } from 'vitest'
import express, { type NextFunction, type Response } from 'express'
import request from 'supertest'
import { CAMPAIGN_REPORT_REASONS } from '@ubuntu-fund/types'
import { createShareReportRoutes } from '../../../src/infrastructure/adapters/inbound/http/routes/shareReportRoutes.js'
import type { ShareReportController } from '../../../src/infrastructure/adapters/inbound/http/controllers/ShareReportController.js'
import type { AuthenticatedRequest, createAuthMiddleware } from '../../../src/infrastructure/adapters/inbound/middleware/authMiddleware.js'
import { errorHandler } from '../../../src/infrastructure/adapters/inbound/middleware/errorHandler.js'

// Contract: every reason the web and native report forms offer (the shared
// CAMPAIGN_REPORT_REASONS list) must pass the route validator, and free text
// such as the old native 'Flagged from mobile' must not.
function buildApp() {
  const report = vi.fn(async (_req: AuthenticatedRequest, res: Response) => {
    res.status(201).json({ data: null, message: 'Report submitted', status: 201 })
  })
  const controller = { share: vi.fn(), report } as unknown as ShareReportController
  const auth = ((req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    req.userId = 'reporter'
    next()
  }) as unknown as ReturnType<typeof createAuthMiddleware>
  const app = express()
  app.use(express.json())
  app.use('/campaigns', createShareReportRoutes(controller, auth))
  app.use(errorHandler)
  return { app, report }
}

describe('POST /campaigns/:id/report reason contract', () => {
  it.each(CAMPAIGN_REPORT_REASONS)('accepts the shared reason %s', async reason => {
    const { app, report } = buildApp()
    const res = await request(app).post('/campaigns/abc/report').send({ reason, description: 'Details' })
    expect(res.status).toBe(201)
    expect(report).toHaveBeenCalledTimes(1)
  })

  it('rejects a reason outside the shared list before reaching the controller', async () => {
    const { app, report } = buildApp()
    const res = await request(app).post('/campaigns/abc/report').send({ reason: 'Flagged from mobile' })
    expect(res.status).toBe(400)
    expect(report).not.toHaveBeenCalled()
  })
})

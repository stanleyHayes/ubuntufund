import { isObjectIdOrHexString } from 'mongoose'
import type { PayoutRepositoryPort } from '../../../../../domain/ports/outbound/PayoutRepositoryPort.js'
import { logger } from '../../../../logging/logger.js'
import { CampaignModel } from '../../../../database/models/CampaignModel.js'
import { UserModel } from '../../../../database/models/UserModel.js'
import type { PayoutTransferControlUseCase } from '../../../../../application/use-cases/PayoutTransferControlUseCase.js'
import type { AutomaticPayoutService } from '../../../outbound/payments/AutomaticPayoutService.js'
import type { GetCampaignPayoutOptionsUseCase } from '../../../../../application/use-cases/GetCampaignPayoutOptionsUseCase.js'
import type { Request, Response, NextFunction } from 'express'
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js'
import type { ListBanksUseCase } from '../../../../../application/use-cases/ListBanksUseCase.js'
import type { CreatePayoutRecipientUseCase } from '../../../../../application/use-cases/CreatePayoutRecipientUseCase.js'
import type { RequestPayoutUseCase } from '../../../../../application/use-cases/RequestPayoutUseCase.js'
import type { ApprovePayoutUseCase } from '../../../../../application/use-cases/ApprovePayoutUseCase.js'
import type { ListCampaignPayoutsUseCase } from '../../../../../application/use-cases/ListCampaignPayoutsUseCase.js'
import type { ListPayoutsUseCase } from '../../../../../application/use-cases/ListPayoutsUseCase.js'

function firstQueryValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
  return undefined
}

export class PayoutController {
  constructor(
    private readonly listBanksUseCase: ListBanksUseCase,
    private readonly createPayoutRecipientUseCase: CreatePayoutRecipientUseCase,
    private readonly requestPayoutUseCase: RequestPayoutUseCase,
    private readonly approvePayoutUseCase: ApprovePayoutUseCase,
    private readonly listCampaignPayoutsUseCase: ListCampaignPayoutsUseCase,
    private readonly listPayoutsUseCase: ListPayoutsUseCase,
    private readonly payoutOptions?: GetCampaignPayoutOptionsUseCase,
    private readonly automaticPayouts?: AutomaticPayoutService,
    private readonly transferControls?: PayoutTransferControlUseCase,
    private readonly payoutRepo?: PayoutRepositoryPort,
  ) {}

  getOptions = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const data = await this.payoutOptions!.execute(req.params.id as string, {
        userId: req.userId!,
        role: req.userRole,
      })
      res.json({ data })
    } catch (error) {
      next(error)
    }
  }

  recipientDetails = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      res.json({
        data: await this.approvePayoutUseCase.recipientDetails(req.params.id as string, {
          userId: req.userId!,
          role: req.userRole,
        }),
      })
    } catch (error) {
      next(error)
    }
  }

  private async adminLabels(payouts: import('@ubuntu-fund/types').Payout[]) {
    const [campaigns, users] = await Promise.all([
      CampaignModel.find({
        _id: { $in: payouts.map((p) => p.campaignId).filter(isObjectIdOrHexString) },
      })
        .select('_id title')
        .lean(),
      UserModel.find({
        _id: {
          $in: payouts
            .flatMap((p) => [p.approvedBy, p.firstApprovedBy])
            .filter(isObjectIdOrHexString),
        },
      })
        .select('_id name')
        .lean(),
    ])
    const names = new Map(users.map((u) => [u._id.toString(), u.name]))
    const titles = new Map(campaigns.map((c) => [c._id.toString(), c.title]))
    const name = (id?: string) =>
      id
        ? names.get(id) || (id.startsWith('system') ? 'System automation' : 'Unavailable account')
        : undefined
    return payouts.map((p) => ({
      ...p,
      campaignTitle: titles.get(p.campaignId) || 'Unavailable campaign',
      approvedByName: name(p.approvedBy),
      firstApprovedByName: name(p.firstApprovedBy),
    }))
  }

  /** How long one provider verification covers a payout, across all callers. */
  private static readonly CHECK_LEASE_MS = 30_000
  /** Back-off after a provider error or a mismatch, so we stop hot-looping. */
  private static readonly CHECK_BACKOFF_MS = 5 * 60_000

  /**
   * POST /campaigns/:id/payouts/:payoutId/refresh — ask the provider where a
   * transfer stands, and settle it if it is done.
   *
   * This used to run inside the payout GETs, which made an ordinary page load
   * capable of issuing live provider calls and settling money: a read that
   * writes balances and posts ledger entries, behind auth alone. Refreshing is a
   * command, so it is now one, and the GETs are pure reads.
   *
   * A Mongo lease bounds it: however many owners, tabs, retries or duplicated
   * mounts call this, the provider is asked at most once per payout per window.
   * The lease lives in its own collection precisely so it does not touch the
   * payout's `updatedAt`, which the reconciler uses to find stuck payouts.
   */
  refreshPayout = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!this.transferControls || !this.payoutRepo) {
        res.json({ data: null, message: 'Refresh unavailable', status: 200 })
        return
      }
      const payoutId = req.params.payoutId as string
      // Authorise through the same read the list uses: it throws unless the
      // caller owns this campaign (or is an admin).
      const payouts = await this.listCampaignPayoutsUseCase.execute(req.params.id as string, {
        userId: req.userId!,
        role: req.userRole,
      })
      const payout = payouts.find((p) => p.id === payoutId)
      if (!payout) {
        res.status(404).json({ data: null, message: 'Payout not found', status: 404 })
        return
      }
      // Only a single-transfer paystack payout in flight can be verified by
      // reference; batched payouts are reconciled leg by leg by the sweep.
      if (payout.provider !== 'paystack' || payout.status !== 'PROCESSING' || payout.legs?.length) {
        res.json({ data: payout, message: 'Payout status', status: 200 })
        return
      }

      const lease = await this.payoutRepo!.tryLeaseProviderCheck(
        payoutId,
        PayoutController.CHECK_LEASE_MS,
      )
      if (!lease.acquired) {
        // Someone already asked inside this window. Serve the stored row and
        // tell the client when asking again is useful.
        res.json({
          data: payout,
          message: 'Payout status',
          status: 200,
          nextCheckAt: lease.nextCheckAt.toISOString(),
        })
        return
      }

      try {
        const refreshed = await this.transferControls.execute(payoutId, 'refresh')
        res.json({ data: refreshed, message: 'Payout status', status: 200 })
      } catch (error) {
        // Back off, then degrade to the stored row: a provider hiccup or the
        // 409 provider/payout mismatch must not break the owner's dashboard,
        // but it must be visible and must not be retried every 30 seconds.
        await this.payoutRepo!.extendProviderCheckLease(
          payoutId,
          PayoutController.CHECK_BACKOFF_MS,
        )
        logger.warn({ error, payoutId }, 'payout refresh failed; serving stored status')
        res.json({ data: payout, message: 'Payout status', status: 200 })
      }
    } catch (error) {
      next(error)
    }
  }

  /** GET /banks?currency=GHS&type=mobile_money — bank / telco directory. */
  listBanks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const banks = await this.listBanksUseCase.execute(
        firstQueryValue(req.query.currency),
        firstQueryValue(req.query.type),
      )
      res.json({ data: banks, message: 'Banks retrieved', status: 200 })
    } catch (error) {
      next(error)
    }
  }

  /** POST /campaigns/:id/payout-recipient — register a recipient (owner). */
  createRecipient = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const recipient = await this.createPayoutRecipientUseCase.execute(
        req.params.id as string,
        req.body,
        { userId: req.userId!, role: req.userRole },
      )
      res.status(201).json({
        data: recipient,
        message: 'Payout recipient added',
        status: 201,
      })
    } catch (error) {
      next(error)
    }
  }

  /** POST /campaigns/:id/payouts — request a payout (owner). */
  requestPayout = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const payout = await this.requestPayoutUseCase.execute(req.params.id as string, req.body, {
        userId: req.userId!,
        role: req.userRole,
      })
      res.status(201).json({
        data: this.automaticPayouts ? await this.automaticPayouts.consider(payout) : payout,
        message: 'Payout requested',
        status: 201,
      })
    } catch (error) {
      next(error)
    }
  }

  /** GET /campaigns/:id/payouts — a campaign's payouts (owner/admin). */
  listCampaignPayouts = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const payouts = await this.listCampaignPayoutsUseCase.execute(req.params.id as string, {
        userId: req.userId!,
        role: req.userRole,
      })
      res.json({ data: payouts, message: 'Payouts retrieved', status: 200 })
    } catch (error) {
      next(error)
    }
  }

  /** POST /payouts/:id/approve — approve + initiate a transfer (admin). */
  approvePayout = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const payout = await this.approvePayoutUseCase.execute(
        req.params.id as string,
        { userId: req.userId!, role: req.userRole },
        req.body.reviewNote,
      )
      res.json({ data: payout, message: 'Payout approved', status: 200 })
    } catch (error) {
      next(error)
    }
  }

  /** GET /payouts — every payout across the platform (admin). */
  listAll = async (
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const payouts = await this.listPayoutsUseCase.execute()
      res.json({ data: await this.adminLabels(payouts), message: 'Payouts retrieved', status: 200 })
    } catch (error) {
      next(error)
    }
  }

  /** GET /payouts/review-queue — payouts needing admin action (NEEDS_REVIEW/PENDING). */
  reviewQueue = async (
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const payouts = await this.listPayoutsUseCase.reviewQueue()
      res.json({
        data: (await this.adminLabels(payouts)).filter((p) =>
          ['PENDING', 'PROCESSING', 'NEEDS_REVIEW'].includes(p.status),
        ),
        message: 'Payout review queue',
        status: 200,
      })
    } catch (error) {
      next(error)
    }
  }
}

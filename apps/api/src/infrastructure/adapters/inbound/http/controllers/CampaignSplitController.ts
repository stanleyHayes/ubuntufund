import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import type { CampaignSplitUseCase } from '../../../../../application/use-cases/CampaignSplitUseCase.js';
import { AppError } from '../../middleware/errorHandler.js';

/**
 * HTTP surface for campaign split-proceeds configuration (spec §17 / ADR-3).
 * The disclosure endpoint is public; the rest are owner/admin (or the
 * beneficiary, for their own consent).
 */
export class CampaignSplitController {
  constructor(private readonly splitUseCase: CampaignSplitUseCase) {}

  /** POST /campaigns/:id/split — create a new (draft) split version (owner). */
  createSplit = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const split = await this.splitUseCase.createSplit(
        req.params.id as string,
        req.body,
        { userId: req.userId!, role: req.userRole }
      );
      res.status(201).json({ data: split, message: 'Split created', status: 201 });
    } catch (error) {
      next(error);
    }
  };

  /** GET /campaigns/:id/split — donor-facing disclosure of the active split. */
  getDisclosure = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const disclosure = await this.splitUseCase.getDisclosure(
        req.params.id as string
      );
      res.json({
        data: disclosure,
        message: disclosure ? 'Split disclosure' : 'No active split',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  /** GET /campaigns/:id/split/versions — all split versions (owner/admin). */
  listVersions = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const versions = await this.splitUseCase.listVersions(
        req.params.id as string,
        { userId: req.userId!, role: req.userRole }
      );
      res.json({ data: versions, message: 'Split versions', status: 200 });
    } catch (error) {
      next(error);
    }
  };

  /** POST /campaigns/:id/split/:version/consent — set a beneficiary's consent. */
  setConsent = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const split = await this.splitUseCase.setConsent(
        req.params.id as string,
        this.parseVersion(req.params.version as string | undefined),
        req.body.beneficiaryId as string,
        req.body.status,
        { userId: req.userId!, role: req.userRole }
      );
      res.json({ data: split, message: 'Consent recorded', status: 200 });
    } catch (error) {
      next(error);
    }
  };

  /** POST /campaigns/:id/split/:version/activate — activate a consented version. */
  activate = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const split = await this.splitUseCase.activate(
        req.params.id as string,
        this.parseVersion(req.params.version as string | undefined),
        { userId: req.userId!, role: req.userRole }
      );
      res.json({ data: split, message: 'Split activated', status: 200 });
    } catch (error) {
      next(error);
    }
  };

  private parseVersion(raw: string | undefined): number {
    const version = Number(raw);
    if (!Number.isInteger(version) || version < 1) {
      throw new AppError('Invalid split version', 400);
    }
    return version;
  }
}

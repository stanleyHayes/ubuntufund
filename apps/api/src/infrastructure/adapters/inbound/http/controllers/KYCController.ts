import { lockPrivateKycDocuments } from '../../../outbound/persistence/lockPrivateKycDocuments.js';
import { MongoKYCWorkflowTransaction } from '../../../outbound/persistence/MongoKYCWorkflowTransaction.js';
import type { GetKYCStatsUseCase } from '../../../../../application/use-cases/GetKYCStatsUseCase.js';
import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import type { SubmitKYCIdentityUseCase } from '../../../../../application/use-cases/SubmitKYCIdentityUseCase.js';
import type { GetKYCStatusUseCase } from '../../../../../application/use-cases/GetKYCStatusUseCase.js';
import type { GetPendingKYCUseCase } from '../../../../../application/use-cases/GetPendingKYCUseCase.js';
import type { ApproveKYCUseCase } from '../../../../../application/use-cases/ApproveKYCUseCase.js';
import type { RejectKYCUseCase } from '../../../../../application/use-cases/RejectKYCUseCase.js';

export class KYCController {
  constructor(
    private readonly submitKYCIdentityUseCase: SubmitKYCIdentityUseCase,
    private readonly getKYCStatusUseCase: GetKYCStatusUseCase,
    private readonly getPendingKYCUseCase: GetPendingKYCUseCase,
    private readonly approveKYCUseCase: ApproveKYCUseCase,
    private readonly rejectKYCUseCase: RejectKYCUseCase,
    private readonly getKYCStatsUseCase: GetKYCStatsUseCase
  ) {}

  getStats = async (_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json({ data: await this.getKYCStatsUseCase.execute(), message: 'KYC statistics retrieved', status: 200 });
    } catch (error) { next(error); }
  };

  submitIdentity = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const record = await new MongoKYCWorkflowTransaction().submit(req.userId!, req.authVersion ?? '', async () => {
        await lockPrivateKycDocuments(req.userId!, req.body.documents ?? []);
        return this.submitKYCIdentityUseCase.execute(req.body, req.userId!);
      });
      res.status(201).json({
        data: record,
        message: 'Identity verification submitted',
        status: 201,
      });
    } catch (error) {
      next(error);
    }
  };

  getStatus = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await this.getKYCStatusUseCase.execute(req.userId!);
      res.setHeader('Cache-Control', 'private, no-store');
      res.json({
        data: result,
        message: 'KYC status retrieved',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  listPending = async (
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await this.getPendingKYCUseCase.execute();
      res.setHeader('Cache-Control', 'private, no-store');
      res.json({
        data: result,
        message: 'Pending KYC verifications retrieved',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  approve = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const record = await new MongoKYCWorkflowTransaction().run(req.params.id as string, req.userId!, req.authVersion ?? '', 'approved', req.body.reviewVersion, () => this.approveKYCUseCase.execute(
        req.params.id as string,
        req.userId!,
        req.body
      ));
      res.json({
        data: record,
        message: 'KYC verification approved',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  reject = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const record = await new MongoKYCWorkflowTransaction().run(req.params.id as string, req.userId!, req.authVersion ?? '', 'rejected', req.body.reviewVersion, () => this.rejectKYCUseCase.execute(
        req.params.id as string,
        req.userId!,
        req.body
      ));
      res.json({
        data: record,
        message: 'KYC verification rejected',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };
}

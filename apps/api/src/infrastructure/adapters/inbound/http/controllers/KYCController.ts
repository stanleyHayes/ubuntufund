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
    private readonly rejectKYCUseCase: RejectKYCUseCase
  ) {}

  submitIdentity = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const record = await this.submitKYCIdentityUseCase.execute(
        req.body,
        req.userId!
      );
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
      const record = await this.approveKYCUseCase.execute(
        req.params.id as string,
        req.userId!,
        req.body
      );
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
      const record = await this.rejectKYCUseCase.execute(
        req.params.id as string,
        req.userId!,
        req.body
      );
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

import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import type { ListUsersUseCase } from '../../../../../application/use-cases/ListUsersUseCase.js';
import type { GetAdminUserUseCase } from '../../../../../application/use-cases/GetAdminUserUseCase.js';
import type { SetComplianceLimitUseCase } from '../../../../../application/use-cases/SetComplianceLimitUseCase.js';

export class AdminUserController {
  constructor(
    private readonly listUsersUseCase: ListUsersUseCase,
    private readonly getAdminUserUseCase: GetAdminUserUseCase,
    private readonly setComplianceLimitUseCase: SetComplianceLimitUseCase
  ) {}

  /** PUT /users/:id/compliance-limit — set/clear the compliance-approved goal cap. */
  setComplianceLimit = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const body = (req.body ?? {}) as { limit?: number | null; reason?: string };
      const result = await this.setComplianceLimitUseCase.execute({
        userId: String(req.params.id),
        limit: body.limit === undefined ? null : body.limit,
        actorId: req.userId,
        actorRole: req.userRole,
        reason: body.reason,
      });
      res.json({ data: result, message: 'Compliance limit updated', status: 200 });
    } catch (error) {
      next(error);
    }
  };

  getById = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const user = await this.getAdminUserUseCase.execute(req.params.id as string);
      res.json({ data: user, message: 'User retrieved', status: 200 });
    } catch (error) {
      next(error);
    }
  };

  list = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const sortBy = (req.query.sortBy as string) ?? 'createdAt';
      const sortOrder = (req.query.sortOrder as 'asc' | 'desc') ?? 'desc';

      const result = await this.listUsersUseCase.execute({
        page,
        pageSize,
        sortBy,
        sortOrder,
      });

      res.json({
        data: result,
        message: 'Users retrieved',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };
}

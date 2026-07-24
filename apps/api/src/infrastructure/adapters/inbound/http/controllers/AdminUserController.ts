import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import type { ListUsersUseCase } from '../../../../../application/use-cases/ListUsersUseCase.js';

export class AdminUserController {
  constructor(private readonly listUsersUseCase: ListUsersUseCase) {}

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

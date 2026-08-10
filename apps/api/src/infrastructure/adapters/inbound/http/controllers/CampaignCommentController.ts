import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import type { CampaignCommentUseCases } from '../../../../../application/use-cases/CampaignCommentUseCases.js';

export class CampaignCommentController {
  constructor(private readonly comments: CampaignCommentUseCases) {}

  list = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const items = await this.comments.list(req.params.id as string, Number(req.query.limit) || 100);
      res.json({ data: { items }, message: 'Comments retrieved', status: 200 });
    } catch (error) { next(error); }
  };

  create = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const comment = await this.comments.create(req.params.id as string, req.userId!, req.body);
      res.status(201).json({ data: comment, message: 'Comment posted', status: 201 });
    } catch (error) { next(error); }
  };

  remove = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.comments.remove(req.params.id as string, req.params.commentId as string, req.userId!, req.userRole === 'admin');
      res.json({ data: null, message: 'Comment deleted', status: 200 });
    } catch (error) { next(error); }
  };
}

import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import type { InviteCollaboratorUseCase } from '../../../../../application/use-cases/InviteCollaboratorUseCase.js';
import type { RemoveCollaboratorUseCase } from '../../../../../application/use-cases/RemoveCollaboratorUseCase.js';
import type { ListCampaignCollaboratorsUseCase } from '../../../../../application/use-cases/ListCampaignCollaboratorsUseCase.js';
import type { ListMyCollaborationInvitationsUseCase } from '../../../../../application/use-cases/ListMyCollaborationInvitationsUseCase.js';
import type { RespondToCollaborationUseCase } from '../../../../../application/use-cases/RespondToCollaborationUseCase.js';

export class CollaborationController {
  constructor(
    private readonly inviteCollaboratorUseCase: InviteCollaboratorUseCase,
    private readonly removeCollaboratorUseCase: RemoveCollaboratorUseCase,
    private readonly listCampaignCollaboratorsUseCase: ListCampaignCollaboratorsUseCase,
    private readonly listMyCollaborationInvitationsUseCase: ListMyCollaborationInvitationsUseCase,
    private readonly respondToCollaborationUseCase: RespondToCollaborationUseCase
  ) {}

  invite = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const collaborator = await this.inviteCollaboratorUseCase.execute(
        {
          campaignId: req.params.id as string,
          userEmail: req.body.userEmail,
          role: req.body.role,
          revenueSharePercent: req.body.revenueSharePercent,
          inviteMessage: req.body.inviteMessage,
        },
        req.userId!
      );
      res.status(201).json({
        data: collaborator,
        message: 'Collaborator invited successfully',
        status: 201,
      });
    } catch (error) {
      next(error);
    }
  };

  remove = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      await this.removeCollaboratorUseCase.execute(
        {
          campaignId: req.params.id as string,
          collaborationId: req.params.collaboratorId as string,
        },
        req.userId!
      );
      res.json({
        data: null,
        message: 'Collaborator removed',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  listForCampaign = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const collaborators = await this.listCampaignCollaboratorsUseCase.execute(
        req.params.id as string,
        req.userId
      );
      res.json({
        data: collaborators,
        message: 'Collaborators retrieved',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  listMyInvitations = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const invitations = await this.listMyCollaborationInvitationsUseCase.execute(
        req.userId!
      );
      res.json({
        data: invitations,
        message: 'Invitations retrieved',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  respond = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const collaboration = await this.respondToCollaborationUseCase.execute(
        {
          collaborationId: req.params.id as string,
          accept: req.body.accept,
          declineReason: req.body.declineReason,
        },
        req.userId!
      );
      res.json({
        data: collaboration,
        message: req.body.accept ? 'Invitation accepted' : 'Invitation declined',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };
}

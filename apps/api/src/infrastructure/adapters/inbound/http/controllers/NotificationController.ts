import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import type { GetMyNotificationsUseCase } from '../../../../../application/use-cases/GetMyNotificationsUseCase.js';
import type { MarkNotificationAsReadUseCase } from '../../../../../application/use-cases/MarkNotificationAsReadUseCase.js';
import type { MarkAllNotificationsAsReadUseCase } from '../../../../../application/use-cases/MarkAllNotificationsAsReadUseCase.js';
import type { GetUnreadNotificationCountUseCase } from '../../../../../application/use-cases/GetUnreadNotificationCountUseCase.js';
import { PushTokenModel } from '../../../../database/models/PushTokenModel.js';

export class NotificationController {
  constructor(
    private readonly getMyNotificationsUseCase: GetMyNotificationsUseCase,
    private readonly markNotificationAsReadUseCase: MarkNotificationAsReadUseCase,
    private readonly markAllNotificationsAsReadUseCase: MarkAllNotificationsAsReadUseCase,
    private readonly getUnreadNotificationCountUseCase: GetUnreadNotificationCountUseCase
  ) {}

  getMine = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const notifications = await this.getMyNotificationsUseCase.execute(
        req.userId!
      );
      res.json({
        data: notifications,
        message: 'Notifications retrieved',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  markAsRead = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const notification = await this.markNotificationAsReadUseCase.execute(
        req.params.id as string,
        req.userId!
      );
      res.json({
        data: notification,
        message: 'Notification marked as read',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  markAllAsRead = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const updatedCount = await this.markAllNotificationsAsReadUseCase.execute(
        req.userId!
      );
      res.json({
        data: { updatedCount },
        message: 'All notifications marked as read',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  getUnreadCount = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const count = await this.getUnreadNotificationCountUseCase.execute(
        req.userId!
      );
      res.json({
        data: { count },
        message: 'Unread count retrieved',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  registerPushToken = async (
    _req: AuthenticatedRequest,
    res: Response
  ): Promise<void> => {
    // There is no push delivery service. Do not collect device identifiers or
    // treat a legacy profile flag as consent for a future implementation.
    res.status(503).json({ message: 'Device push notifications are not available yet. Use inbox alerts or email preferences in Settings.', status: 503 });
  };

  unregisterPushToken = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Explicit withdrawal needs no retained device identifier, including tokens
      // disabled by older versions. Keep deletion scoped to the authenticated owner.
      await PushTokenModel.deleteOne({ token: req.body.token, userId: req.userId! });
      res.json({ data: { registered: false }, message: 'Push token unregistered', status: 200 });
    } catch (error) { next(error); }
  };
}

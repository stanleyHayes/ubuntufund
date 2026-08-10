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
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      await PushTokenModel.findOneAndUpdate(
        { token: req.body.token },
        { $set: { userId: req.userId!, platform: req.body.platform, disabledAt: null } },
        { upsert: true, new: true, runValidators: true }
      );
      res.json({ data: { registered: true }, message: 'Push token registered', status: 200 });
    } catch (error) { next(error); }
  };

  unregisterPushToken = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      await PushTokenModel.findOneAndUpdate(
        { token: req.body.token, userId: req.userId!, disabledAt: null },
        { $set: { disabledAt: new Date() } }
      );
      res.json({ data: { registered: false }, message: 'Push token unregistered', status: 200 });
    } catch (error) { next(error); }
  };
}

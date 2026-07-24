import type { Request, Response, NextFunction } from 'express';
import type { ListPaymentProvidersUseCase } from '../../../../../application/use-cases/ListPaymentProvidersUseCase.js';
import type { GetEnabledPaymentProvidersUseCase } from '../../../../../application/use-cases/GetEnabledPaymentProvidersUseCase.js';
import type { TogglePaymentProviderUseCase } from '../../../../../application/use-cases/TogglePaymentProviderUseCase.js';

export class PaymentProviderController {
  constructor(
    private readonly listPaymentProvidersUseCase: ListPaymentProvidersUseCase,
    private readonly getEnabledPaymentProvidersUseCase: GetEnabledPaymentProvidersUseCase,
    private readonly togglePaymentProviderUseCase: TogglePaymentProviderUseCase
  ) {}

  /** GET /payment-providers/enabled — public. */
  listEnabled = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const providers = await this.getEnabledPaymentProvidersUseCase.execute();
      res.json({
        data: providers,
        message: 'Enabled payment providers retrieved',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  /** GET /payment-providers — admin only. */
  listAll = async (
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const providers = await this.listPaymentProvidersUseCase.execute();
      res.json({
        data: providers,
        message: 'Payment providers retrieved',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };

  /** PATCH /payment-providers/:id/toggle — admin only. */
  toggle = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const provider = await this.togglePaymentProviderUseCase.execute(
        req.params.id as string
      );
      res.json({
        data: provider,
        message: 'Payment provider toggled',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };
}

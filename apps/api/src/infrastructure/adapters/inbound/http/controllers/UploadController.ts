import type { Request, Response, NextFunction } from 'express';
import type { SignCloudinaryUploadUseCase } from '../../../../../application/use-cases/SignCloudinaryUploadUseCase.js';

export class UploadController {
  constructor(
    private readonly signCloudinaryUploadUseCase: SignCloudinaryUploadUseCase
  ) {}

  // POST /uploads/sign — authenticated. Returns direct-upload params, or a
  // clean 501 (via the error handler) when Cloudinary creds are absent.
  sign = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = this.signCloudinaryUploadUseCase.execute({
        folder: req.body?.folder,
      });
      res.json({
        data: result,
        message: 'Upload signature generated',
        status: 200,
      });
    } catch (error) {
      next(error);
    }
  };
}

import { PrivateKycDocumentModel } from '../../../../database/models/PrivateKycDocumentModel.js';
import { AuditLogModel } from '../../../../database/models/AuditLogModel.js';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import express, {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from 'express';
import type { createAuthMiddleware } from '../../middleware/authMiddleware.js';
import { AppError } from '../../middleware/errorHandler.js';
import type { MediaUploader } from '../../../outbound/media/CloudinaryUploader.js';

/** Accepted upload types — images and PDFs (KYC documents). */
const ALLOWED_MIME = /^(image\/(jpe?g|png|webp|gif|heic|heif)|application\/pdf)$/i;

/** Public `folder` keys → the Cloudinary folder they map to. */
const FOLDERS: Record<string, string> = {
  kyc: 'ujimora/kyc',
  campaigns: 'ujimora/campaigns',
  profiles: 'ujimora/profiles',
  misc: 'ujimora/misc',
};

/** Hard server ceiling (the client caps at 4MB; a little headroom here). */
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Media upload routes mounted at `/uploads`.
 *   POST /uploads/image — PROXY upload (browser → API → Cloudinary): the API
 *     checks type and size, then forwards the raw bytes with signed
 *     credentials. The only upload path: there is deliberately no direct
 *     browser → Cloudinary signing endpoint, because a signature covering only
 *     folder + timestamp let any signed-in user push files of any type or size
 *     straight into the account, bypassing these checks.
 *   GET /uploads/kyc/:id/access — short-lived link to a private KYC document.
 */
export function createUploadRoutes(
  uploader: MediaUploader,
  authMiddleware: ReturnType<typeof createAuthMiddleware>
): Router {
  const router = Router();

  router.post(
    '/image',
    authMiddleware,
    // Read the raw request body as a Buffer regardless of content-type; the mime
    // is validated below. Applies only to this route, after the global JSON
    // parser (which ignores non-JSON content types and never touches the stream).
    express.raw({ type: () => true, limit: '6mb' }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!uploader.isConfigured()) {
          throw new AppError('Image uploads are not configured on the server.', 503);
        }

        const buffer = req.body as Buffer;
        if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
          throw new AppError('No file was received.', 400);
        }
        if (buffer.length > MAX_BYTES) {
          throw new AppError('File is too large (max 4MB).', 413);
        }

        const mimetype = String(req.headers['content-type'] ?? '').split(';')[0].trim();
        if (!ALLOWED_MIME.test(mimetype)) {
          throw new AppError('Only image or PDF files are allowed.', 415);
        }

        const folderKey = String(req.query.folder ?? 'misc').toLowerCase();
        const folder = FOLDERS[folderKey] ?? FOLDERS.misc;

        const result = await uploader.upload({ buffer, mimetype, folder, authenticated: folderKey === 'kyc' });
        if (folderKey === 'kyc') {
          if (result.deliveryType !== 'authenticated' || !result.publicId || !result.format || !['image', 'raw'].includes(result.resourceType ?? '')) {
            throw new AppError('Private document storage could not be confirmed', 502);
          }
          const document = await PrivateKycDocumentModel.create({ userId: (req as AuthenticatedRequest).userId, publicId: result.publicId, resourceType: result.resourceType, format: result.format, mimeType: mimetype });
          res.set('Cache-Control', 'no-store').json({ data: { url: `kyc://${document.id}` }, message: 'Private document uploaded', status: 200 });
          return;
        }
        res.json({ data: { url: result.url }, message: 'Uploaded', status: 200 });
      } catch (error) {
        next(error);
      }
    }
  );

  router.get('/kyc/:id/access', authMiddleware, async (req: AuthenticatedRequest, res, next) => {
    try {
      if (!/^[a-f0-9]{24}$/i.test(String(req.params.id))) throw new AppError('Document not found', 404);
      const document = await PrivateKycDocumentModel.findOne({ _id: req.params.id, deletedAt: { $exists: false } });
      if (!document || (document.userId !== req.userId && req.userRole !== 'admin')) throw new AppError('Document not found', 404);
      if (!uploader.privateDownloadUrl) throw new AppError('Document viewing is unavailable', 503);
      const url = uploader.privateDownloadUrl(document.publicId, document.format, document.resourceType);
      await AuditLogModel.create({ actorId: req.userId, actorRole: req.userRole, action: 'kyc.document.access', resource: `kyc-document:${document.id}`, details: 'Issued a private verification document viewing link', method: 'GET', path: req.originalUrl.split('?')[0], statusCode: 200 });
      res.set('Cache-Control', 'no-store').json({ data: { url, mimeType: document.mimeType, expiresInSeconds: 60 }, status: 200 });
    } catch (error) { next(error); }
  });
  return router;
}

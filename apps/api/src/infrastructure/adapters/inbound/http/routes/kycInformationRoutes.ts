import { lockPrivateKycDocuments } from '../../../outbound/persistence/lockPrivateKycDocuments.js';
import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import { AppError } from '../../middleware/errorHandler.js';
import { KYCVerificationModel } from '../../../../database/models/KYCVerificationModel.js';
import { PrivateKycDocumentModel } from '../../../../database/models/PrivateKycDocumentModel.js';
import { AuditLogModel } from '../../../../database/models/AuditLogModel.js';
import { MongoKYCWorkflowTransaction } from '../../../outbound/persistence/MongoKYCWorkflowTransaction.js';
import type { RequestHandler } from 'express';

export function createKYCInformationRoutes(auth: RequestHandler, admin: RequestHandler): Router {
  const router = Router();
  router.put('/:id/request-info', auth, admin, async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = z.string().regex(/^[a-f0-9]{24}$/i).parse(req.params.id);
      const { prompt, reviewVersion } = z.object({ reviewVersion: z.string().regex(/^[a-f0-9]{64}$/).optional(), prompt: z.string().trim().min(20).max(2000) }).parse(req.body);
      const result = await new MongoKYCWorkflowTransaction().run(id, req.userId!, req.authVersion ?? '', 'information_requested', reviewVersion, async () => {
        const row = await KYCVerificationModel.findById(id);
        if (row!.informationRequests?.some(item => !item.respondedAt)) throw new AppError('An information request is already awaiting a response.', 409);
        const item = { id: randomUUID(), prompt, requestedAt: new Date() };
        await KYCVerificationModel.updateOne({ _id: id }, { $set: { status: 'in_review' }, $push: { informationRequests: item } });
        return item;
      });
      res.setHeader('Cache-Control', 'private, no-store');
      res.json({ data: result, message: 'Information request is available in the applicant account.', status: 200 });
    } catch (error) { next(error instanceof z.ZodError ? new AppError('Enter a request of 20 to 2000 characters.', 400) : error); }
  });
  router.post('/:id/respond-info', auth, async (req: AuthenticatedRequest, res, next) => {
    try {
      const id = z.string().regex(/^[a-f0-9]{24}$/i).parse(req.params.id);
      const input = z.object({ requestId: z.string().uuid(), response: z.string().trim().min(1).max(2000), documents: z.array(z.object({ type: z.enum(['id_card', 'passport', 'selfie', 'drivers_license', 'utility_bill', 'bank_statement', 'business_registration', 'tax_certificate', 'authorization_letter', 'ownership_register']), url: z.string().regex(/^kyc:\/\/[a-f0-9]{24}$/i) })).max(10).default([]) }).parse(req.body);
      await new MongoKYCWorkflowTransaction().submit(req.userId!, req.authVersion ?? '', async () => {
        const row = await KYCVerificationModel.findOne({ _id: id, userId: req.userId });
        if (!row) throw new AppError('Verification not found.', 404);
        const current = row.informationRequests?.find(item => item.id === input.requestId);
        if (row.status !== 'in_review' || !current || current.respondedAt) throw new AppError('This information request is no longer awaiting a response.', 409);
        for (const document of input.documents) {
          if (!(await PrivateKycDocumentModel.exists({ _id: document.url.slice(6), userId: req.userId, deletedAt: { $exists: false } }))) throw new AppError('Upload each document through your private document uploader.', 400);
        }
        await lockPrivateKycDocuments(req.userId!, input.documents);
        const now = new Date();
        await KYCVerificationModel.updateOne({ _id: id, 'informationRequests.id': input.requestId }, { $set: { status: 'pending', 'informationRequests.$.response': input.response, 'informationRequests.$.respondedAt': now }, ...(input.documents.length ? { $push: { documents: { $each: input.documents.map(document => ({ ...document, uploadedAt: now })) } } } : {}) });
        await AuditLogModel.create({ actorId: req.userId, action: 'kyc.information_responded', resource: id, details: `Information request ${input.requestId} answered`, method: 'POST', path: '/kyc/:id/respond-info', statusCode: 200 });
      });
      res.setHeader('Cache-Control', 'private, no-store');
      res.json({ data: { status: 'pending' }, message: 'Response submitted for review.', status: 200 });
    } catch (error) { next(error instanceof z.ZodError ? new AppError('Enter a response and valid private document references.', 400) : error); }
  });
  return router;
}

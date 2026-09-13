import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { adultBirthDateError } from '@ubuntu-fund/types';
import type { AuthenticatedRequest } from '../../middleware/authMiddleware.js';
import { AppError } from '../../middleware/errorHandler.js';
import { MongoKYCWorkflowTransaction } from '../../../outbound/persistence/MongoKYCWorkflowTransaction.js';
import { MongoKYCRepository } from '../../../outbound/persistence/MongoKYCRepository.js';
import { lockPrivateKycDocuments } from '../../../outbound/persistence/lockPrivateKycDocuments.js';
import { UserModel } from '../../../../database/models/UserModel.js';
import { AuditLogModel } from '../../../../database/models/AuditLogModel.js';

const name = z.string().trim().min(1).max(200);
const schema = z.object({
  personalInfo: z.object({ fullName: name, dateOfBirth: z.string().datetime(), nationality: name, idNumber: z.string().trim().min(1).max(100) }),
  businessInfo: z.object({
    businessName: name, registrationNumber: z.string().trim().min(1).max(100), businessType: z.string().trim().min(2).max(100), taxId: z.string().trim().max(100).optional(),
    registeredAddress: z.object({ street: z.string().trim().min(2).max(200), city: name, country: name, state: z.string().trim().max(100).optional(), postalCode: z.string().trim().max(30).optional(), gpsAddress: z.string().trim().max(30).optional() }),
    representativeCapacity: z.string().trim().min(2).max(200),
    controlPersons: z.array(z.object({ fullName: name, role: z.enum(['director', 'trustee', 'beneficial_owner', 'other_controller']), country: name, ownershipPercent: z.number().min(0).max(100).optional() })).min(1).max(50),
    ownershipExplanation: z.string().trim().min(20).max(2000),
  }),
  documents: z.array(z.object({ type: z.enum(['id_card', 'passport', 'drivers_license', 'selfie', 'business_registration', 'tax_certificate', 'utility_bill', 'bank_statement', 'authorization_letter', 'ownership_register']), url: z.string().regex(/^kyc:\/\/[a-f0-9]{24}$/i) })).min(3).max(20),
  declaration: z.object({ authorized: z.literal(true), accurate: z.literal(true) }),
});

export function createKYCBusinessRoutes(auth: RequestHandler): Router {
  const router = Router();
  router.post('/business', auth, async (req: AuthenticatedRequest, res, next) => {
    try {
      const input = schema.parse(req.body);
      const ageError = adultBirthDateError(input.personalInfo.dateOfBirth);
      if (ageError) throw new AppError(ageError, 422);
      const types = new Set<string>(input.documents.map(document => document.type));
      if (!types.has('business_registration') || !types.has('authorization_letter') || !['id_card', 'passport', 'drivers_license'].some(type => types.has(type))) {
        throw new AppError('Provide registration evidence, representative authorization and the representative identity document.', 422);
      }
      const record = await new MongoKYCWorkflowTransaction().submit(req.userId!, req.authVersion ?? '', async () => {
        if (!(await UserModel.exists({ _id: req.userId, role: 'organization', deletedAt: null }))) throw new AppError('Organization verification requires an organization account.', 403);
        const repo = new MongoKYCRepository();
        if (await repo.findActiveByUserIdAndType(req.userId!, 'business')) throw new AppError('An organization verification is already under review.', 409);
        await lockPrivateKycDocuments(req.userId!, input.documents);
        const now = new Date();
        const saved = await repo.save({ id: '', userId: req.userId!, verificationType: 'business', status: 'pending', riskLevel: 'medium', retryCount: 0,
          personalInfo: { ...input.personalInfo, dateOfBirth: new Date(input.personalInfo.dateOfBirth) },
          businessInfo: { ...input.businessInfo, declaration: { ...input.declaration, acceptedAt: now } },
          documents: input.documents.map(document => ({ ...document, uploadedAt: now })), createdAt: now, updatedAt: now });
        await AuditLogModel.create({ actorId: req.userId, action: 'kyc.business_submitted', resource: saved.id, details: 'Organization verification submitted with authority and accuracy declarations', method: 'POST', path: '/kyc/business', statusCode: 201 });
        return saved;
      });
      res.setHeader('Cache-Control', 'private, no-store');
      res.status(201).json({ data: { id: record.id, status: record.status, verificationType: record.verificationType }, message: 'Organization verification submitted for review.', status: 201 });
    } catch (error) { next(error instanceof z.ZodError ? new AppError('Complete the organization, representative, ownership and private-document fields and both declarations.', 400) : error); }
  });
  return router;
}

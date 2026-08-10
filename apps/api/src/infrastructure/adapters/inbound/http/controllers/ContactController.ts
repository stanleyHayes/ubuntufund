import type { NextFunction, Request, Response } from 'express';
import { ContactSubmissionModel, type ContactSubmissionDocument } from '../../../../database/models/ContactSubmissionModel.js';

function serialize(doc: ContactSubmissionDocument) {
  return { id: doc.id as string, name: doc.name, email: doc.email, subject: doc.subject,
    inquiryType: doc.inquiryType, message: doc.message, status: doc.status,
    adminNotes: doc.adminNotes, resolvedAt: doc.resolvedAt, createdAt: doc.createdAt, updatedAt: doc.updatedAt };
}

export class ContactController {
  submit = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const doc = await ContactSubmissionModel.create(req.body);
      res.status(201).json({ data: { id: doc.id }, message: 'Your message has been received', status: 201 });
    } catch (error) { next(error); }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
      const filter: Record<string, unknown> = {};
      if (typeof req.query.status === 'string') filter.status = req.query.status;
      if (typeof req.query.inquiryType === 'string') filter.inquiryType = req.query.inquiryType;
      const [docs, total] = await Promise.all([
        ContactSubmissionModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize),
        ContactSubmissionModel.countDocuments(filter),
      ]);
      res.json({ data: { items: docs.map(serialize), total, page, pageSize }, message: 'Contact submissions retrieved', status: 200 });
    } catch (error) { next(error); }
  };

  stats = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rows = await ContactSubmissionModel.aggregate<{ _id: string; count: number }>([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
      const counts = Object.fromEntries(rows.map((row) => [row._id, row.count]));
      res.json({ data: { total: rows.reduce((sum, row) => sum + row.count, 0), new: counts.new ?? 0,
        inProgress: counts.in_progress ?? 0, resolved: counts.resolved ?? 0 }, message: 'Contact statistics retrieved', status: 200 });
    } catch (error) { next(error); }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const changes: Record<string, unknown> = { status: req.body.status, adminNotes: req.body.adminNotes };
      changes.resolvedAt = req.body.status === 'resolved' ? new Date() : null;
      const doc = await ContactSubmissionModel.findByIdAndUpdate(req.params.id, { $set: changes }, { new: true, runValidators: true });
      if (!doc) { res.status(404).json({ message: 'Contact submission not found', status: 404 }); return; }
      res.json({ data: serialize(doc), message: 'Contact submission updated', status: 200 });
    } catch (error) { next(error); }
  };
}

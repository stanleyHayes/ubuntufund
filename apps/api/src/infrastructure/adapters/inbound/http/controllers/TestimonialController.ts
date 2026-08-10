import type { NextFunction, Request, Response } from 'express';
import { TestimonialModel, type TestimonialDocument } from '../../../../database/models/TestimonialModel.js';

function serialize(doc: TestimonialDocument) {
  return {
    id: doc.id as string,
    name: doc.name,
    role: doc.role,
    location: doc.location,
    quote: doc.quote,
    rating: doc.rating,
    avatarUrl: doc.avatarUrl,
    avatarColor: doc.avatarColor,
    status: doc.status,
    displayOrder: doc.displayOrder,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export class TestimonialController {
  listPublished = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const docs = await TestimonialModel.find({ status: 'published', deletedAt: null })
        .sort({ displayOrder: 1, createdAt: -1 })
        .limit(12);
      res.json({ data: docs.map(serialize), message: 'Testimonials retrieved', status: 200 });
    } catch (error) { next(error); }
  };

  listAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
      const filter: Record<string, unknown> = { deletedAt: null };
      if (typeof req.query.status === 'string') filter.status = req.query.status;
      const [docs, total] = await Promise.all([
        TestimonialModel.find(filter).sort({ displayOrder: 1, createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize),
        TestimonialModel.countDocuments(filter),
      ]);
      res.json({ data: { items: docs.map(serialize), total, page, pageSize }, message: 'Testimonials retrieved', status: 200 });
    } catch (error) { next(error); }
  };

  stats = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rows = await TestimonialModel.aggregate<{ _id: string; count: number }>([
        { $match: { deletedAt: null } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]);
      const counts = Object.fromEntries(rows.map((row) => [row._id, row.count]));
      res.json({ data: { total: rows.reduce((sum, row) => sum + row.count, 0), published: counts.published ?? 0, draft: counts.draft ?? 0, archived: counts.archived ?? 0 }, message: 'Testimonial statistics retrieved', status: 200 });
    } catch (error) { next(error); }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const doc = await TestimonialModel.create(req.body);
      res.status(201).json({ data: serialize(doc), message: 'Testimonial created', status: 201 });
    } catch (error) { next(error); }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const doc = await TestimonialModel.findOneAndUpdate(
        { _id: req.params.id, deletedAt: null },
        { $set: req.body },
        { new: true, runValidators: true }
      );
      if (!doc) { res.status(404).json({ message: 'Testimonial not found', status: 404 }); return; }
      res.json({ data: serialize(doc), message: 'Testimonial updated', status: 200 });
    } catch (error) { next(error); }
  };

  remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const doc = await TestimonialModel.findOneAndUpdate(
        { _id: req.params.id, deletedAt: null },
        { $set: { deletedAt: new Date(), status: 'archived' } },
        { new: true }
      );
      if (!doc) { res.status(404).json({ message: 'Testimonial not found', status: 404 }); return; }
      res.json({ data: { id: doc.id }, message: 'Testimonial archived and removed from active content', status: 200 });
    } catch (error) { next(error); }
  };
}

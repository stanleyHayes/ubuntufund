import mongoose, { Schema, type Document } from 'mongoose';
import type { QrKind } from '@ubuntu-fund/types';

export interface ShortLinkScanSubdoc {
  source?: string;
  scannedAt: Date;
}

export interface ShortLinkDocument extends Document {
  code: string;
  campaignId: string;
  liveSessionId?: string;
  kind: QrKind;
  presetAmount?: number;
  label?: string;
  createdBy: string;
  target: string;
  scanCount: number;
  scans: ShortLinkScanSubdoc[];
  createdAt: Date;
  updatedAt: Date;
}

const QR_KINDS: QrKind[] = ['campaign', 'live', 'amount', 'creator', 'event'];

const scanSchema = new Schema<ShortLinkScanSubdoc>(
  {
    source: { type: String },
    scannedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false }
);

const shortLinkSchema = new Schema<ShortLinkDocument>(
  {
    code: { type: String, required: true, unique: true, index: true },
    campaignId: { type: String, required: true, index: true },
    liveSessionId: { type: String },
    kind: { type: String, enum: QR_KINDS, required: true },
    presetAmount: { type: Number },
    label: { type: String },
    createdBy: { type: String, required: true, index: true },
    target: { type: String, required: true },
    scanCount: { type: Number, default: 0 },
    // Lightweight, best-effort attribution log — bounded on write (see the
    // repository's $slice) so it can never grow without limit. No PII.
    scans: { type: [scanSchema], default: [] },
  },
  { timestamps: true }
);

export const ShortLinkModel = mongoose.model<ShortLinkDocument>(
  'ShortLink',
  shortLinkSchema
);

/** Max number of scan records retained per short link (newest kept). */
export const MAX_RETAINED_SCANS = 500;

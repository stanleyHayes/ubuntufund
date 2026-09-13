import { v2 as cloudinary } from 'cloudinary';
import { createHash } from 'node:crypto';
import type { CloudinaryConfig } from '../../../config/index.js';
import { logger } from '../../../logging/logger.js';

export interface UploadResult {
  url: string;
  publicId?: string;
  resourceType?: string;
  format?: string;
  deliveryType?: string;
}

export interface MediaUploader {
  isConfigured(): boolean;
  privateDownloadUrl?(publicId: string, format: string, resourceType: string): string;
  upload(input: { buffer: Buffer; mimetype: string; folder: string; authenticated?: boolean }): Promise<UploadResult>;
}

/**
 * Server-side SIGNED Cloudinary upload. The browser POSTs a file to our own API
 * and the API forwards it to Cloudinary with the account's signed credentials —
 * so an upload never depends on the browser reaching api.cloudinary.com directly
 * (which ad-blockers, privacy shields and restrictive networks routinely break),
 * and the API secret is never exposed to the client. The request is signed per
 * Cloudinary's scheme: the signed params (folder + timestamp) sorted
 * alphabetically as `k=v` joined by `&`, the api_secret appended, then SHA-1.
 */
export class CloudinaryUploader implements MediaUploader {
  constructor(private readonly config: CloudinaryConfig) {}

  isConfigured(): boolean {
    return Boolean(this.config.cloudName && this.config.apiKey && this.config.apiSecret);
  }

  async upload(input: {
    buffer: Buffer;
    mimetype: string;
    folder: string;
    authenticated?: boolean;
  }): Promise<UploadResult> {
    if (!this.isConfigured()) {
      throw new Error('Cloudinary is not configured');
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const toSign = `folder=${input.folder}&timestamp=${timestamp}${input.authenticated ? '&type=authenticated' : ''}`;
    const signature = createHash('sha1')
      .update(toSign + this.config.apiSecret)
      .digest('hex');

    const form = new FormData();
    form.append('file', new Blob([input.buffer], { type: input.mimetype }), 'upload');
    form.append('api_key', this.config.apiKey);
    form.append('timestamp', String(timestamp));
    form.append('folder', input.folder);
    form.append('signature', signature);
    if (input.authenticated) form.append('type', 'authenticated');

    // `auto` resource type so images and PDFs both upload through one endpoint.
    const endpoint = `https://api.cloudinary.com/v1_1/${this.config.cloudName}/auto/upload`;

    let res: Response;
    try {
      res = await fetch(endpoint, { method: 'POST', body: form });
    } catch (error) {
      logger.error({ err: error }, 'cloudinary upload: network error reaching provider');
      throw new Error('Could not reach the image host. Please try again.');
    }

    const data = (await res.json().catch(() => ({}))) as {
      secure_url?: string;
      public_id?: string;
      resource_type?: string;
      format?: string;
      type?: string;
      error?: { message?: string };
    };
    if (!res.ok || !data.secure_url) {
      const message = data?.error?.message ?? `Cloudinary responded ${res.status}`;
      logger.error({ status: res.status, message }, 'cloudinary upload failed');
      throw new Error(message);
    }
    if (input.authenticated && (data.type !== 'authenticated' || !data.public_id || !data.resource_type || !data.format)) {
      throw new Error('The document host did not confirm private storage. Please retry.');
    }
    return { url: data.secure_url, publicId: data.public_id, resourceType: data.resource_type, format: data.format, deliveryType: data.type };
  }
  privateDownloadUrl(publicId: string, format: string, resourceType: string): string {
    if (!this.isConfigured()) throw new Error('Document storage is unavailable');
    const options = {
      cloud_name: this.config.cloudName, api_key: this.config.apiKey, api_secret: this.config.apiSecret,
      resource_type: resourceType === 'raw' ? 'raw' as const : 'image' as const,
      type: 'authenticated' as const, expires_at: Math.floor(Date.now() / 1000) + 60,
      secure: true,
    };
    return cloudinary.utils.private_download_url(publicId, format, options);
  }

}

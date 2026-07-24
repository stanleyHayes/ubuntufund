import { createHash } from 'node:crypto';
import { AppError } from '../../infrastructure/adapters/inbound/middleware/errorHandler.js';

export interface CloudinaryCredentials {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

export interface SignUploadInput {
  /** Optional target folder; defaults to a namespaced 'ubuntu-fund' folder. */
  folder?: string;
}

export interface SignUploadResultDTO {
  timestamp: number;
  signature: string;
  apiKey: string;
  cloudName: string;
  folder: string;
}

/**
 * Produces the params a browser needs to upload directly to Cloudinary's signed
 * upload endpoint, so raw bytes never transit our API. The signature is
 * hand-rolled (Node `crypto` SHA-1) per Cloudinary's scheme — sort the signed
 * params as `key=value` pairs joined by `&`, append the API secret, SHA-1 hex —
 * to avoid pulling the Cloudinary SDK into the request path.
 *
 * When any credential is missing the feature is treated as disabled: `execute`
 * throws a 501 (surfaced cleanly by the error handler) rather than signing with
 * empty secrets or crashing.
 */
export class SignCloudinaryUploadUseCase {
  constructor(private readonly credentials: CloudinaryCredentials) {}

  isConfigured(): boolean {
    const { cloudName, apiKey, apiSecret } = this.credentials;
    return Boolean(cloudName && apiKey && apiSecret);
  }

  execute(input: SignUploadInput = {}): SignUploadResultDTO {
    if (!this.isConfigured()) {
      throw new AppError(
        'Media uploads are not configured on this server',
        501
      );
    }

    const folder = (input.folder ?? '').trim() || 'ubuntu-fund';
    const timestamp = Math.floor(Date.now() / 1000);

    // Only the params sent to Cloudinary alongside the file are signed. Sort
    // alphabetically, join as key=value&…, append the secret, SHA-1 → hex.
    const signedParams: Record<string, string | number> = { folder, timestamp };
    const toSign = Object.keys(signedParams)
      .sort()
      .map((key) => `${key}=${signedParams[key]}`)
      .join('&');
    const signature = createHash('sha1')
      .update(`${toSign}${this.credentials.apiSecret}`)
      .digest('hex');

    return {
      timestamp,
      signature,
      apiKey: this.credentials.apiKey,
      cloudName: this.credentials.cloudName,
      folder,
    };
  }
}

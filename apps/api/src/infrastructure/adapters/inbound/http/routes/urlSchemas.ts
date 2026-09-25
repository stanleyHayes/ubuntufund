import { z } from 'zod';
import { config } from '../../../../config/index.js';

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/**
 * A web address a person types (an organization's website). zod's `.url()` is
 * only `new URL(value)`, which accepts `javascript:`, `data:` and friends, so
 * the scheme is checked explicitly; embedded credentials are refused too.
 */
export const webAddress = z
  .string()
  .trim()
  .max(500)
  .refine((value) => {
    const url = parseUrl(value);
    return !!url && (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password;
  }, 'Enter a full web address starting with https://');

/**
 * True for an image this deployment's Cloudinary account delivers — exactly
 * what POST /uploads/image returns. Reviews approve a URL, not the bytes
 * behind it: a third-party host could serve a harmless image during review
 * and swap it afterwards (or log every viewer), so public media must live
 * where the platform controls it.
 */
export function isPlatformMediaUrl(value: string, cloudName: string = config.cloudinary.cloudName): boolean {
  if (!cloudName || value !== value.trim()) return false;
  const url = parseUrl(value);
  return (
    !!url &&
    url.protocol === 'https:' &&
    url.hostname === 'res.cloudinary.com' &&
    !url.port &&
    !url.username &&
    !url.password &&
    url.pathname.startsWith(`/${cloudName}/image/upload/`)
  );
}

/** Public media (avatars, covers, campaign images, update photos): uploaded through Ujimora only. */
export const platformMediaUrl = z
  .string()
  .max(2000)
  .refine((value) => isPlatformMediaUrl(value), 'Upload the image through Ujimora');

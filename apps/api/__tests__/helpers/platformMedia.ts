// testApp pins CLOUDINARY_CLOUD_NAME before the app (and its config) loads.
import './testApp.js';

/**
 * A public-media URL the API accepts: the shape POST /uploads/image returns
 * for this deployment's Cloudinary cloud (avatars, covers, campaign images and
 * update photos must be platform-hosted).
 *
 * Reads the cloud name from the environment at call time rather than
 * importing config: a static config import would load it before a test file's
 * own top-level `process.env.X = …` assignments run.
 */
export function platformMediaUrl(name: string): string {
  return `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/v1/ujimora/test/${name}`;
}

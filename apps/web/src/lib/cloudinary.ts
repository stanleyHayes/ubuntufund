// ---------------------------------------------------------------------------
// Cloudinary unsigned upload helper
// ---------------------------------------------------------------------------
// Uploads happen straight from the browser using an UNSIGNED upload preset, so
// no API secret is ever exposed. Both values are public and read from Vite env
// vars (VITE_* — the only ones that reach the bundle):
//   VITE_CLOUDINARY_CLOUD_NAME    — your Cloudinary cloud name
//   VITE_CLOUDINARY_UPLOAD_PRESET — an unsigned upload preset
// When either is missing, `getCloudinaryConfig()` returns null and callers
// gracefully fall back to a paste-a-URL input.
// ---------------------------------------------------------------------------

export interface CloudinaryConfig {
  cloudName: string
  uploadPreset: string
}

/** Returns the Cloudinary config when both public env vars are present, else null. */
export function getCloudinaryConfig(): CloudinaryConfig | null {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined
  if (!cloudName || !uploadPreset) return null
  return { cloudName, uploadPreset }
}

export interface CloudinaryUploadResult {
  /** The https URL of the uploaded asset (store this on the campaign). */
  secureUrl: string
}

/**
 * Upload a single image file to Cloudinary via an unsigned preset.
 * Uses XMLHttpRequest so we can report upload progress (0–100).
 * Rejects with a human-readable Error on any failure.
 */
export function uploadToCloudinary(
  file: File,
  config: CloudinaryConfig,
  onProgress?: (percent: number) => void,
): Promise<CloudinaryUploadResult> {
  return new Promise((resolve, reject) => {
    const endpoint = `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`
    const form = new FormData()
    form.append('file', file)
    form.append('upload_preset', config.uploadPreset)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', endpoint)

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText) as { secure_url?: string }
          if (res.secure_url) {
            resolve({ secureUrl: res.secure_url })
          } else {
            reject(new Error('Upload succeeded but no image URL was returned.'))
          }
        } catch {
          reject(new Error('Could not read the upload response.'))
        }
        return
      }

      let message = `Upload failed (${xhr.status}). Please try again.`
      try {
        const res = JSON.parse(xhr.responseText) as { error?: { message?: string } }
        if (res?.error?.message) message = res.error.message
      } catch {
        /* keep the generic message */
      }
      reject(new Error(message))
    }

    xhr.onerror = () => reject(new Error('Network error during upload. Check your connection and try again.'))
    xhr.onabort = () => reject(new Error('Upload was cancelled.'))

    xhr.send(form)
  })
}

import { browserSession } from './session'

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1'

// Upload folders the server accepts (mirrors the API allowlist).
export type UploadFolder = 'kyc' | 'campaigns' | 'profiles' | 'misc'

/**
 * Upload a file through our OWN API (browser → API → Cloudinary), not straight
 * to Cloudinary. This keeps the request same-origin, so an ad-blocker, privacy
 * shield, VPN or restrictive network can't silently break the upload the way a
 * direct api.cloudinary.com request often is. Reports progress via XHR and
 * resolves with the stored https URL.
 */
export async function uploadImageViaApi(
  file: File,
  folder: UploadFolder,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const token = await browserSession.ensureAccessToken()
  if (!token) throw new Error('Please sign in again before uploading a photo.')
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE}/uploads/image?folder=${encodeURIComponent(folder)}`)
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText) as { data?: { url?: string }; url?: string }
          const url = res.data?.url ?? res.url
          if (url) return resolve(url)
          reject(new Error('Upload succeeded but no image URL was returned.'))
        } catch {
          reject(new Error('Could not read the upload response.'))
        }
        return
      }
      // A 401 means the session can no longer act — expire it so protected pages
      // fall back to the sign-in prompt rather than a dead-end.
      if (xhr.status === 401 && token) browserSession.expire(token)
      let message = `Upload failed (${xhr.status}). Please try again.`
      try {
        const res = JSON.parse(xhr.responseText) as { message?: string; error?: string }
        message = res.message ?? res.error ?? message
      } catch {
        /* keep the generic message */
      }
      reject(new Error(message))
    }

    xhr.onerror = () =>
      reject(new Error('Could not reach Ujimora to upload your file. Check your connection and try again.'))
    xhr.onabort = () => reject(new Error('Upload was cancelled.'))

    xhr.send(file)
  })
}

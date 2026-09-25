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

type UploadResponse = { status: number; body: string }

function send(url: string, file: File, token: string | null, onProgress?: (percent: number) => void): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    }
    xhr.onload = () => resolve({ status: xhr.status, body: xhr.responseText })
    xhr.onerror = () =>
      reject(new Error('Could not reach Ujimora to upload your file. Check your connection and try again.'))
    xhr.onabort = () => reject(new Error('Upload was cancelled.'))

    xhr.send(file)
  })
}

function result(response: UploadResponse): string {
  if (response.status >= 200 && response.status < 300) {
    let url: string | undefined
    try {
      const res = JSON.parse(response.body) as { data?: { url?: string }; url?: string }
      url = res.data?.url ?? res.url
    } catch {
      throw new Error('Could not read the upload response.')
    }
    if (url) return url
    throw new Error('Upload succeeded but no image URL was returned.')
  }
  let message = `Upload failed (${response.status}). Please try again.`
  try {
    const res = JSON.parse(response.body) as { message?: string; error?: string }
    message = res.message ?? res.error ?? message
  } catch {
    /* keep the generic message */
  }
  throw new Error(message)
}

/**
 * forceRefresh resolves null when the session has ended and rejects on a
 * network failure without signing out. A failed renewal on a flaky
 * connection must not sign staff out mid-upload, so it surfaces as a
 * connection error, like api.ts does.
 */
async function renewForUpload(token: string): Promise<string | null> {
  try {
    return await browserSession.forceRefresh(token)
  } catch {
    throw new Error('Unable to renew your session. Check your connection and try again.')
  }
}

export async function uploadImageViaApi(
  file: File,
  folder: UploadFolder,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const token = await browserSession.ensureAccessToken()
  if (!token) throw new Error('Please sign in again before uploading a photo.')
  const url = `${API_BASE}/uploads/image?folder=${encodeURIComponent(folder)}`
  let response = await send(url, file, token, onProgress)
  if (response.status === 401) {
    // The token may only look valid here because the device clock is off:
    // renew once and retry before treating the 401 as a sign-out.
    const renewed = await renewForUpload(token)
    if (renewed && renewed !== token) response = await send(url, file, renewed, onProgress)
    // Still refused (or renewal ended the session): expire so protected pages
    // fall back to sign-in.
    if (response.status === 401) browserSession.expire(renewed ?? token)
  }
  return result(response)
}

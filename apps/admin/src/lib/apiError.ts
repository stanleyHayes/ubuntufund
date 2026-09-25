/**
 * A non-2xx API answer, with the HTTP status and any field errors the server
 * sent. Kept apart from the client so pages can test `instanceof ApiError`
 * even where tests replace the client module.
 */
export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly errors?: Record<string, string[]>) {
    super(message)
    this.name = 'ApiError'
  }
}

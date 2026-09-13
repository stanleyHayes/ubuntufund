import type { LoggerOptions } from 'pino';

/** Diagnostic logs are not a second store for submitted data or credentials. */
const privateFields = [
  'password', 'passwordHash', 'token', 'accessToken', 'refreshToken',
  'authorization', 'cookie', 'apiKey', 'secret', 'clientSecret',
  'email', 'recipientEmail', 'phone', 'accountNumber', 'idNumber',
  'documentUrl', 'privateUrl', 'body', 'requestBody', 'responseBody',
  'headers', 'rawBody', 'raw', 'message',
];

export function diagnosticPath(value: unknown): string {
  if (typeof value !== 'string') return '[unknown path]';
  try { return new URL(value, 'https://diagnostic.invalid').pathname; }
  catch { return '[invalid path]'; }
}

const errorTypes = new Set([
  'Error', 'AppError', 'TypeError', 'RangeError', 'SyntaxError',
  'ValidationError', 'CastError', 'MongoServerError', 'MongoNetworkError',
  'MongoServerSelectionError', 'AbortError', 'TimeoutError',
]);
const errorCodes = new Set([
  'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN',
  'EPIPE', 'ABORT_ERR', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT',
]);

export function diagnosticError(value: unknown): Record<string, string | number> {
  const error = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const result: Record<string, string | number> = {
    type: typeof error.name === 'string' && errorTypes.has(error.name) ? error.name : 'Error',
  };
  if (typeof error.statusCode === 'number' && Number.isInteger(error.statusCode) && error.statusCode >= 100 && error.statusCode <= 599) {
    result.statusCode = error.statusCode;
  }
  if (typeof error.code === 'string' && errorCodes.has(error.code)) result.code = error.code;
  if (error.code === 11000) result.code = 11000; // Duplicate key; never include keyValue.
  // Error messages, stack first lines, causes and provider/DB payloads can embed
  // tokens, document data, submitted text, URLs and connection credentials.
  return result;
}

export const diagnosticPrivacyOptions: Pick<LoggerOptions, 'redact' | 'serializers'> = {
  redact: {
    paths: privateFields.flatMap(field => [field, `*.${field}`, `*.*.${field}`]),
    remove: true,
  },
  serializers: { err: diagnosticError, error: diagnosticError, path: diagnosticPath, url: diagnosticPath },
};

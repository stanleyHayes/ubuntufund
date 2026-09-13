import { pino } from 'pino';
import { diagnosticPrivacyOptions } from './privacy.js';

const isDev = (process.env.NODE_ENV ?? 'development') === 'development';

export const logger = pino({
  ...diagnosticPrivacyOptions,
  level: process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss' },
        },
      }
    : {}),
});

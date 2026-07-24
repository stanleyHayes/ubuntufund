import * as dotenv from 'dotenv';

dotenv.config();

export interface AppConfig {
  port: number;
  mongodbUri: string;
  jwtSecret: string;
  jwtRefreshSecret: string;
  nodeEnv: string;
  corsOrigins: string[];
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const nodeEnv = process.env.NODE_ENV ?? 'development';
const jwtSecret = requireEnv('JWT_SECRET');
const jwtRefreshSecret = requireEnv('JWT_REFRESH_SECRET');

if (nodeEnv === 'production') {
  if (jwtSecret.length < 32 || jwtRefreshSecret.length < 32) {
    throw new Error('JWT secrets must be at least 32 characters in production');
  }
  if (jwtSecret === jwtRefreshSecret) {
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be distinct in production');
  }
}

const defaultDevOrigins = [
  'http://localhost:8200',
  'http://localhost:8300',
  'http://localhost:8400',
  'http://localhost:18200',
  // Expo (mobile) dev origins: metro web preview + dev server ports
  'http://localhost:8081',
  'http://localhost:8600',
  'http://localhost:19006',
];

export const config: AppConfig = {
  port: parseInt(process.env.PORT ?? '4000', 10),
  mongodbUri: requireEnv('MONGODB_URI'),
  jwtSecret,
  jwtRefreshSecret,
  nodeEnv,
  corsOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
    : nodeEnv === 'development'
      ? defaultDevOrigins
      : [],
};

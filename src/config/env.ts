import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(8080),
  MYSQL_HOST: z.string().default('127.0.0.1'),
  MYSQL_PORT: z.coerce.number().default(3306),
  MYSQL_USER: z.string().default('root'),
  MYSQL_PASSWORD: z.string(),
  MYSQL_DB: z.string().default('admin_db'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  CORS_ORIGIN: z.string().url().default('http://localhost:5173'),
  MONGO_URI: z.string().url(),
  MONGO_DB_NAME: z.string().default('admin_db'),
  EASY_PROMO_PROMOTION_FETCH_URL: z.string().url(),
  EASY_PROMO_API_KEY: z.string().min(1),
  EASY_PROMO_PARTICIPATION_FETCH_URL: z.string().url(),
  EASY_PROMO_UNIQUE_PARTICIPATION_FETCH_URL: z.string().url(),
  // SMTP settings for sending emails (used by utils/mail.ts)
  SMTP_HOST: z.string().default('mail.socio-fi.com'),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().default('noreply@socio-fi.com'),
  SMTP_PASS: z.string().default('n0r3ply@2021'),
  SMTP_SECURE: z.coerce.boolean().default(false),
});

const parseEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    console.error('❌ Invalid environment variables:', error);
    process.exit(1);
  }
};

export const env = parseEnv();

export default env;
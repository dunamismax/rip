import * as z from 'zod'

const EnvSchema = z.object({
  nodeEnv: z.enum(['development', 'test', 'production']),
  appUrl: z.string().url(),
  apiUrl: z.string().url(),
  port: z.number().int().min(1).max(65_535),
  databaseUrl: z.string().min(1, 'DATABASE_URL is required.'),
  betterAuthSecret: z
    .string()
    .min(32, 'BETTER_AUTH_SECRET must be at least 32 characters long.'),
  betterAuthUrl: z.string().url(),
  downloadDir: z.string(),
  maxConcurrentDownloads: z.number().int().min(1).max(10),
  maxIncompleteDownloads: z.number().int().min(1).max(500),
  ytdlpPath: z.string(),
  ffmpegPath: z.string(),
  trustedProxyHosts: z.array(z.string()),
  requestBodyLimitBytes: z
    .number()
    .int()
    .min(1_024)
    .max(5 * 1024 * 1024),
  completedExpirySeconds: z.number().int().min(60),
})

export type AppEnv = z.infer<typeof EnvSchema>

let cachedEnv: AppEnv | undefined

function readInteger(
  name: string,
  fallback: number,
  options: { minimum?: number; maximum?: number } = {}
) {
  const raw = process.env[name]?.trim()
  const value = raw ? Number.parseInt(raw, 10) : fallback

  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be an integer.`)
  }

  if (options.minimum !== undefined && value < options.minimum) {
    throw new Error(`${name} must be >= ${options.minimum}.`)
  }

  if (options.maximum !== undefined && value > options.maximum) {
    throw new Error(`${name} must be <= ${options.maximum}.`)
  }

  return value
}

function readCsv(name: string) {
  return (process.env[name] ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

export function loadEnv() {
  if (cachedEnv) {
    return cachedEnv
  }

  const nodeEnv = process.env.NODE_ENV?.trim() || 'development'
  const isTest = nodeEnv === 'test'

  const raw = {
    nodeEnv,
    appUrl: process.env.APP_URL?.trim() || 'http://127.0.0.1:3000',
    apiUrl: process.env.API_URL?.trim() || 'http://127.0.0.1:3001',
    port: readInteger('PORT', 3001, {
      minimum: 1,
      maximum: 65_535,
    }),
    databaseUrl:
      process.env.DATABASE_URL?.trim() ||
      (isTest ? 'postgresql://postgres:postgres@127.0.0.1:5432/rip_test' : ''),
    betterAuthSecret:
      process.env.BETTER_AUTH_SECRET?.trim() ||
      (isTest ? 'rip-test-secret-rip-test-secret-1234' : ''),
    betterAuthUrl:
      process.env.BETTER_AUTH_URL?.trim() ||
      process.env.APP_URL?.trim() ||
      'http://127.0.0.1:3000',
    downloadDir: process.env.DOWNLOAD_DIR?.trim() || '~/Downloads/Rip',
    maxConcurrentDownloads: readInteger('MAX_CONCURRENT_DOWNLOADS', 3, {
      minimum: 1,
      maximum: 10,
    }),
    maxIncompleteDownloads: readInteger('MAX_INCOMPLETE_DOWNLOADS', 50, {
      minimum: 1,
      maximum: 500,
    }),
    ytdlpPath: process.env.YTDLP_PATH?.trim() || 'yt-dlp',
    ffmpegPath: process.env.FFMPEG_PATH?.trim() || 'ffmpeg',
    trustedProxyHosts: readCsv('TRUSTED_PROXY_HOSTS'),
    requestBodyLimitBytes: readInteger(
      'REQUEST_BODY_LIMIT_BYTES',
      1024 * 1024,
      {
        minimum: 1_024,
        maximum: 5 * 1024 * 1024,
      }
    ),
    completedExpirySeconds: readInteger('COMPLETED_EXPIRY_SECONDS', 60 * 60, {
      minimum: 60,
    }),
  }

  const result = EnvSchema.safeParse(raw)

  if (!result.success) {
    throw new Error(
      result.error.issues[0]?.message ?? 'Invalid environment configuration.'
    )
  }

  cachedEnv = result.data
  return result.data
}

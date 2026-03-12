import * as z from 'zod'

const EnvSchema = z.object({
  nodeEnv: z.enum(['development', 'test', 'production']),
  appUrl: z.string(),
  databaseUrl: z.string().min(1, 'DATABASE_URL is required.'),
  betterAuthSecret: z.string().min(1, 'BETTER_AUTH_SECRET is required.'),
  betterAuthUrl: z.string(),
  downloadDir: z.string(),
  maxConcurrentDownloads: z.number().int().min(1).max(10),
  maxIncompleteDownloads: z.number().int().min(1).max(500),
  ytdlpPath: z.string(),
  ffmpegPath: z.string(),
  trustedProxyHosts: z.array(z.string()),
  otelServiceName: z.string(),
  otelExporterOtlpEndpoint: z.string(),
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

  const raw = {
    nodeEnv: process.env.NODE_ENV?.trim() || 'development',
    appUrl: process.env.APP_URL?.trim() || 'http://127.0.0.1:3000',
    databaseUrl: process.env.DATABASE_URL?.trim() || '',
    betterAuthSecret: process.env.BETTER_AUTH_SECRET?.trim() || '',
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
    otelServiceName: process.env.OTEL_SERVICE_NAME?.trim() || 'rip',
    otelExporterOtlpEndpoint:
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim() || '',
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

  const env = result.data

  cachedEnv = env
  return env
}

import { Schema } from 'effect'

const EnvSchema = Schema.Struct({
  nodeEnv: Schema.String,
  appUrl: Schema.String,
  databaseUrl: Schema.String,
  betterAuthSecret: Schema.String,
  betterAuthUrl: Schema.String,
  downloadDir: Schema.String,
  maxConcurrentDownloads: Schema.Number,
  maxIncompleteDownloads: Schema.Number,
  ytdlpPath: Schema.String,
  ffmpegPath: Schema.String,
  trustedProxyHosts: Schema.Array(Schema.String),
  aiProvider: Schema.String,
  openaiApiKey: Schema.String,
  openaiModel: Schema.String,
  otelServiceName: Schema.String,
  otelExporterOtlpEndpoint: Schema.String,
  requestBodyLimitBytes: Schema.Number,
  completedExpirySeconds: Schema.Number,
})

export type AppEnv = Schema.Schema.Type<typeof EnvSchema>

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
    aiProvider: process.env.AI_PROVIDER?.trim() || '',
    openaiApiKey: process.env.OPENAI_API_KEY?.trim() || '',
    openaiModel: process.env.OPENAI_MODEL?.trim() || '',
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

  const env = Schema.decodeUnknownSync(EnvSchema)(raw)

  if (!['development', 'test', 'production'].includes(env.nodeEnv)) {
    throw new Error('NODE_ENV must be development, test, or production.')
  }

  if (!env.databaseUrl) {
    throw new Error('DATABASE_URL is required.')
  }

  if (!env.betterAuthSecret) {
    throw new Error('BETTER_AUTH_SECRET is required.')
  }

  cachedEnv = env
  return env
}

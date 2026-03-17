import { constants } from 'node:fs'
import { access, readFile } from 'node:fs/promises'
import { dirname, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CancelDownloadResponseSchema,
  DownloadsResponseSchema,
  ErrorResponseSchema,
  ExtractRequestSchema,
  ExtractResponseSchema,
  OkResponseSchema,
  QueueDownloadRequestSchema,
  QueueDownloadResponseSchema,
} from '@rip/contracts'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { loadEnv } from './env'
import { auth, getSessionResponse, requireSession } from './lib/auth'
import { getDownloadManager } from './lib/download-manager'
import { AppError, toAppError } from './lib/errors'
import { readValidatedJson } from './lib/http'
import { RateLimiter } from './lib/rate-limiter'
import { resolveStaticAssetPath } from './lib/static-assets'
import { extractMetadata } from './lib/ytdlp'

const extractLimiter = new RateLimiter(10, 60_000)
const downloadLimiter = new RateLimiter(20, 60_000)
const webDistRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../web/dist'
)

const assetContentTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.avif': 'image/avif',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

export function createApp() {
  const env = loadEnv()
  const app = new Hono()

  app.use(
    '/api/*',
    cors({
      origin: env.appUrl,
      allowHeaders: ['Content-Type', 'Authorization'],
      allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      exposeHeaders: ['Content-Length'],
      maxAge: 600,
      credentials: true,
    })
  )

  app.onError((error, _c) => {
    if (!(error instanceof AppError)) {
      console.error(error)
    }

    const appError = toAppError(error)
    const payload = ErrorResponseSchema.parse({
      error: appError.message,
    })

    return new Response(JSON.stringify(payload), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
      },
      status: appError.status,
    })
  })

  app.on(['POST', 'GET'], '/api/auth/*', (c) => auth.handler(c.req.raw))

  app.get('/api/health', (c) =>
    c.json(
      OkResponseSchema.parse({
        status: 'ok',
      })
    )
  )

  app.get('/api/session', async (c) => {
    const response = await getSessionResponse(c.req.raw)
    return c.json(response)
  })

  app.post('/api/extract', async (c) => {
    const session = await requireSession(c.req.raw)

    if (!extractLimiter.allow(session.user.id)) {
      throw new AppError(
        429,
        'Too many requests. Please wait before trying again.'
      )
    }

    const payload = await readValidatedJson(
      c.req.raw,
      ExtractRequestSchema,
      'Invalid URL.'
    )
    const metadata = await extractMetadata(payload.url)

    return c.json(
      ExtractResponseSchema.parse({
        metadata,
      })
    )
  })

  app.post('/api/download', async (c) => {
    const session = await requireSession(c.req.raw)

    if (!downloadLimiter.allow(session.user.id)) {
      throw new AppError(
        429,
        'Too many requests. Please wait before trying again.'
      )
    }

    const payload = await readValidatedJson(
      c.req.raw,
      QueueDownloadRequestSchema,
      'Invalid download request.'
    )

    const id = await getDownloadManager().queueDownload(
      session.user.id,
      payload
    )

    if (!id) {
      throw new AppError(
        429,
        'Too many active or queued downloads. Please wait for some to finish.'
      )
    }

    return c.json(
      QueueDownloadResponseSchema.parse({
        id,
      }),
      {
        status: 201,
      }
    )
  })

  app.get('/api/downloads', async (c) => {
    const session = await requireSession(c.req.raw)
    const downloads = await getDownloadManager().listDownloads(session.user.id)

    return c.json(
      DownloadsResponseSchema.parse({
        downloads,
      })
    )
  })

  app.delete('/api/download/:downloadId', async (c) => {
    const session = await requireSession(c.req.raw)
    const result = await getDownloadManager().cancelDownload(
      session.user.id,
      c.req.param('downloadId')
    )

    if (result === 'not_found') {
      throw new AppError(404, 'Download not found.')
    }

    if (result === 'not_cancellable') {
      throw new AppError(409, 'This download can no longer be cancelled.')
    }

    return c.json(
      CancelDownloadResponseSchema.parse({
        status: 'cancelled',
      })
    )
  })

  app.delete('/api/downloads/completed', async (c) => {
    const session = await requireSession(c.req.raw)
    await getDownloadManager().clearCompleted(session.user.id)

    return c.json(
      OkResponseSchema.parse({
        status: 'ok',
      })
    )
  })

  app.get('*', async (c, next) => {
    if (c.req.path.startsWith('/api/')) {
      return next()
    }

    const asset = await readAsset(c.req.path)

    if (asset) {
      return c.body(asset.body, 200, {
        'content-type': asset.contentType,
      })
    }

    return next()
  })

  app.notFound(async (c) => {
    if (c.req.path.startsWith('/api/')) {
      return c.json(
        ErrorResponseSchema.parse({
          error: 'Not found.',
        }),
        {
          status: 404,
        }
      )
    }

    const indexAsset = await readAsset('/index.html')

    if (!indexAsset) {
      return c.text(
        'The SPA has not been built yet. Run `pnpm build` or start the Vite app in development.',
        503
      )
    }

    return c.body(indexAsset.body, 200, {
      'content-type': 'text/html; charset=utf-8',
    })
  })

  return app
}

async function readAsset(requestPath: string) {
  const absolutePath = resolveStaticAssetPath(webDistRoot, requestPath)

  if (!absolutePath) {
    return null
  }

  try {
    await access(absolutePath, constants.R_OK)
    const body = await readFile(absolutePath)
    return {
      body,
      contentType:
        assetContentTypes[extname(absolutePath)] ?? 'application/octet-stream',
    }
  } catch {
    return null
  }
}

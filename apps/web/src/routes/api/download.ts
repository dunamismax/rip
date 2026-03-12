import {
  QueueDownloadRequestSchema,
  QueueDownloadResponseSchema,
} from '@rip/contracts'
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { Effect, Schema } from 'effect'
import { requireSession } from '#/lib/auth'
import { getDownloadManager } from '#/server/download-manager'
import { AppError } from '#/server/errors'
import { errorResponse, getClientIp, readValidatedJson } from '#/server/http'
import { RateLimiter } from '#/server/rate-limiter'

const downloadLimiter = new RateLimiter(20, 60_000)

export const Route = createFileRoute('/api/download')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const session = await requireSession(request)

          if (!downloadLimiter.allow(getClientIp(request))) {
            return json(
              {
                error: 'Too many requests. Please wait before trying again.',
              },
              {
                status: 429,
              }
            )
          }

          const id = await Effect.runPromise(
            Effect.gen(function* () {
              const payload = yield* Effect.tryPromise(() =>
                readValidatedJson(
                  request,
                  QueueDownloadRequestSchema,
                  'Invalid download request.'
                )
              )

              const id = yield* Effect.tryPromise(() =>
                getDownloadManager().queueDownload(session.user.id, payload)
              )

              if (!id) {
                throw new AppError(
                  429,
                  'Too many active or queued downloads. Please wait for some to finish.'
                )
              }

              return id
            })
          )

          const response = await Schema.encode(QueueDownloadResponseSchema)({
            id,
          })

          return json(response, {
            status: 201,
          })
        } catch (error) {
          return errorResponse(error)
        }
      },
    },
  },
})

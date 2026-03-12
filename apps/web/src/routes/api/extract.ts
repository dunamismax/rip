import { ExtractRequestSchema, ExtractResponseSchema } from '@rip/contracts'
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { Effect, Schema } from 'effect'
import { requireSession } from '#/lib/auth'
import { errorResponse, getClientIp, readValidatedJson } from '#/server/http'
import { RateLimiter } from '#/server/rate-limiter'
import { extractMetadata } from '#/server/ytdlp'

const extractLimiter = new RateLimiter(10, 60_000)

export const Route = createFileRoute('/api/extract')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          await requireSession(request)

          if (!extractLimiter.allow(getClientIp(request))) {
            return json(
              {
                error: 'Too many requests. Please wait before trying again.',
              },
              {
                status: 429,
              }
            )
          }

          const metadata = await Effect.runPromise(
            Effect.gen(function* () {
              const payload = yield* Effect.tryPromise(() =>
                readValidatedJson(request, ExtractRequestSchema, 'Invalid URL.')
              )
              return yield* Effect.tryPromise(() =>
                extractMetadata(payload.url)
              )
            })
          )

          const response = await Schema.encode(ExtractResponseSchema)({
            metadata,
          })

          return json(response)
        } catch (error) {
          return errorResponse(error)
        }
      },
    },
  },
})

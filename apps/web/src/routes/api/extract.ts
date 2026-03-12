import {
  ErrorResponseSchema,
  ExtractRequestSchema,
  ExtractResponseSchema,
} from '@rip/contracts'
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
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
              ErrorResponseSchema.parse({
                error: 'Too many requests. Please wait before trying again.',
              }),
              {
                status: 429,
              }
            )
          }

          const payload = await readValidatedJson(
            request,
            ExtractRequestSchema,
            'Invalid URL.'
          )
          const metadata = await extractMetadata(payload.url)

          return json(ExtractResponseSchema.parse({ metadata }))
        } catch (error) {
          return errorResponse(error)
        }
      },
    },
  },
})

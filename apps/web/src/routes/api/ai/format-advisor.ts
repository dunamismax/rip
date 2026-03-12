import { VideoMetadataSchema } from '@rip/contracts'
import { chat, toServerSentEventsResponse } from '@tanstack/ai'
import type { OpenAIChatModel } from '@tanstack/ai-openai'
import { openaiText } from '@tanstack/ai-openai'
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { Schema } from 'effect'
import { requireSession } from '#/lib/auth'
import { loadEnv } from '#/server/env'
import { AppError } from '#/server/errors'
import { errorResponse, readJsonBody } from '#/server/http'

export const Route = createFileRoute('/api/ai/format-advisor')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          await requireSession(request)

          const env = loadEnv()

          if (
            env.aiProvider !== 'openai' ||
            !env.openaiApiKey ||
            !env.openaiModel
          ) {
            throw new AppError(
              503,
              'AI format advisor is not configured on this deployment.'
            )
          }

          const body = await readJsonBody(request)
          const metadata = await Schema.decodeUnknownPromise(
            VideoMetadataSchema
          )(body.metadata)
          const messages = Array.isArray(body.messages) ? body.messages : []

          const stream = chat({
            adapter: openaiText(env.openaiModel as OpenAIChatModel),
            systemPrompts: [
              [
                'You are a precise download-format advisor for a self-hosted yt-dlp app.',
                'Recommend one formatId and one output extension based on the user goal.',
                'Prefer exact references to available formats only.',
                'Explain tradeoffs around filesize, quality, compatibility, audio/video availability, and remux or audio extraction behavior.',
                'If there is not enough information, ask one short follow-up question.',
                'Current metadata JSON:',
                JSON.stringify(metadata),
              ].join('\n'),
            ],
            messages,
          })

          return toServerSentEventsResponse(stream)
        } catch (error) {
          if (error instanceof AppError) {
            return json(
              {
                error: error.message,
              },
              {
                status: error.status,
              }
            )
          }

          return errorResponse(error)
        }
      },
    },
  },
})

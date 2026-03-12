import {
  CancelDownloadResponseSchema,
  ErrorResponseSchema,
} from '@rip/contracts'
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { Schema } from 'effect'
import { requireSession } from '#/lib/auth'
import { getDownloadManager } from '#/server/download-manager'
import { errorResponse } from '#/server/http'

export const Route = createFileRoute('/api/download/$downloadId')({
  server: {
    handlers: {
      DELETE: async ({ request, params }) => {
        try {
          const session = await requireSession(request)
          const result = await getDownloadManager().cancelDownload(
            session.user.id,
            params.downloadId
          )

          if (result === 'not_found') {
            return json(
              await Schema.encode(ErrorResponseSchema)({
                error: 'Download not found.',
              }),
              {
                status: 404,
              }
            )
          }

          if (result === 'not_cancellable') {
            return json(
              await Schema.encode(ErrorResponseSchema)({
                error: 'Download can only be cancelled while queued or active.',
              }),
              {
                status: 409,
              }
            )
          }

          return json(
            await Schema.encode(CancelDownloadResponseSchema)({
              status: 'cancelled',
            })
          )
        } catch (error) {
          return errorResponse(error)
        }
      },
    },
  },
})

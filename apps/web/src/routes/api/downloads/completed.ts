import { OkResponseSchema } from '@rip/contracts'
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { requireSession } from '#/lib/auth'
import { getDownloadManager } from '#/server/download-manager'
import { errorResponse } from '#/server/http'

export const Route = createFileRoute('/api/downloads/completed')({
  server: {
    handlers: {
      DELETE: async ({ request }) => {
        try {
          const session = await requireSession(request)
          await getDownloadManager().clearCompleted(session.user.id)

          return json(
            OkResponseSchema.parse({
              status: 'ok',
            })
          )
        } catch (error) {
          return errorResponse(error)
        }
      },
    },
  },
})

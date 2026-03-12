import { DownloadsResponseSchema } from '@rip/contracts'
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'
import { requireSession } from '#/lib/auth'
import { getDownloadManager } from '#/server/download-manager'
import { errorResponse } from '#/server/http'

export const Route = createFileRoute('/api/downloads')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const session = await requireSession(request)
          const downloads = await getDownloadManager().listDownloads(
            session.user.id
          )

          return json(
            DownloadsResponseSchema.parse({
              downloads,
            })
          )
        } catch (error) {
          return errorResponse(error)
        }
      },
    },
  },
})

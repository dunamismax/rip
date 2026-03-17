import type {
  DownloadsResponse,
  ExtractRequest,
  QueueDownloadRequest,
  SessionResponse,
} from '@rip/contracts'
import {
  CancelDownloadResponseSchema,
  DownloadsResponseSchema,
  ErrorResponseSchema,
  ExtractResponseSchema,
  OkResponseSchema,
  QueueDownloadResponseSchema,
  SessionResponseSchema,
} from '@rip/contracts'
import type { ZodType } from 'zod'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function requestJson<T>(
  input: RequestInfo | URL,
  init: RequestInit,
  schema: ZodType<T>
) {
  const response = await fetch(input, {
    credentials: 'include',
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    const parsed = await ErrorResponseSchema.safeParseAsync(payload)

    throw new ApiError(
      response.status,
      parsed.success ? parsed.data.error : 'Request failed. Please try again.'
    )
  }

  const parsed = await schema.safeParseAsync(payload)

  if (!parsed.success) {
    throw new ApiError(response.status, 'Invalid server response.')
  }

  return parsed.data
}

export const api = {
  getSession(): Promise<SessionResponse> {
    return requestJson(
      '/api/session',
      {
        method: 'GET',
      },
      SessionResponseSchema
    )
  },

  extract(payload: ExtractRequest) {
    return requestJson(
      '/api/extract',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      ExtractResponseSchema
    )
  },

  queueDownload(payload: QueueDownloadRequest) {
    return requestJson(
      '/api/download',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      QueueDownloadResponseSchema
    )
  },

  listDownloads(): Promise<DownloadsResponse> {
    return requestJson(
      '/api/downloads',
      {
        method: 'GET',
      },
      DownloadsResponseSchema
    )
  },

  cancelDownload(downloadId: string) {
    return requestJson(
      `/api/download/${downloadId}`,
      {
        method: 'DELETE',
      },
      CancelDownloadResponseSchema
    )
  },

  clearCompleted() {
    return requestJson(
      '/api/downloads/completed',
      {
        method: 'DELETE',
      },
      OkResponseSchema
    )
  },
}

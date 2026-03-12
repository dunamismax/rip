import type {
  DownloadsResponse,
  ExtractRequest,
  QueueDownloadRequest,
} from '@rip/contracts'
import {
  CancelDownloadResponseSchema,
  DownloadsResponseSchema,
  ErrorResponseSchema,
  ExtractResponseSchema,
  OkResponseSchema,
  QueueDownloadResponseSchema,
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

  listDownloads() {
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

export function hasActiveDownloads(response: DownloadsResponse | undefined) {
  return (
    response?.downloads.some((item) =>
      ['queued', 'downloading', 'processing'].includes(item.status)
    ) ?? false
  )
}

export function formatBytes(value: number | null | undefined) {
  if (!value || value <= 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = value
  let index = 0

  while (size >= 1024 && index < units.length - 1) {
    size /= 1024
    index += 1
  }

  return `${size.toFixed(1)} ${units[index]}`
}

export function formatDuration(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return '--'
  }

  const total = Math.max(0, Math.trunc(value))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60

  if (hours) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function formatSpeed(value: number | null | undefined) {
  if (!value) {
    return '--'
  }

  return `${formatBytes(value)}/s`
}

import type { DownloadsResponse } from '@rip/contracts'

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

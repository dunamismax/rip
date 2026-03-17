import {
  audioExtensions,
  type OutputExtension,
  videoExtensions,
} from '@rip/contracts'
import { AppError } from './errors'

const audioExtensionSet = new Set<string>(audioExtensions)
const videoExtensionSet = new Set<string>(videoExtensions)

export function normalizeExtension(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase().replace(/^\./, '')
}

export function validateOutputExtension(
  value: string,
  sourceExt?: string | null
): OutputExtension {
  const normalized = normalizeExtension(value)
  const normalizedSource = normalizeExtension(sourceExt)

  if (!normalized) {
    throw new AppError(400, 'Output format is required.')
  }

  if (normalized === normalizedSource) {
    return normalized as OutputExtension
  }

  if (
    audioExtensionSet.has(normalized as OutputExtension) ||
    videoExtensionSet.has(normalized as OutputExtension)
  ) {
    return normalized as OutputExtension
  }

  throw new AppError(400, `Unsupported output format '${normalized}'.`)
}

export function outputKind(value: string) {
  const normalized = validateOutputExtension(value)

  if (audioExtensionSet.has(normalized)) {
    return 'audio' as const
  }

  return 'video' as const
}

export function outputExtensions(options: {
  sourceExt?: string | null
  hasVideo: boolean
  hasAudio: boolean
}) {
  const values: string[] = []
  const normalizedSource = normalizeExtension(options.sourceExt)

  if (normalizedSource) {
    values.push(normalizedSource)
  }

  if (options.hasVideo) {
    values.push(...videoExtensions)
  }

  if (options.hasAudio) {
    values.push(...audioExtensions)
  }

  return [...new Set(values)] as OutputExtension[]
}

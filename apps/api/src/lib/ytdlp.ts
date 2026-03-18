import { spawn } from 'node:child_process'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import { createInterface } from 'node:readline'
import type {
  DownloadItem,
  DownloadProgress,
  QueueDownloadRequest,
  VideoMetadata,
} from '@rip/contracts'
import { loadEnv } from '../env'
import {
  outputExtensions,
  outputKind,
  validateOutputExtension,
} from './download-options'
import { AppError } from './errors'

export const PROGRESS_PREFIX = 'rip-progress:'
export const OUTPUT_PREFIX = 'rip-output:'

export class YtdlpError extends AppError {
  constructor(message: string, cause?: unknown) {
    super(500, message, cause)
    this.name = 'YtdlpError'
  }
}

export function resolveDownloadDirectory(downloadDir: string) {
  if (downloadDir.startsWith('~/')) {
    return resolve(homedir(), downloadDir.slice(2))
  }

  return resolve(downloadDir)
}

export async function extractMetadata(url: string) {
  const env = loadEnv()
  const child = spawn(
    env.ytdlpPath,
    [
      '--dump-single-json',
      '--no-download',
      '--no-playlist',
      '--no-warnings',
      url,
    ],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  )

  let stdout = ''
  let stderr = ''
  let exitCode = 1

  try {
    ;[stdout, stderr, exitCode] = await Promise.all([
      streamToString(child.stdout),
      streamToString(child.stderr),
      onceExit(child),
    ])
  } catch (error) {
    throw new YtdlpError(
      'yt-dlp could not be started. Check YTDLP_PATH and file permissions.',
      error
    )
  }

  if (exitCode !== 0) {
    throw new YtdlpError(stderr.trim() || 'yt-dlp failed to extract metadata.')
  }

  return mapMetadata(parseMetadataOutput(stdout, stderr))
}

export function buildDownloadArgs(payload: QueueDownloadRequest) {
  const env = loadEnv()
  const outputTemplate = `${resolveDownloadDirectory(
    env.downloadDir
  )}/%(title).200s [%(id)s].%(ext)s`

  const args = [
    '-f',
    payload.formatId,
    '-o',
    outputTemplate,
    '--ffmpeg-location',
    env.ffmpegPath,
    '--newline',
    '--progress-template',
    [
      'download:',
      `${PROGRESS_PREFIX}`,
      '%(progress.downloaded_bytes)s|%(progress.total_bytes)s|%(progress.total_bytes_estimate)s|',
      '%(progress.speed)s|%(progress.eta)s|%(progress.status)s',
    ].join(''),
    '--print',
    `after_move:${OUTPUT_PREFIX}%(filepath)s`,
    '--no-warnings',
    '--no-playlist',
    '--restrict-filenames',
  ]

  args.push(
    ...buildOutputArgs({
      preferredExt: payload.ext,
      sourceExt: payload.sourceExt,
      hasVideo: payload.hasVideo,
      hasAudio: payload.hasAudio,
    })
  )
  args.push(payload.url)

  return args
}

export function parseProgressLine(line: string): DownloadProgress | null {
  const parts = line.split('|')

  if (parts.length < 6) {
    return null
  }

  const downloadedBytes = parseNumber(parts[0]) ?? 0
  const totalBytes = parseNumber(parts[1])
  const totalBytesEstimate = parseNumber(parts[2])
  const speed = parseNumber(parts[3])
  const eta = parseNumber(parts[4])
  const effectiveTotal = totalBytes || totalBytesEstimate
  const percentage = effectiveTotal
    ? Math.min(100, Math.round((downloadedBytes / effectiveTotal) * 1000) / 10)
    : 0

  return {
    downloadedBytes: Math.trunc(downloadedBytes),
    totalBytes: effectiveTotal ? Math.trunc(effectiveTotal) : null,
    speed,
    eta: eta ? Math.trunc(eta) : null,
    percentage,
  }
}

export async function consumeDownloadStdout(
  _item: DownloadItem,
  stream: NodeJS.ReadableStream,
  onProgress: (progress: DownloadProgress) => Promise<void>,
  onOutputPath: (outputPath: string) => Promise<void>,
  onProcessing: () => Promise<void>
) {
  const reader = createInterface({ input: stream })

  for await (const line of reader) {
    const text = line.trim()

    if (!text) {
      continue
    }

    if (text.startsWith(PROGRESS_PREFIX)) {
      const progress = parseProgressLine(text.slice(PROGRESS_PREFIX.length))

      if (progress) {
        await onProgress(progress)
      }

      continue
    }

    if (text.startsWith(OUTPUT_PREFIX)) {
      await onOutputPath(text.slice(OUTPUT_PREFIX.length).trim())
      continue
    }

    if (text.startsWith('[download] Destination:')) {
      await onOutputPath(text.replace('[download] Destination:', '').trim())
      continue
    }

    if (text.startsWith('[Merger]') || text.startsWith('[ExtractAudio]')) {
      await onProcessing()
    }
  }
}

function buildOutputArgs(options: {
  preferredExt: string
  sourceExt?: string | null
  hasVideo?: boolean | null
  hasAudio?: boolean | null
}) {
  const normalizedExt = validateOutputExtension(
    options.preferredExt,
    options.sourceExt
  )
  const normalizedSource = options.sourceExt
    ? validateOutputExtension(options.sourceExt)
    : null

  if (normalizedSource && normalizedExt === normalizedSource) {
    return []
  }

  if (outputKind(normalizedExt) === 'audio') {
    if (options.hasAudio === false) {
      throw new AppError(400, 'The selected format does not contain audio.')
    }

    return ['--extract-audio', '--audio-format', normalizedExt]
  }

  if (options.hasVideo === false) {
    throw new AppError(400, 'The selected format does not contain video.')
  }

  return ['--remux-video', normalizedExt]
}

export function mapMetadata(raw: Record<string, unknown>): VideoMetadata {
  const formats = Array.isArray(raw.formats)
    ? raw.formats
        .filter(
          (entry): entry is Record<string, unknown> =>
            Boolean(entry) && typeof entry === 'object'
        )
        .flatMap((entry) => {
          const format = mapFormat(entry)
          return format ? [format] : []
        })
        .filter(
          (format) =>
            format.formatId !== 'storyboard' &&
            !(format.formatNote?.includes('storyboard') ?? false)
        )
    : []

  return {
    id: asString(raw.id) || 'unknown',
    title: asString(raw.title) || 'Untitled',
    thumbnail: asNullableString(raw.thumbnail),
    duration: asNullableNumber(raw.duration),
    uploader: asNullableString(raw.uploader) ?? asNullableString(raw.channel),
    uploadDate: asNullableString(raw.upload_date),
    viewCount: asNullableNumber(raw.view_count),
    description: asNullableString(raw.description),
    webpageUrl:
      asString(raw.webpage_url) || asString(raw.url) || 'https://example.com',
    extractor:
      asString(raw.extractor_key) || asString(raw.extractor) || 'unknown',
    formats,
  }
}

function mapFormat(raw: Record<string, unknown>) {
  const vcodec = asNullableString(raw.vcodec)
  const acodec = asNullableString(raw.acodec)
  const hasVideo = Boolean(vcodec && vcodec !== 'none')
  const hasAudio = Boolean(acodec && acodec !== 'none')
  const ext = asString(raw.ext) || 'mp4'
  const formatId = asString(raw.format_id) || ''

  if (!formatId) {
    return null
  }

  try {
    const normalizedExt = validateOutputExtension(ext)

    return {
      formatId,
      ext: normalizedExt,
      resolution: asNullableString(raw.resolution),
      filesize: asNullableNumber(raw.filesize),
      filesizeApprox: asNullableNumber(raw.filesize_approx),
      vcodec: hasVideo ? vcodec : null,
      acodec: hasAudio ? acodec : null,
      fps: asNullableNumber(raw.fps),
      tbr: asNullableNumber(raw.tbr),
      formatNote: asNullableString(raw.format_note),
      hasVideo,
      hasAudio,
      outputExtensions: outputExtensions({
        sourceExt: normalizedExt,
        hasVideo,
        hasAudio,
      }),
    }
  } catch (error) {
    if (
      error instanceof AppError &&
      error.message.startsWith('Unsupported output format')
    ) {
      return null
    }

    throw error
  }
}

export function parseMetadataOutput(stdout: string, stderr = '') {
  const normalizedStdout = stdout.trim()
  const normalizedStderr = stderr.trim()

  if (!normalizedStdout) {
    throw new YtdlpError(
      normalizedStderr || 'yt-dlp did not return any metadata.'
    )
  }

  for (const candidate of buildJsonCandidates(normalizedStdout)) {
    try {
      const parsed = JSON.parse(candidate)

      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      // Keep trying narrower candidates below.
    }
  }

  if (normalizedStdout === 'null') {
    throw new YtdlpError(
      normalizedStderr || 'yt-dlp could not extract metadata for this URL.'
    )
  }

  throw new YtdlpError(
    normalizedStderr || 'yt-dlp returned an unexpected metadata payload.'
  )
}

function buildJsonCandidates(stdout: string) {
  const candidates = new Set<string>([stdout])
  const firstBrace = stdout.indexOf('{')
  const lastBrace = stdout.lastIndexOf('}')

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    candidates.add(stdout.slice(firstBrace, lastBrace + 1))
  }

  const lines = stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]

    if (line?.startsWith('{')) {
      candidates.add(lines.slice(index).join('\n'))
    }
  }

  return candidates
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function asNullableString(value: unknown) {
  return typeof value === 'string' && value ? value : null
}

function asNullableNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value)
  }

  return null
}

function parseNumber(raw: string | undefined) {
  if (!raw) {
    return null
  }

  const text = raw.trim()

  if (!text || text === 'NA' || text === 'N/A' || text === 'None') {
    return null
  }

  const value = Number.parseFloat(text)
  return Number.isFinite(value) ? value : null
}

async function streamToString(stream: NodeJS.ReadableStream | null) {
  if (!stream) {
    return ''
  }

  const chunks: Uint8Array[] = []

  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }

  return Buffer.concat(chunks).toString('utf8')
}

function onceExit(child: ReturnType<typeof spawn>) {
  return new Promise<number>((resolve, reject) => {
    child.once('error', reject)
    child.once('close', (code) => resolve(code ?? 1))
  })
}

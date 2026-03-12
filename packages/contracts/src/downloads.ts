import * as z from 'zod'

export const audioExtensions = [
  'aac',
  'alac',
  'flac',
  'm4a',
  'mp3',
  'opus',
  'vorbis',
  'wav',
] as const

export const videoExtensions = [
  'avi',
  'flv',
  'gif',
  'mkv',
  'mov',
  'mp4',
  'webm',
] as const

export const downloadStatuses = [
  'queued',
  'downloading',
  'processing',
  'completed',
  'failed',
  'cancelled',
] as const

const outputExtensions = [...audioExtensions, ...videoExtensions] as const

const NonEmptyString = z.string().min(1)
const NullableString = z.string().nullable()
const NullableNumber = z.number().nullable()
const NullableBoolean = z.boolean().nullable()
const UrlString = z
  .string()
  .url()
  .refine((value) => /^https?:\/\//i.test(value), {
    message: 'An absolute HTTP or HTTPS URL',
  })

export const DownloadStatusSchema = z.enum(downloadStatuses)

export const OutputExtensionSchema = z.enum(outputExtensions)

export const VideoFormatSchema = z.object({
  formatId: NonEmptyString,
  ext: OutputExtensionSchema,
  resolution: NullableString,
  filesize: NullableNumber,
  filesizeApprox: NullableNumber,
  vcodec: NullableString,
  acodec: NullableString,
  fps: NullableNumber,
  tbr: NullableNumber,
  formatNote: NullableString,
  hasVideo: z.boolean(),
  hasAudio: z.boolean(),
  outputExtensions: z.array(OutputExtensionSchema),
})

export const VideoMetadataSchema = z.object({
  id: NonEmptyString,
  title: NonEmptyString,
  thumbnail: NullableString,
  duration: NullableNumber,
  uploader: NullableString,
  uploadDate: NullableString,
  viewCount: NullableNumber,
  description: NullableString,
  webpageUrl: UrlString,
  extractor: NonEmptyString,
  formats: z.array(VideoFormatSchema),
})

export const DownloadProgressSchema = z.object({
  downloadedBytes: z.number(),
  totalBytes: NullableNumber,
  speed: NullableNumber,
  eta: NullableNumber,
  percentage: z.number(),
})

export const DownloadItemSchema = z.object({
  id: NonEmptyString,
  userId: NonEmptyString,
  url: UrlString,
  title: NonEmptyString,
  thumbnail: NullableString,
  formatId: NonEmptyString,
  ext: OutputExtensionSchema,
  sourceExt: OutputExtensionSchema.nullable(),
  hasVideo: NullableBoolean,
  hasAudio: NullableBoolean,
  outputPath: NullableString,
  status: DownloadStatusSchema,
  progress: DownloadProgressSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: NullableString,
  error: NullableString,
})

export const ExtractRequestSchema = z.object({
  url: UrlString,
})

export const QueueDownloadRequestSchema = z.object({
  url: UrlString,
  formatId: NonEmptyString,
  title: NonEmptyString,
  thumbnail: NullableString,
  ext: OutputExtensionSchema,
  sourceExt: OutputExtensionSchema.nullable(),
  hasVideo: NullableBoolean,
  hasAudio: NullableBoolean,
})

export const ExtractResponseSchema = z.object({
  metadata: VideoMetadataSchema,
})

export const QueueDownloadResponseSchema = z.object({
  id: NonEmptyString,
})

export const DownloadsResponseSchema = z.object({
  downloads: z.array(DownloadItemSchema),
})

export const CancelDownloadResponseSchema = z.object({
  status: z.literal('cancelled'),
})

export const OkResponseSchema = z.object({
  status: z.literal('ok'),
})

export const ErrorResponseSchema = z.object({
  error: NonEmptyString,
})

export type DownloadStatus = z.infer<typeof DownloadStatusSchema>
export type OutputExtension = z.infer<typeof OutputExtensionSchema>
export type VideoFormat = z.infer<typeof VideoFormatSchema>
export type VideoMetadata = z.infer<typeof VideoMetadataSchema>
export type DownloadProgress = z.infer<typeof DownloadProgressSchema>
export type DownloadItem = z.infer<typeof DownloadItemSchema>
export type ExtractRequest = z.infer<typeof ExtractRequestSchema>
export type QueueDownloadRequest = z.infer<typeof QueueDownloadRequestSchema>
export type ExtractResponse = z.infer<typeof ExtractResponseSchema>
export type QueueDownloadResponse = z.infer<typeof QueueDownloadResponseSchema>
export type DownloadsResponse = z.infer<typeof DownloadsResponseSchema>
export type CancelDownloadResponse = z.infer<
  typeof CancelDownloadResponseSchema
>
export type OkResponse = z.infer<typeof OkResponseSchema>
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>

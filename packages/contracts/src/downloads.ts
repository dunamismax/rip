import { Schema } from 'effect'

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

const UrlString = Schema.String.pipe(
  Schema.pattern(/^https?:\/\/.+/i),
  Schema.annotations({
    identifier: 'UrlString',
    description: 'An absolute HTTP or HTTPS URL',
  })
)

const NullableString = Schema.NullOr(Schema.String)
const NullableNumber = Schema.NullOr(Schema.Number)
const NullableBoolean = Schema.NullOr(Schema.Boolean)

export const DownloadStatusSchema = Schema.Literal(...downloadStatuses)

export const OutputExtensionSchema = Schema.Literal(
  ...audioExtensions,
  ...videoExtensions
)

export const VideoFormatSchema = Schema.Struct({
  formatId: Schema.NonEmptyString,
  ext: OutputExtensionSchema,
  resolution: NullableString,
  filesize: NullableNumber,
  filesizeApprox: NullableNumber,
  vcodec: NullableString,
  acodec: NullableString,
  fps: NullableNumber,
  tbr: NullableNumber,
  formatNote: NullableString,
  hasVideo: Schema.Boolean,
  hasAudio: Schema.Boolean,
  outputExtensions: Schema.Array(OutputExtensionSchema),
})

export const VideoMetadataSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  title: Schema.NonEmptyString,
  thumbnail: NullableString,
  duration: NullableNumber,
  uploader: NullableString,
  uploadDate: NullableString,
  viewCount: NullableNumber,
  description: NullableString,
  webpageUrl: UrlString,
  extractor: Schema.NonEmptyString,
  formats: Schema.Array(VideoFormatSchema),
})

export const DownloadProgressSchema = Schema.Struct({
  downloadedBytes: Schema.Number,
  totalBytes: NullableNumber,
  speed: NullableNumber,
  eta: NullableNumber,
  percentage: Schema.Number,
})

export const DownloadItemSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  userId: Schema.NonEmptyString,
  url: UrlString,
  title: Schema.NonEmptyString,
  thumbnail: NullableString,
  formatId: Schema.NonEmptyString,
  ext: OutputExtensionSchema,
  sourceExt: Schema.NullOr(OutputExtensionSchema),
  hasVideo: NullableBoolean,
  hasAudio: NullableBoolean,
  outputPath: NullableString,
  status: DownloadStatusSchema,
  progress: DownloadProgressSchema,
  createdAt: Schema.String,
  updatedAt: Schema.String,
  completedAt: NullableString,
  error: NullableString,
})

export const ExtractRequestSchema = Schema.Struct({
  url: UrlString,
})

export const QueueDownloadRequestSchema = Schema.Struct({
  url: UrlString,
  formatId: Schema.NonEmptyString,
  title: Schema.NonEmptyString,
  thumbnail: NullableString,
  ext: OutputExtensionSchema,
  sourceExt: Schema.NullOr(OutputExtensionSchema),
  hasVideo: NullableBoolean,
  hasAudio: NullableBoolean,
})

export const ExtractResponseSchema = Schema.Struct({
  metadata: VideoMetadataSchema,
})

export const QueueDownloadResponseSchema = Schema.Struct({
  id: Schema.NonEmptyString,
})

export const DownloadsResponseSchema = Schema.Struct({
  downloads: Schema.Array(DownloadItemSchema),
})

export const CancelDownloadResponseSchema = Schema.Struct({
  status: Schema.Literal('cancelled'),
})

export const OkResponseSchema = Schema.Struct({
  status: Schema.Literal('ok'),
})

export const ErrorResponseSchema = Schema.Struct({
  error: Schema.NonEmptyString,
})

export type DownloadStatus = Schema.Schema.Type<typeof DownloadStatusSchema>
export type OutputExtension = Schema.Schema.Type<typeof OutputExtensionSchema>
export type VideoFormat = Schema.Schema.Type<typeof VideoFormatSchema>
export type VideoMetadata = Schema.Schema.Type<typeof VideoMetadataSchema>
export type DownloadProgress = Schema.Schema.Type<typeof DownloadProgressSchema>
export type DownloadItem = Schema.Schema.Type<typeof DownloadItemSchema>
export type ExtractRequest = Schema.Schema.Type<typeof ExtractRequestSchema>
export type QueueDownloadRequest = Schema.Schema.Type<
  typeof QueueDownloadRequestSchema
>
export type ExtractResponse = Schema.Schema.Type<typeof ExtractResponseSchema>
export type QueueDownloadResponse = Schema.Schema.Type<
  typeof QueueDownloadResponseSchema
>
export type DownloadsResponse = Schema.Schema.Type<
  typeof DownloadsResponseSchema
>
export type CancelDownloadResponse = Schema.Schema.Type<
  typeof CancelDownloadResponseSchema
>
export type OkResponse = Schema.Schema.Type<typeof OkResponseSchema>
export type ErrorResponse = Schema.Schema.Type<typeof ErrorResponseSchema>

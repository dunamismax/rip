export type VideoFormat = {
  formatId: string;
  ext: string;
  resolution: string | null;
  filesize: number | null;
  filesizeApprox: number | null;
  vcodec: string | null;
  acodec: string | null;
  fps: number | null;
  tbr: number | null;
  formatNote: string | null;
  hasVideo: boolean;
  hasAudio: boolean;
};

export type VideoMetadata = {
  id: string;
  title: string;
  thumbnail: string | null;
  duration: number | null;
  uploader: string | null;
  uploadDate: string | null;
  viewCount: number | null;
  description: string | null;
  webpageUrl: string;
  extractor: string;
  formats: VideoFormat[];
};

export type DownloadStatus =
  | 'queued'
  | 'downloading'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type DownloadProgress = {
  downloadedBytes: number;
  totalBytes: number | null;
  speed: number | null;
  eta: number | null;
  percentage: number;
};

export type DownloadItem = {
  id: string;
  url: string;
  title: string;
  thumbnail: string | null;
  formatId: string;
  ext: string;
  outputPath: string | null;
  status: DownloadStatus;
  progress: DownloadProgress;
  createdAt: number;
  completedAt: number | null;
  error: string | null;
};

export type WsMessage =
  | { type: 'progress'; downloadId: string; progress: DownloadProgress }
  | { type: 'downloads'; downloads: DownloadItem[] };

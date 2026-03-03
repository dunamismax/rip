import type { DownloadProgress, VideoFormat, VideoMetadata } from '../shared/types';
import { env } from './env';

// ---------------------------------------------------------------------------
// Metadata extraction
// ---------------------------------------------------------------------------

export async function extractMetadata(url: string): Promise<VideoMetadata> {
  const proc = Bun.spawn([env.YTDLP_PATH, '--dump-json', '--no-download', '--no-warnings', url], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    const msg = stderr.trim() || 'yt-dlp failed to extract metadata.';
    throw new Error(msg);
  }

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(stdout);
  } catch {
    throw new Error('Failed to parse yt-dlp output. The response was not valid JSON.');
  }
  return mapMetadata(raw);
}

function mapMetadata(raw: Record<string, unknown>): VideoMetadata {
  const rawFormats = (raw.formats as Record<string, unknown>[]) ?? [];
  const formats = rawFormats
    .map(mapFormat)
    .filter((f) => f.formatId !== 'storyboard' && !f.formatNote?.includes('storyboard'));

  return {
    id: String(raw.id ?? ''),
    title: String(raw.title ?? 'Untitled'),
    thumbnail: (raw.thumbnail as string) ?? null,
    duration: typeof raw.duration === 'number' ? raw.duration : null,
    uploader: (raw.uploader as string) ?? (raw.channel as string) ?? null,
    uploadDate: (raw.upload_date as string) ?? null,
    viewCount: typeof raw.view_count === 'number' ? raw.view_count : null,
    description: (raw.description as string) ?? null,
    webpageUrl: String(raw.webpage_url ?? raw.url ?? ''),
    extractor: String(raw.extractor_key ?? raw.extractor ?? 'unknown'),
    formats,
  };
}

function mapFormat(raw: Record<string, unknown>): VideoFormat {
  const vcodec = raw.vcodec as string | null;
  const acodec = raw.acodec as string | null;
  const hasVideo = !!vcodec && vcodec !== 'none';
  const hasAudio = !!acodec && acodec !== 'none';

  return {
    formatId: String(raw.format_id ?? ''),
    ext: String(raw.ext ?? 'mp4'),
    resolution: (raw.resolution as string) ?? null,
    filesize: typeof raw.filesize === 'number' ? raw.filesize : null,
    filesizeApprox: typeof raw.filesize_approx === 'number' ? raw.filesize_approx : null,
    vcodec: hasVideo ? vcodec : null,
    acodec: hasAudio ? acodec : null,
    fps: typeof raw.fps === 'number' ? raw.fps : null,
    tbr: typeof raw.tbr === 'number' ? raw.tbr : null,
    formatNote: (raw.format_note as string) ?? null,
    hasVideo,
    hasAudio,
  };
}

// ---------------------------------------------------------------------------
// Download with progress
// ---------------------------------------------------------------------------

const PROGRESS_PREFIX = 'rip-progress:';

export type DownloadHandle = {
  proc: ReturnType<typeof Bun.spawn>;
  promise: Promise<string>; // resolves with output file path
  cancel: () => void;
};

export type DownloadOptions = {
  url: string;
  formatId: string;
  outputDir: string;
  onProgress: (progress: DownloadProgress) => void;
};

export function startDownload(opts: DownloadOptions): DownloadHandle {
  const outputTemplate = `${opts.outputDir}/%(title).200s [%(id)s].%(ext)s`;

  const OUTPUT_PREFIX = 'rip-output:';

  const args = [
    env.YTDLP_PATH,
    '-f',
    opts.formatId,
    '-o',
    outputTemplate,
    '--newline',
    '--progress-template',
    `download:${PROGRESS_PREFIX}%(progress.downloaded_bytes)s|%(progress.total_bytes)s|%(progress.total_bytes_estimate)s|%(progress.speed)s|%(progress.eta)s|%(progress.status)s`,
    '--print',
    `after_move:${OUTPUT_PREFIX}%(filepath)s`,
    '--no-warnings',
    '--no-playlist',
    '--restrict-filenames',
    opts.url,
  ];

  const proc = Bun.spawn(args, {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  let cancelled = false;

  async function run(): Promise<string> {
    const reader = proc.stdout.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let lastOutputFile = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith(PROGRESS_PREFIX)) {
          const progress = parseProgressLine(line.slice(PROGRESS_PREFIX.length));
          if (progress) opts.onProgress(progress);
        } else if (line.startsWith(OUTPUT_PREFIX)) {
          lastOutputFile = line.slice(OUTPUT_PREFIX.length).trim();
        } else if (line.startsWith('[download] Destination:')) {
          lastOutputFile = line.replace('[download] Destination:', '').trim();
        } else if (line.startsWith('[Merger]') || line.startsWith('[ExtractAudio]')) {
          opts.onProgress({
            downloadedBytes: 0,
            totalBytes: null,
            speed: null,
            eta: null,
            percentage: 100,
          });
        }
      }
    }

    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    if (cancelled) throw new Error('Download cancelled.');
    if (exitCode !== 0) throw new Error(stderr.trim() || `yt-dlp exited with code ${exitCode}`);

    return lastOutputFile || `${opts.outputDir}/unknown`;
  }

  const cancel = () => {
    cancelled = true;
    proc.kill();
  };

  return { proc, promise: run(), cancel };
}

function parseProgressLine(line: string): DownloadProgress | null {
  const parts = line.split('|');
  if (parts.length < 6) return null;

  const downloadedBytes = parseNum(parts[0]) ?? 0;
  const totalBytes = parseNum(parts[1]);
  const totalBytesEstimate = parseNum(parts[2]);
  const speed = parseNum(parts[3]);
  const eta = parseNum(parts[4]);
  const effectiveTotal = totalBytes ?? totalBytesEstimate;

  const percentage =
    effectiveTotal && effectiveTotal > 0
      ? Math.min(100, Math.round((downloadedBytes / effectiveTotal) * 1000) / 10)
      : 0;

  return {
    downloadedBytes,
    totalBytes: effectiveTotal,
    speed,
    eta,
    percentage,
  };
}

function parseNum(s: string | undefined): number | null {
  if (!s) return null;
  const trimmed = s.trim();
  if (trimmed === '' || trimmed === 'NA' || trimmed === 'None' || trimmed === 'N/A') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// Prerequisite check
// ---------------------------------------------------------------------------

export async function checkYtdlp(): Promise<string | null> {
  try {
    const proc = Bun.spawn([env.YTDLP_PATH, '--version'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const version = (await new Response(proc.stdout).text()).trim();
    await proc.exited;
    return version;
  } catch {
    return null;
  }
}

export async function checkFfmpeg(): Promise<boolean> {
  try {
    const proc = Bun.spawn(['ffmpeg', '-version'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    await proc.exited;
    return true;
  } catch {
    return false;
  }
}

import { useCallback, useState } from 'react';
import { DownloadQueue } from '~/components/download-queue';
import { ThemeToggle } from '~/components/theme-toggle';
import { UrlInput } from '~/components/url-input';
import { VideoCard } from '~/components/video-card';
import { useDownloads } from '~/hooks/use-downloads';
import { apiFetch } from '~/lib/api';
import type { VideoMetadata } from '~/lib/types';
import { cn } from '~/lib/utils';

export default function Home() {
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [startingDownload, setStartingDownload] = useState(false);

  const { downloads, connected, startDownload, cancelDownload, clearCompleted } = useDownloads();

  const handleExtract = useCallback(async (url: string) => {
    setExtracting(true);
    setExtractError(null);
    setMetadata(null);
    try {
      const result = await apiFetch<{ metadata: VideoMetadata }>('/api/extract', {
        method: 'POST',
        body: { url },
      });
      setMetadata(result.metadata);
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : 'Failed to extract video info.');
    } finally {
      setExtracting(false);
    }
  }, []);

  const handleDownload = useCallback(
    async (formatId: string, ext: string) => {
      if (!metadata) return;
      setStartingDownload(true);
      try {
        await startDownload({
          url: metadata.webpageUrl,
          formatId,
          title: metadata.title,
          thumbnail: metadata.thumbnail,
          ext,
        });
      } catch {
        // error will show up in download queue
      } finally {
        setStartingDownload(false);
      }
    },
    [metadata, startDownload],
  );

  return (
    <div className="mx-auto min-h-screen w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-[var(--rip-text)]">Rip</h1>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'h-2 w-2 rounded-full transition-colors',
              connected ? 'bg-[var(--rip-success)]' : 'bg-[var(--rip-error)]',
            )}
            title={connected ? 'Connected' : 'Disconnected'}
          />
          <ThemeToggle />
        </div>
      </div>

      {/* URL Input */}
      <div className="mt-6">
        <UrlInput onExtract={handleExtract} loading={extracting} />
      </div>

      {/* Extract error */}
      {extractError && (
        <div className="mt-4 rounded-lg border border-[var(--rip-error)] bg-[var(--rip-error)]/10 p-3">
          <p className="text-sm text-[var(--rip-error)]">{extractError}</p>
        </div>
      )}

      {/* Video card */}
      {metadata && (
        <div className="mt-4">
          <VideoCard
            metadata={metadata}
            onDownload={handleDownload}
            onDismiss={() => setMetadata(null)}
            downloading={startingDownload}
          />
        </div>
      )}

      {/* Download queue */}
      <div className="mt-8">
        <DownloadQueue
          downloads={downloads}
          onCancel={cancelDownload}
          onClearCompleted={clearCompleted}
        />
      </div>

      {/* Footer */}
      <div className="mt-12 pb-6 text-center text-xs text-[var(--rip-muted)]">
        Powered by yt-dlp &middot; Supports 1700+ sites &middot; MIT License
      </div>
    </div>
  );
}

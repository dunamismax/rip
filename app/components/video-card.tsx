import { useEffect, useMemo, useState } from 'react';
import { getSelectableFormats } from '~/lib/format-options';
import type { VideoMetadata } from '~/lib/types';
import { cn, formatDuration, formatViewCount } from '~/lib/utils';
import { FormatSelector } from './format-selector';

type VideoCardProps = {
  metadata: VideoMetadata;
  onDownload: (formatId: string, ext: string) => void;
  onDismiss: () => void;
  downloading: boolean;
};

export function VideoCard({ metadata, onDownload, onDismiss, downloading }: VideoCardProps) {
  const selectableFormats = useMemo(
    () => getSelectableFormats(metadata.formats),
    [metadata.formats],
  );
  const defaultFormat = selectableFormats[0]?.formatId ?? 'best';
  const [selectedFormat, setSelectedFormat] = useState(defaultFormat);

  useEffect(() => {
    if (!selectableFormats.some((format) => format.formatId === selectedFormat)) {
      setSelectedFormat(defaultFormat);
    }
  }, [defaultFormat, selectableFormats, selectedFormat]);

  const selectedFormatObj = selectableFormats.find((f) => f.formatId === selectedFormat);
  const ext = selectedFormatObj?.ext ?? 'mp4';

  return (
    <div
      className={cn(
        'rounded-xl border p-4 transition-all',
        'border-[var(--rip-border)] bg-[var(--rip-surface)]',
      )}
    >
      <div className="flex gap-4">
        {/* Thumbnail */}
        {metadata.thumbnail && (
          <div className="hidden shrink-0 sm:block">
            <img
              src={metadata.thumbnail}
              alt={metadata.title}
              className="h-28 w-48 rounded-lg object-cover"
            />
          </div>
        )}

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 text-sm font-semibold text-[var(--rip-text)]">
              {metadata.title}
            </h3>
            <button
              type="button"
              onClick={onDismiss}
              className="shrink-0 rounded p-1 text-[var(--rip-muted)] hover:text-[var(--rip-text)]"
              aria-label="Dismiss"
            >
              <svg
                aria-hidden="true"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--rip-muted)]">
            {metadata.uploader && <span>{metadata.uploader}</span>}
            {metadata.duration != null && <span>{formatDuration(metadata.duration)}</span>}
            {metadata.viewCount != null && <span>{formatViewCount(metadata.viewCount)} views</span>}
            <span className="rounded bg-[var(--rip-border)] px-1.5 py-0.5 text-[10px] uppercase">
              {metadata.extractor}
            </span>
          </div>

          {/* Mobile thumbnail */}
          {metadata.thumbnail && (
            <div className="mt-3 sm:hidden">
              <img
                src={metadata.thumbnail}
                alt={metadata.title}
                className="w-full rounded-lg object-cover"
              />
            </div>
          )}

          {/* Format selector */}
          <div className="mt-3">
            <FormatSelector
              formats={metadata.formats}
              selected={selectedFormat}
              onSelect={setSelectedFormat}
            />
          </div>

          {/* Download button */}
          <div className="mt-4">
            <button
              type="button"
              onClick={() => onDownload(selectedFormat, ext)}
              disabled={downloading}
              className={cn(
                'rounded-lg px-5 py-2 text-sm font-medium text-white transition-colors',
                'bg-[var(--rip-accent)] hover:bg-[var(--rip-accent-hover)]',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {downloading ? 'Starting...' : 'Download'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

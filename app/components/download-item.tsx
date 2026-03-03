import type { DownloadItem as DownloadItemType, DownloadStatus } from '~/lib/types';
import { cn, formatBytes, formatEta, formatSpeed } from '~/lib/utils';

type DownloadItemProps = {
  item: DownloadItemType;
  onCancel: (id: string) => void;
};

const statusColors: Record<DownloadStatus, string> = {
  queued: 'bg-[var(--ovd-warning)] text-black',
  downloading: 'bg-[var(--ovd-accent)] text-white',
  processing: 'bg-[var(--ovd-accent-soft)] text-white',
  completed: 'bg-[var(--ovd-success)] text-white',
  failed: 'bg-[var(--ovd-error)] text-white',
  cancelled: 'bg-[var(--ovd-muted)] text-white',
};

export function DownloadItemRow({ item, onCancel }: DownloadItemProps) {
  const isActive = item.status === 'downloading' || item.status === 'queued';

  return (
    <div
      className={cn(
        'rounded-lg border p-3 transition-all',
        'border-[var(--ovd-border)] bg-[var(--ovd-surface)]',
      )}
    >
      <div className="flex items-start gap-3">
        {/* Thumbnail */}
        {item.thumbnail && (
          <img
            src={item.thumbnail}
            alt={item.title}
            className="hidden h-12 w-20 shrink-0 rounded object-cover sm:block"
          />
        )}

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="truncate text-sm font-medium text-[var(--ovd-text)]">{item.title}</h4>
            <span
              className={cn(
                'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase',
                statusColors[item.status] ?? '',
              )}
            >
              {item.status}
            </span>
          </div>

          {/* Progress bar for active downloads */}
          {item.status === 'downloading' && (
            <div className="mt-2">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--ovd-border)]">
                <div
                  className="h-full rounded-full bg-[var(--ovd-accent)] transition-all duration-300"
                  style={{ width: `${item.progress.percentage}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-[var(--ovd-muted)]">
                <span>
                  {item.progress.percentage.toFixed(1)}%
                  {item.progress.totalBytes ? ` of ${formatBytes(item.progress.totalBytes)}` : ''}
                </span>
                <span>
                  {formatSpeed(item.progress.speed)} &middot; ETA {formatEta(item.progress.eta)}
                </span>
              </div>
            </div>
          )}

          {/* Error message */}
          {item.status === 'failed' && item.error && (
            <p className="mt-1 text-xs text-[var(--ovd-error)]">{item.error}</p>
          )}

          {/* Output path for completed */}
          {item.status === 'completed' && item.outputPath && (
            <p className="mt-1 truncate text-xs text-[var(--ovd-muted)]">{item.outputPath}</p>
          )}
        </div>

        {/* Cancel button */}
        {isActive && (
          <button
            type="button"
            onClick={() => onCancel(item.id)}
            className="shrink-0 rounded p-1 text-[var(--ovd-muted)] hover:text-[var(--ovd-error)] transition-colors"
            aria-label="Cancel download"
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
        )}
      </div>
    </div>
  );
}

import type { DownloadItem } from '~/lib/types';
import { cn } from '~/lib/utils';
import { DownloadItemRow } from './download-item';

type DownloadQueueProps = {
  downloads: DownloadItem[];
  onCancel: (id: string) => void;
  onClearCompleted: () => void;
};

export function DownloadQueue({ downloads, onCancel, onClearCompleted }: DownloadQueueProps) {
  if (downloads.length === 0) return null;

  const hasFinished = downloads.some(
    (d) => d.status === 'completed' || d.status === 'failed' || d.status === 'cancelled',
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--rip-text)]">
          Downloads ({downloads.length})
        </h2>
        {hasFinished && (
          <button
            type="button"
            onClick={onClearCompleted}
            className={cn(
              'rounded-md px-3 py-1 text-xs transition-colors',
              'text-[var(--rip-muted)] hover:text-[var(--rip-text)] hover:bg-[var(--rip-border)]',
            )}
          >
            Clear finished
          </button>
        )}
      </div>
      <div className="space-y-2">
        {downloads.map((item) => (
          <DownloadItemRow key={item.id} item={item} onCancel={onCancel} />
        ))}
      </div>
    </div>
  );
}

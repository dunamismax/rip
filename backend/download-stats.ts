import type { DownloadStatus } from '../shared/types';

export function isIncompleteStatus(status: DownloadStatus): boolean {
  return status === 'queued' || status === 'downloading' || status === 'processing';
}

export function countIncompleteDownloads(
  items: Iterable<{
    status: DownloadStatus;
  }>,
): number {
  let count = 0;
  for (const item of items) {
    if (isIncompleteStatus(item.status)) {
      count++;
    }
  }
  return count;
}

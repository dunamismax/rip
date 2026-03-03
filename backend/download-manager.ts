import { mkdir } from 'node:fs/promises';
import type { DownloadItem, DownloadProgress, WsMessage } from '../shared/types';
import { env } from './env';
import { startDownload } from './ytdlp';

type BroadcastFn = (msg: WsMessage) => void;

const downloadDir = env.DOWNLOAD_DIR.replace(/^~/, process.env.HOME ?? '');

export class DownloadManager {
  private downloads = new Map<string, DownloadItem>();
  private queue: string[] = [];
  private active = new Map<string, { cancel: () => void }>();
  private maxConcurrent: number;
  private broadcast: BroadcastFn;
  private dirReady = false;

  constructor(maxConcurrent: number, broadcast: BroadcastFn) {
    this.maxConcurrent = maxConcurrent;
    this.broadcast = broadcast;
  }

  /** Number of items in the pending queue (excludes active downloads). */
  queueSize(): number {
    return this.downloads.size;
  }

  add(url: string, formatId: string, title: string, thumbnail: string | null, ext: string): string {
    const id = crypto.randomUUID();
    const item: DownloadItem = {
      id,
      url,
      title,
      thumbnail,
      formatId,
      ext,
      outputPath: null,
      status: 'queued',
      progress: { downloadedBytes: 0, totalBytes: null, speed: null, eta: null, percentage: 0 },
      createdAt: Date.now(),
      completedAt: null,
      error: null,
    };

    this.downloads.set(id, item);
    this.queue.push(id);
    this.broadcastAll();
    this.processQueue();
    return id;
  }

  cancel(id: string): boolean {
    const item = this.downloads.get(id);
    if (!item) return false;

    // If active, kill the process
    const handle = this.active.get(id);
    if (handle) {
      handle.cancel();
      this.active.delete(id);
    }

    // If queued, remove from queue
    const queueIdx = this.queue.indexOf(id);
    if (queueIdx >= 0) this.queue.splice(queueIdx, 1);

    item.status = 'cancelled';
    this.broadcastAll();
    this.processQueue();
    return true;
  }

  getAll(): DownloadItem[] {
    return Array.from(this.downloads.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  clearCompleted(): void {
    for (const [id, item] of this.downloads) {
      if (item.status === 'completed' || item.status === 'failed' || item.status === 'cancelled') {
        this.downloads.delete(id);
      }
    }
    this.broadcastAll();
  }

  killAll(): void {
    for (const [id, handle] of this.active) {
      handle.cancel();
      const item = this.downloads.get(id);
      if (item) item.status = 'cancelled';
    }
    this.active.clear();
    this.queue.length = 0;
  }

  private broadcastAll(): void {
    this.broadcast({ type: 'downloads', downloads: this.getAll() });
  }

  private async ensureDir(): Promise<void> {
    if (this.dirReady) return;
    await mkdir(downloadDir, { recursive: true });
    this.dirReady = true;
  }

  private processQueue(): void {
    while (this.active.size < this.maxConcurrent && this.queue.length > 0) {
      const id = this.queue.shift();
      if (!id) break;
      const item = this.downloads.get(id);
      if (!item || item.status === 'cancelled') continue;
      this.startNext(id, item);
    }
  }

  private async startNext(id: string, item: DownloadItem): Promise<void> {
    try {
      await this.ensureDir();
    } catch (err) {
      item.status = 'failed';
      item.error = err instanceof Error ? err.message : 'Failed to create download directory.';
      this.broadcastAll();
      return;
    }

    item.status = 'downloading';
    this.broadcastAll();

    const handle = startDownload({
      url: item.url,
      formatId: item.formatId,
      outputDir: downloadDir,
      onProgress: (progress: DownloadProgress) => {
        item.progress = progress;
        item.status = 'downloading';
        this.broadcast({ type: 'progress', downloadId: id, progress });
      },
    });

    this.active.set(id, { cancel: handle.cancel });

    try {
      const outputPath = await handle.promise;
      item.status = 'completed';
      item.outputPath = outputPath;
      item.completedAt = Date.now();
      item.progress.percentage = 100;
      this.broadcastAll();
    } catch (err) {
      const currentStatus = this.downloads.get(id)?.status;
      if (currentStatus !== 'cancelled') {
        item.status = 'failed';
        item.error = err instanceof Error ? err.message : 'Download failed.';
        this.broadcastAll();
      }
    } finally {
      this.active.delete(id);
      this.processQueue();
    }
  }
}

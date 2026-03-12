import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import type {
  DownloadItem,
  DownloadProgress,
  QueueDownloadRequest,
} from '@rip/contracts'
import { downloads, getDb } from '@rip/db'
import { and, asc, desc, eq, inArray, lt, sql } from 'drizzle-orm'
import { loadEnv } from './env'
import { withSpan } from './observability'
import {
  buildDownloadArgs,
  consumeDownloadStdout,
  resolveDownloadDirectory,
} from './ytdlp'

type DownloadResult = 'cancelled' | 'not_found' | 'not_cancellable'

type ActiveProcess = {
  child: ReturnType<typeof spawn>
  cancelled: boolean
}

class AsyncMutex {
  private chain = Promise.resolve()

  async run<T>(task: () => Promise<T>) {
    const previous = this.chain
    let release: () => void = () => undefined
    this.chain = new Promise<void>((resolve) => {
      release = resolve
    })

    await previous

    try {
      return await task()
    } finally {
      release()
    }
  }
}

class DownloadManager {
  private readonly mutex = new AsyncMutex()
  private readonly active = new Map<string, ActiveProcess>()
  private readonly waiters = new Set<() => void>()
  private readonly workers: Promise<void>[] = []
  private started = false

  async ensureStarted() {
    if (this.started) {
      return
    }

    this.started = true
    const env = loadEnv()

    await mkdir(resolveDownloadDirectory(env.downloadDir), {
      recursive: true,
    })

    await this.requeueInterruptedDownloads()

    for (let index = 0; index < env.maxConcurrentDownloads; index += 1) {
      this.workers.push(this.worker(index))
    }

    setInterval(() => {
      void this.cleanupExpiredCompleted().catch(() => undefined)
    }, 60_000)
  }

  async listDownloads(userId: string) {
    await this.ensureStarted()
    const db = getDb()
    const rows = await db
      .select()
      .from(downloads)
      .where(eq(downloads.userId, userId))
      .orderBy(desc(downloads.createdAt))

    return rows.map(mapRowToDownloadItem)
  }

  async queueDownload(userId: string, payload: QueueDownloadRequest) {
    await this.ensureStarted()
    const env = loadEnv()

    const id = await this.mutex.run(async () => {
      const db = getDb()
      const [result] = await db
        .select({
          count: sql<number>`count(*)`,
        })
        .from(downloads)
        .where(
          inArray(downloads.status, ['queued', 'downloading', 'processing'])
        )

      if (Number(result?.count ?? 0) >= env.maxIncompleteDownloads) {
        return null
      }

      const [inserted] = await db
        .insert(downloads)
        .values({
          userId,
          url: payload.url,
          title: payload.title,
          thumbnail: payload.thumbnail,
          formatId: payload.formatId,
          ext: payload.ext,
          sourceExt: payload.sourceExt,
          hasVideo: payload.hasVideo,
          hasAudio: payload.hasAudio,
          status: 'queued',
          progressDownloadedBytes: 0,
          progressPercentage: 0,
          metadata: null,
        })
        .returning({
          id: downloads.id,
        })

      return inserted?.id ?? null
    })

    if (id) {
      this.notifyWorkers()
    }

    return id
  }

  async cancelDownload(
    userId: string,
    downloadId: string
  ): Promise<DownloadResult> {
    await this.ensureStarted()

    return this.mutex.run(async () => {
      const db = getDb()
      const [row] = await db
        .select()
        .from(downloads)
        .where(and(eq(downloads.id, downloadId), eq(downloads.userId, userId)))
        .limit(1)

      if (!row) {
        return 'not_found'
      }

      if (isTerminalStatus(row.status)) {
        return 'not_cancellable'
      }

      const active = this.active.get(downloadId)

      if (active) {
        active.cancelled = true
        active.child.kill('SIGTERM')
      }

      await db
        .update(downloads)
        .set({
          status: 'cancelled',
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(downloads.id, downloadId))

      return 'cancelled'
    })
  }

  async clearCompleted(userId: string) {
    await this.ensureStarted()
    const db = getDb()

    await db
      .delete(downloads)
      .where(
        and(
          eq(downloads.userId, userId),
          inArray(downloads.status, ['completed', 'failed', 'cancelled'])
        )
      )
  }

  private async worker(_index: number) {
    while (this.started) {
      const row = await this.nextQueuedDownload()

      if (!row) {
        await this.waitForWork()
        continue
      }

      try {
        await this.runDownload(row)
      } catch {
        // Errors are persisted to the row by runDownload.
      }
    }
  }

  private async nextQueuedDownload() {
    return this.mutex.run(async () => {
      const db = getDb()
      const [row] = await db
        .select()
        .from(downloads)
        .where(eq(downloads.status, 'queued'))
        .orderBy(asc(downloads.createdAt))
        .limit(1)

      if (!row) {
        return null
      }

      const [claimed] = await db
        .update(downloads)
        .set({
          status: 'downloading',
          updatedAt: new Date(),
          error: null,
        })
        .where(eq(downloads.id, row.id))
        .returning()

      return claimed ?? null
    })
  }

  private async runDownload(row: typeof downloads.$inferSelect) {
    const payload: QueueDownloadRequest = {
      url: row.url,
      formatId: row.formatId,
      title: row.title,
      thumbnail: row.thumbnail,
      ext: row.ext as QueueDownloadRequest['ext'],
      sourceExt: row.sourceExt as QueueDownloadRequest['sourceExt'],
      hasVideo: row.hasVideo,
      hasAudio: row.hasAudio,
    }

    const args = buildDownloadArgs(payload)
    const env = loadEnv()

    await withSpan(
      'rip.download.run',
      {
        'rip.download.id': row.id,
        'rip.download.format_id': row.formatId,
      },
      async () => {
        const child = spawn(env.ytdlpPath, args, {
          stdio: ['ignore', 'pipe', 'pipe'],
        })

        this.active.set(row.id, {
          child,
          cancelled: false,
        })

        const stderrPromise = streamToString(child.stderr)

        try {
          if (child.stdout) {
            await consumeDownloadStdout(
              mapRowToDownloadItem(row),
              child.stdout,
              async (progress) => {
                const active = this.active.get(row.id)

                if (active?.cancelled) {
                  return
                }

                await this.updateProgress(row.id, progress, 'downloading')
              },
              async (outputPath) => {
                await this.updateOutputPath(row.id, outputPath)
              },
              async () => {
                const active = this.active.get(row.id)

                if (active?.cancelled) {
                  return
                }

                await this.updateStatus(row.id, 'processing')
              }
            )
          }
        } catch {
          child.kill('SIGTERM')
        }

        const exitCode = await onceExit(child)
        const stderr = (await stderrPromise).trim()
        const active = this.active.get(row.id)
        this.active.delete(row.id)

        if (active?.cancelled) {
          await this.updateCancelled(row.id)
          this.notifyWorkers()
          return
        }

        if (exitCode === 0) {
          await this.updateCompleted(row.id)
        } else {
          await this.updateFailed(
            row.id,
            stderr || `yt-dlp exited with code ${exitCode}.`
          )
        }

        this.notifyWorkers()
      }
    )
  }

  private async updateProgress(
    id: string,
    progress: DownloadProgress,
    status: 'downloading' | 'processing'
  ) {
    const db = getDb()

    await db
      .update(downloads)
      .set({
        status,
        progressDownloadedBytes: progress.downloadedBytes,
        progressTotalBytes: progress.totalBytes,
        progressSpeed: progress.speed ? Math.trunc(progress.speed) : null,
        progressEta: progress.eta,
        progressPercentage: Math.round(progress.percentage),
        updatedAt: new Date(),
      })
      .where(eq(downloads.id, id))
  }

  private async updateOutputPath(id: string, outputPath: string) {
    const db = getDb()

    await db
      .update(downloads)
      .set({
        outputPath,
        updatedAt: new Date(),
      })
      .where(eq(downloads.id, id))
  }

  private async updateStatus(id: string, status: 'downloading' | 'processing') {
    const db = getDb()

    await db
      .update(downloads)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(downloads.id, id))
  }

  private async updateCompleted(id: string) {
    const db = getDb()

    await db
      .update(downloads)
      .set({
        status: 'completed',
        progressPercentage: 100,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(downloads.id, id))
  }

  private async updateFailed(id: string, error: string) {
    const db = getDb()

    await db
      .update(downloads)
      .set({
        status: 'failed',
        error,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(downloads.id, id))
  }

  private async updateCancelled(id: string) {
    const db = getDb()

    await db
      .update(downloads)
      .set({
        status: 'cancelled',
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(downloads.id, id))
  }

  private async waitForWork() {
    await new Promise<void>((resolve) => {
      this.waiters.add(resolve)
    })
  }

  private notifyWorkers() {
    for (const resolve of this.waiters) {
      resolve()
    }

    this.waiters.clear()
  }

  private async requeueInterruptedDownloads() {
    const db = getDb()

    await db
      .update(downloads)
      .set({
        status: 'queued',
        updatedAt: new Date(),
      })
      .where(inArray(downloads.status, ['downloading', 'processing']))
  }

  private async cleanupExpiredCompleted() {
    const env = loadEnv()
    const db = getDb()
    const cutoff = new Date(Date.now() - env.completedExpirySeconds * 1_000)

    await db
      .delete(downloads)
      .where(
        and(
          inArray(downloads.status, ['completed', 'failed', 'cancelled']),
          lt(downloads.completedAt, cutoff)
        )
      )
  }
}

function isTerminalStatus(status: string) {
  return status === 'completed' || status === 'failed' || status === 'cancelled'
}

function mapRowToDownloadItem(
  row: typeof downloads.$inferSelect
): DownloadItem {
  return {
    id: row.id,
    userId: row.userId,
    url: row.url,
    title: row.title,
    thumbnail: row.thumbnail,
    formatId: row.formatId,
    ext: row.ext as DownloadItem['ext'],
    sourceExt: row.sourceExt as DownloadItem['sourceExt'],
    hasVideo: row.hasVideo,
    hasAudio: row.hasAudio,
    outputPath: row.outputPath,
    status: row.status as DownloadItem['status'],
    progress: {
      downloadedBytes: row.progressDownloadedBytes,
      totalBytes: row.progressTotalBytes,
      speed: row.progressSpeed,
      eta: row.progressEta,
      percentage: row.progressPercentage,
    },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    error: row.error,
  }
}

async function streamToString(stream: NodeJS.ReadableStream | null) {
  if (!stream) {
    return ''
  }

  const chunks: Uint8Array[] = []

  for await (const chunk of stream) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }

  return Buffer.concat(chunks).toString('utf8')
}

function onceExit(child: ReturnType<typeof spawn>) {
  return new Promise<number>((resolve, reject) => {
    child.once('error', reject)
    child.once('close', (code) => resolve(code ?? 1))
  })
}

declare global {
  // eslint-disable-next-line no-var
  var __ripDownloadManager: DownloadManager | undefined
}

export function getDownloadManager() {
  const manager = globalThis.__ripDownloadManager ?? new DownloadManager()

  if (process.env.NODE_ENV !== 'production') {
    globalThis.__ripDownloadManager = manager
  }

  return manager
}

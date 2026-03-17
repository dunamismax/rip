import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    download: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  spawn: vi.fn(),
  buildDownloadArgs: vi.fn(() => ['--mock']),
  consumeDownloadStdout: vi.fn(),
}))

vi.mock('@rip/db', () => ({
  prisma: mocks.prisma,
}))

vi.mock('node:child_process', () => ({
  spawn: mocks.spawn,
}))

vi.mock('./ytdlp', () => ({
  buildDownloadArgs: mocks.buildDownloadArgs,
  consumeDownloadStdout: mocks.consumeDownloadStdout,
  resolveDownloadDirectory: vi.fn((downloadDir: string) => downloadDir),
}))

import { getDownloadManager } from './download-manager'

describe('getDownloadManager', () => {
  const originalNodeEnv = process.env.NODE_ENV

  beforeEach(() => {
    process.env.NODE_ENV = 'test'
    delete globalThis.__ripDownloadManager
    vi.clearAllMocks()
    mocks.prisma.download.findUnique.mockReset()
    mocks.prisma.download.update.mockResolvedValue(undefined)
    mocks.consumeDownloadStdout.mockResolvedValue(undefined)
  })

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv
    delete globalThis.__ripDownloadManager
  })

  it('reuses the same manager instance in production mode', () => {
    process.env.NODE_ENV = 'production'

    const first = getDownloadManager()
    const second = getDownloadManager()

    expect(first).toBe(second)
  })

  it('skips spawning yt-dlp when a download was cancelled before the worker starts it', async () => {
    mocks.prisma.download.findUnique.mockResolvedValue({
      status: 'cancelled',
    })

    const manager = getDownloadManager() as unknown as {
      runDownload: (row: ReturnType<typeof createDownloadRow>) => Promise<void>
    }

    await manager.runDownload(createDownloadRow())

    expect(mocks.spawn).not.toHaveBeenCalled()
  })

  it('clears transient progress fields when a download completes', async () => {
    const manager = getDownloadManager() as unknown as {
      updateCompleted: (id: string) => Promise<void>
    }

    await manager.updateCompleted('download-1')

    expect(mocks.prisma.download.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'completed',
          progressPercentage: 100,
          progressSpeed: null,
          progressEta: null,
        }),
      })
    )
  })

  it('marks a fast-finishing download as completed even if the process closes before stdout handling resolves', async () => {
    let resolveStdout: (() => void) | undefined
    const child = createChild()

    mocks.prisma.download.findUnique.mockResolvedValue({
      status: 'downloading',
    })
    mocks.spawn.mockReturnValue(child)
    mocks.consumeDownloadStdout.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveStdout = resolve
        })
    )

    const manager = getDownloadManager() as unknown as {
      runDownload: (row: ReturnType<typeof createDownloadRow>) => Promise<void>
    }
    const runPromise = manager.runDownload(createDownloadRow())

    await vi.waitFor(() => {
      expect(mocks.consumeDownloadStdout).toHaveBeenCalled()
    })

    child.emitClose(0)
    resolveStdout?.()
    await runPromise

    expect(mocks.prisma.download.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'completed',
        }),
      })
    )
  })
})

function createDownloadRow() {
  const now = new Date('2026-03-17T00:00:00.000Z')

  return {
    id: 'download-1',
    userId: 'user-1',
    url: 'https://example.com/watch?v=abc123',
    title: 'Example',
    thumbnail: null,
    formatId: '137+140',
    ext: 'mp4',
    sourceExt: 'mp4',
    hasVideo: true,
    hasAudio: true,
    outputPath: null,
    status: 'downloading',
    progressDownloadedBytes: 0,
    progressTotalBytes: null,
    progressSpeed: null,
    progressEta: null,
    progressPercentage: 0,
    error: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  }
}

function createChild() {
  const listeners = new Map<string, (...args: unknown[]) => void>()

  return {
    stdout: {},
    stderr: {
      [Symbol.asyncIterator]: async function* () {},
    },
    kill: vi.fn(),
    once(event: string, listener: (...args: unknown[]) => void) {
      listeners.set(event, listener)
      return this
    },
    emitClose(code: number) {
      listeners.get('close')?.(code)
    },
  }
}

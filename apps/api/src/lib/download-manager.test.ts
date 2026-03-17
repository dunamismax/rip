import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@rip/db', () => ({
  prisma: {
    download: {},
  },
}))

import { getDownloadManager } from './download-manager'

describe('getDownloadManager', () => {
  const originalNodeEnv = process.env.NODE_ENV

  beforeEach(() => {
    delete globalThis.__ripDownloadManager
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
})

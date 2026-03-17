import { expect, test } from '@playwright/test'

const sessionFixture = {
  user: {
    id: 'user-1',
    name: 'Rip Operator',
    email: 'operator@example.com',
    image: null,
  },
  session: {
    id: 'session-1',
    userId: 'user-1',
    expiresAt: new Date('2030-01-01T00:00:00.000Z').toISOString(),
    createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    updatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
  },
}

const metadataFixture = {
  metadata: {
    id: 'video-1',
    title: 'Example Session Clip',
    thumbnail: 'https://images.example.com/thumb.jpg',
    duration: 125,
    uploader: 'Demo Channel',
    uploadDate: '20260101',
    viewCount: 42_000,
    description: 'Demo description',
    webpageUrl: 'https://example.com/watch?v=video-1',
    extractor: 'youtube',
    formats: [
      {
        formatId: '137+140',
        ext: 'mp4',
        resolution: '1080p',
        filesize: 12_000_000,
        filesizeApprox: null,
        vcodec: 'avc1',
        acodec: 'mp4a',
        fps: 30,
        tbr: 4200,
        formatNote: 'hd',
        hasVideo: true,
        hasAudio: true,
        outputExtensions: ['mp4', 'mkv', 'mov', 'mp3'],
      },
    ],
  },
}

test('shows the auth control deck when signed out', async ({ page }) => {
  await page.route('**/api/session', async (route) => {
    await route.fulfill({
      json: {
        user: null,
        session: null,
      },
    })
  })

  await page.goto('/')

  await expect(
    page.getByRole('heading', {
      name: /rip keeps yt-dlp workflows fast, authenticated, and visible/i,
    })
  ).toBeVisible()
  await expect(
    page.getByRole('button', {
      name: /create account/i,
    })
  ).toBeVisible()
})

test('queues a mocked download from the dashboard', async ({ page }) => {
  let downloads: Array<Record<string, unknown>> = []

  await page.route('**/api/session', async (route) => {
    await route.fulfill({ json: sessionFixture })
  })

  await page.route('**/api/downloads', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        json: {
          downloads,
        },
      })
      return
    }

    await route.continue()
  })

  await page.route('**/api/downloads/completed', async (route) => {
    downloads = []
    await route.fulfill({
      json: {
        status: 'ok',
      },
    })
  })

  await page.route('**/api/extract', async (route) => {
    await route.fulfill({ json: metadataFixture })
  })

  await page.route('**/api/download', async (route) => {
    const request = route.request()
    const payload = request.postDataJSON() as {
      ext: string
      formatId: string
      title: string
      url: string
    }

    downloads = [
      {
        id: 'download-1',
        userId: 'user-1',
        url: payload.url,
        title: payload.title,
        thumbnail: 'https://images.example.com/thumb.jpg',
        formatId: payload.formatId,
        ext: payload.ext,
        sourceExt: 'mp4',
        hasVideo: true,
        hasAudio: true,
        outputPath: null,
        status: 'queued',
        progress: {
          downloadedBytes: 0,
          totalBytes: null,
          speed: null,
          eta: null,
          percentage: 0,
        },
        createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
        updatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
        completedAt: null,
        error: null,
      },
    ]

    await route.fulfill({
      json: {
        id: 'download-1',
      },
    })
  })

  await page.goto('/')

  await expect(
    page.getByRole('heading', {
      name: /inspect a media url/i,
    })
  ).toBeVisible()

  await page.getByLabel('Video URL').fill('https://example.com/watch?v=video-1')
  await page.getByRole('button', { name: /inspect formats/i }).click()

  await expect(page.getByText('Example Session Clip')).toBeVisible()

  await page.getByRole('button', { name: /queue download/i }).click()

  await expect(page.getByText(/queued/i)).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Example Session Clip' })
  ).toHaveCount(2)
})

test('clears stale inspection details after a failed re-inspect', async ({
  page,
}) => {
  await page.route('**/api/session', async (route) => {
    await route.fulfill({ json: sessionFixture })
  })

  await page.route('**/api/downloads', async (route) => {
    await route.fulfill({
      json: {
        downloads: [],
      },
    })
  })

  let extractCount = 0

  await page.route('**/api/extract', async (route) => {
    extractCount += 1

    if (extractCount === 1) {
      await route.fulfill({ json: metadataFixture })
      return
    }

    await route.fulfill({
      status: 400,
      json: {
        error: 'Could not inspect this URL.',
      },
    })
  })

  await page.goto('/')

  await page.getByLabel('Video URL').fill('https://example.com/watch?v=video-1')
  await page.getByRole('button', { name: /inspect formats/i }).click()

  await expect(page.getByText('Example Session Clip')).toBeVisible()
  await expect(
    page.getByRole('button', { name: /queue download/i })
  ).toBeEnabled()

  await page.getByLabel('Video URL').fill('https://example.com/watch?v=missing')
  await page.getByRole('button', { name: /inspect formats/i }).click()

  await expect(page.getByText('Could not inspect this URL.')).toBeVisible()
  await expect(page.getByText('Example Session Clip')).not.toBeVisible()
  await expect(
    page.getByRole('button', { name: /queue download/i })
  ).toBeHidden()
})

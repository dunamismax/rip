import { Hono } from 'hono';
import { z } from 'zod';
import type { DownloadManager } from './download-manager';
import { RateLimiter } from './rate-limit';
import { extractMetadata } from './ytdlp';

const extractSchema = z.object({
  url: z.url(),
});

const downloadSchema = z.object({
  url: z.url(),
  formatId: z.string().min(1),
  title: z.string().min(1),
  thumbnail: z.string().nullable().optional(),
  ext: z.string().min(1).default('mp4'),
});

// Rate limiters: extract is expensive (spawns subprocess), download less so
const extractLimiter = new RateLimiter(10, 60_000); // 10 req/min per IP
const downloadLimiter = new RateLimiter(20, 60_000); // 20 req/min per IP

const MAX_QUEUED_DOWNLOADS = 50;

function getClientIp(c: { req: { header: (name: string) => string | undefined } }): string {
  return c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';
}

async function safeJson(c: { req: { json: () => Promise<unknown> } }): Promise<unknown | null> {
  try {
    return await c.req.json();
  } catch {
    return null;
  }
}

export function createRoutes(manager: DownloadManager): Hono {
  const api = new Hono();

  // Extract video metadata from a URL
  api.post('/extract', async (c) => {
    const ip = getClientIp(c);
    if (!extractLimiter.check(ip)) {
      return c.json({ error: 'Too many requests. Please wait before trying again.' }, 429);
    }

    const body = await safeJson(c);
    if (body === null) {
      return c.json({ error: 'Invalid JSON body.' }, 400);
    }

    const parsed = extractSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid URL.' }, 400);
    }
    try {
      const metadata = await extractMetadata(parsed.data.url);
      return c.json({ metadata });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Extraction failed.';
      return c.json({ error: message }, 500);
    }
  });

  // Start a download
  api.post('/download', async (c) => {
    const ip = getClientIp(c);
    if (!downloadLimiter.check(ip)) {
      return c.json({ error: 'Too many requests. Please wait before trying again.' }, 429);
    }

    const body = await safeJson(c);
    if (body === null) {
      return c.json({ error: 'Invalid JSON body.' }, 400);
    }

    const parsed = downloadSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Invalid download request.' }, 400);
    }

    if (manager.queueSize() >= MAX_QUEUED_DOWNLOADS) {
      return c.json({ error: 'Too many queued downloads. Please wait for some to finish.' }, 429);
    }

    const id = manager.add(
      parsed.data.url,
      parsed.data.formatId,
      parsed.data.title,
      parsed.data.thumbnail ?? null,
      parsed.data.ext,
    );
    return c.json({ id }, 201);
  });

  // Cancel a download
  api.delete('/download/:id', (c) => {
    const id = c.req.param('id');
    const success = manager.cancel(id);
    if (!success) return c.json({ error: 'Download not found.' }, 404);
    return c.json({ status: 'cancelled' });
  });

  // List all downloads
  api.get('/downloads', (c) => {
    return c.json({ downloads: manager.getAll() });
  });

  // Clear completed/failed/cancelled
  api.delete('/downloads/completed', (c) => {
    manager.clearCompleted();
    return c.json({ status: 'ok' });
  });

  return api;
}

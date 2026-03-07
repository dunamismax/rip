import { createApp } from '../backend/app';
import { DownloadManager } from '../backend/download-manager';

const BASE_URL = process.env.RIP_BASE_URL?.trim() || null;
const REQUEST_TIMEOUT_MS = 5_000;

async function smoke() {
  const manager = new DownloadManager(1, () => {});
  const app = BASE_URL ? null : createApp(manager);
  const mode = BASE_URL ? 'live server' : 'in-process app';

  console.log('rip smoke test\n');
  console.log(`mode               ${mode}`);
  if (BASE_URL) {
    console.log(`base URL           ${BASE_URL}`);
  }
  console.log('');

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`  PASS  ${name}`);
      passed++;
    } catch (err) {
      console.error(`  FAIL  ${name}: ${err instanceof Error ? err.message : err}`);
      failed++;
    }
  }

  function skip(name: string, reason: string) {
    console.log(`  SKIP  ${name}: ${reason}`);
    skipped++;
  }

  try {
    await test('GET /health', async () => {
      const res = await requestJson<{ status: string }>(app, '/health');
      if (res.status !== 'ok') throw new Error(`unexpected status: ${res.status}`);
    });

    await test('GET /api/downloads', async () => {
      const res = await requestJson<{ downloads: unknown[] }>(app, '/api/downloads');
      if (!Array.isArray(res.downloads)) throw new Error('expected downloads array');
    });

    if (BASE_URL) {
      await test('GET /api/ws ping/pong', async () => {
        await verifyWebSocket(BASE_URL);
      });
    } else {
      skip('GET /api/ws ping/pong', 'set RIP_BASE_URL to validate a running server');
    }

    await test('POST /api/extract (invalid JSON)', async () => {
      const res = await request(app, '/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{',
      });
      if (res.status !== 400) throw new Error(`expected 400, got ${res.status}`);
    });

    await test('POST /api/extract (invalid URL)', async () => {
      const res = await request(app, '/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'not-a-url' }),
      });
      if (res.status !== 400) throw new Error(`expected 400, got ${res.status}`);
    });

    await test('POST /api/download (invalid payload)', async () => {
      const res = await request(app, '/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.status !== 400) throw new Error(`expected 400, got ${res.status}`);
    });

    await test('POST /api/download (oversized body)', async () => {
      const oversized = 'x'.repeat(1024 * 1024 + 1);
      const body = JSON.stringify({ url: 'https://example.com', formatId: oversized, title: 't' });
      const res = await request(app, '/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': String(new TextEncoder().encode(body).byteLength),
        },
        body,
      });
      if (res.status !== 413) throw new Error(`expected 413, got ${res.status}`);
    });

    await test('DELETE /api/download/nonexistent', async () => {
      const res = await request(app, '/api/download/nonexistent', { method: 'DELETE' });
      if (res.status !== 404) throw new Error(`expected 404, got ${res.status}`);
    });

    await test('DELETE /api/downloads/completed', async () => {
      const res = await request(app, '/api/downloads/completed', { method: 'DELETE' });
      if (!res.ok) throw new Error(`status ${res.status}`);
    });
  } finally {
    manager.dispose();
  }

  console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped`);
  if (failed > 0) process.exitCode = 1;
}

async function requestJson<T>(
  app: ReturnType<typeof createApp> | null,
  pathname: string,
  init?: RequestInit,
): Promise<T> {
  const res = await request(app, pathname, init);
  if (!res.ok) throw new Error(`status ${res.status}`);
  return (await res.json()) as T;
}

async function request(
  app: ReturnType<typeof createApp> | null,
  pathname: string,
  init?: RequestInit,
): Promise<Response> {
  if (BASE_URL) {
    return fetchWithTimeout(new URL(pathname, `${BASE_URL}/`), init);
  }

  if (!app) {
    throw new Error('Smoke test app is not available.');
  }

  return app.request(new Request(`http://rip.test${pathname}`, init));
}

async function fetchWithTimeout(url: URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function verifyWebSocket(baseUrl: string): Promise<void> {
  const apiUrl = new URL(baseUrl);
  const protocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${apiUrl.host}/api/ws`;

  await new Promise<void>((resolve, reject) => {
    let sawDownloads = false;
    let sawPong = false;

    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('timed out waiting for downloads snapshot and pong'));
    }, REQUEST_TIMEOUT_MS);

    const finish = () => {
      if (!sawDownloads || !sawPong) return;
      clearTimeout(timeout);
      ws.close();
      resolve();
    };

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'ping' }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(String(event.data)) as { type?: string };
        if (data.type === 'downloads') sawDownloads = true;
        if (data.type === 'pong') sawPong = true;
        finish();
      } catch {
        clearTimeout(timeout);
        reject(new Error('received malformed websocket message'));
      }
    };

    ws.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('websocket connection failed'));
    };

    ws.onclose = () => {
      if (!sawDownloads || !sawPong) {
        clearTimeout(timeout);
        reject(new Error('websocket closed before smoke checks completed'));
      }
    };
  });
}

await smoke();

const BASE = 'http://localhost:3001';

async function smoke() {
  console.log('rip smoke test\n');
  let passed = 0;
  let failed = 0;

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

  await test('GET /health', async () => {
    const res = await fetch(`${BASE}/health`);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = (await res.json()) as { status: string };
    if (data.status !== 'ok') throw new Error(`unexpected status: ${data.status}`);
  });

  await test('GET /api/downloads', async () => {
    const res = await fetch(`${BASE}/api/downloads`);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = (await res.json()) as { downloads: unknown[] };
    if (!Array.isArray(data.downloads)) throw new Error('expected downloads array');
  });

  await test('POST /api/extract (invalid URL)', async () => {
    const res = await fetch(`${BASE}/api/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'not-a-url' }),
    });
    if (res.status !== 400) throw new Error(`expected 400, got ${res.status}`);
  });

  await test('POST /api/download (invalid payload)', async () => {
    const res = await fetch(`${BASE}/api/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (res.status !== 400) throw new Error(`expected 400, got ${res.status}`);
  });

  await test('DELETE /api/download/nonexistent', async () => {
    const res = await fetch(`${BASE}/api/download/nonexistent`, { method: 'DELETE' });
    if (res.status !== 404) throw new Error(`expected 404, got ${res.status}`);
  });

  await test('DELETE /api/downloads/completed', async () => {
    const res = await fetch(`${BASE}/api/downloads/completed`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`status ${res.status}`);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

smoke();

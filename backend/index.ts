import { Hono } from 'hono';
import { createBunWebSocket } from 'hono/bun';
import { cors } from 'hono/cors';
import type { WSContext } from 'hono/ws';
import type { WsMessage } from '../shared/types';
import { DownloadManager } from './download-manager';
import { env } from './env';
import { createRoutes } from './routes';
import { checkFfmpeg, checkYtdlp } from './ytdlp';

// ---------------------------------------------------------------------------
// WebSocket setup
// ---------------------------------------------------------------------------

const { upgradeWebSocket, websocket } = createBunWebSocket();

const clients = new Set<WSContext>();

function broadcast(msg: WsMessage): void {
  const data = JSON.stringify(msg);
  for (const ws of clients) {
    try {
      ws.send(data);
    } catch {
      clients.delete(ws);
    }
  }
}

// ---------------------------------------------------------------------------
// Download manager
// ---------------------------------------------------------------------------

const manager = new DownloadManager(env.MAX_CONCURRENT_DOWNLOADS, broadcast);

// ---------------------------------------------------------------------------
// Hono app
// ---------------------------------------------------------------------------

const app = new Hono();

// CORS — restrict to the frontend origin in production.
const ALLOWED_ORIGIN = env.NODE_ENV === 'production' ? env.WEB_ORIGIN : '*';

app.use(
  '/api/*',
  cors({
    origin: ALLOWED_ORIGIN,
    allowMethods: ['GET', 'POST', 'DELETE'],
    maxAge: 3600,
  }),
);

// Body size limit — reject payloads larger than 1 MB
const MAX_BODY_BYTES = 1024 * 1024;
app.use('/api/*', async (c, next) => {
  const contentLength = c.req.header('content-length');
  if (contentLength && Number.parseInt(contentLength, 10) > MAX_BODY_BYTES) {
    return c.json({ error: 'Request body too large.' }, 413);
  }
  await next();
});

// API routes
const api = createRoutes(manager);
app.route('/api', api);

// WebSocket endpoint
app.get(
  '/api/ws',
  upgradeWebSocket(() => ({
    onOpen(_event, ws) {
      clients.add(ws);
      ws.send(
        JSON.stringify({
          type: 'downloads',
          downloads: manager.getAll(),
        }),
      );
    },
    onClose(_event, ws) {
      clients.delete(ws);
    },
    onMessage(event, ws) {
      try {
        const msg = JSON.parse(String(event.data));
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } catch {
        // ignore malformed messages
      }
    },
  })),
);

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }));

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

async function start() {
  const ytdlpVersion = await checkYtdlp();
  if (ytdlpVersion) {
    console.log(`yt-dlp: ${ytdlpVersion}`);
  } else {
    console.warn('WARNING: yt-dlp not found. Install with: brew install yt-dlp');
  }

  const hasFfmpeg = await checkFfmpeg();
  if (hasFfmpeg) {
    console.log('ffmpeg: available');
  } else {
    console.warn('WARNING: ffmpeg not found. Install with: brew install ffmpeg');
  }

  const server = Bun.serve({
    port: env.PORT,
    fetch: app.fetch,
    websocket,
  });

  console.log(`rip API listening on http://localhost:${server.port}`);

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n${signal} received — draining...`);
    manager.killAll();
    manager.dispose();
    server.stop(true);
    await new Promise((r) => setTimeout(r, 5000));
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start();

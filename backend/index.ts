import { Hono } from 'hono';
import { createBunWebSocket } from 'hono/bun';
import { cors } from 'hono/cors';
import type { WSContext } from 'hono/ws';
import { DownloadManager } from './download-manager';
import { env } from './env';
import { createRoutes } from './routes';
import type { WsMessage } from './types';
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

app.use('/api/*', cors());

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

  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    manager.killAll();
    server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    manager.killAll();
    server.stop();
    process.exit(0);
  });
}

start();

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { DownloadManager } from './download-manager';
import { env } from './env';
import { createRoutes } from './routes';

const MAX_BODY_BYTES = 1024 * 1024;

export function createApp(manager: DownloadManager): Hono {
  const app = new Hono();

  const allowedOrigin = env.NODE_ENV === 'production' ? env.WEB_ORIGIN : '*';

  app.use(
    '/api/*',
    cors({
      origin: allowedOrigin,
      allowMethods: ['GET', 'POST', 'DELETE'],
      maxAge: 3600,
    }),
  );

  app.use('/api/*', async (c, next) => {
    const contentLength = c.req.header('content-length');
    if (contentLength && Number.parseInt(contentLength, 10) > MAX_BODY_BYTES) {
      return c.json({ error: 'Request body too large.' }, 413);
    }
    await next();
  });

  app.route('/api', createRoutes(manager));
  app.get('/health', (c) => c.json({ status: 'ok' }));

  return app;
}

import path from 'node:path';
import { env } from '../backend/env';

const clientDir = path.resolve(import.meta.dir, '../build/client');
const indexFile = Bun.file(path.join(clientDir, 'index.html'));

function resolveAssetPath(pathname: string): string {
  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const normalized = path.normalize(relativePath);
  return path.join(clientDir, normalized);
}

function isInsideClientDir(filePath: string): boolean {
  const relativePath = path.relative(clientDir, filePath);
  return relativePath !== '' && !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
}

const server = Bun.serve({
  port: env.WEB_PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const filePath = resolveAssetPath(url.pathname);

    if (isInsideClientDir(filePath)) {
      const file = Bun.file(filePath);
      if (await file.exists()) {
        return new Response(file);
      }
    }

    if (path.extname(url.pathname)) {
      return new Response('Not found', { status: 404 });
    }

    return new Response(indexFile);
  },
});

console.log(`rip web listening on http://localhost:${server.port}`);

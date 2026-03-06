const viteEnv = (
  import.meta as unknown as {
    env?: { DEV?: boolean; VITE_RIP_API_URL?: string };
  }
).env;

function getConfiguredApiOrigin(): string | null {
  const configured = viteEnv?.VITE_RIP_API_URL?.trim();
  if (!configured) return null;
  return configured.replace(/\/+$/, '');
}

export function getApiOrigin(): string {
  const configured = getConfiguredApiOrigin();
  if (configured) return configured;

  if (typeof window === 'undefined') {
    return 'http://localhost:3001';
  }

  const { origin, protocol, hostname, port } = window.location;

  if (viteEnv?.DEV) {
    return origin;
  }

  // Match the documented default production layout: web on :3000, API on :3001.
  if (port === '3000') {
    return `${protocol}//${hostname}:3001`;
  }

  return origin;
}

export function getApiUrl(path: string): string {
  return new URL(path, `${getApiOrigin()}/`).toString();
}

export function getWebSocketUrl(path: string): string {
  const apiOrigin = new URL(getApiOrigin());
  const protocol = apiOrigin.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${apiOrigin.host}${path}`;
}

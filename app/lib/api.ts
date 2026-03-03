type ApiFetchOptions = {
  body?: Record<string, unknown>;
  method?: string;
};

// Vite replaces import.meta.env.VITE_* at build time. Set VITE_RIP_API_URL to override.
const viteEnv = (import.meta as unknown as { env?: Record<string, string> }).env;
const API_BASE = viteEnv?.VITE_RIP_API_URL ?? '';

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const init: RequestInit = {
    method: options.method ?? 'GET',
  };

  if (options.body) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_BASE}${path}`, init);

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error((data as { error?: string } | null)?.error ?? response.statusText);
  }

  return response.json();
}

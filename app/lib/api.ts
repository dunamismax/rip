import { getApiUrl } from './network';

type ApiFetchOptions = {
  body?: Record<string, unknown>;
  method?: string;
};

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const init: RequestInit = {
    method: options.method ?? 'GET',
  };

  if (options.body) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(options.body);
  }

  const response = await fetch(getApiUrl(path), init);

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error((data as { error?: string } | null)?.error ?? response.statusText);
  }

  return response.json();
}

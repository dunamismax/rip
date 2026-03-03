import { useCallback, useState } from 'react';
import { cn } from '~/lib/utils';

type UrlInputProps = {
  onExtract: (url: string) => void;
  loading: boolean;
};

export function UrlInput({ onExtract, loading }: UrlInputProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = url.trim();
      if (!trimmed) return;

      try {
        new URL(trimmed);
      } catch {
        setError('Please enter a valid URL.');
        return;
      }

      setError(null);
      onExtract(trimmed);
    },
    [url, onExtract],
  );

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text.trim());
        setError(null);
      }
    } catch {
      // clipboard access denied — ignore
    }
  }, []);

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError(null);
            }}
            placeholder="Paste a video URL..."
            disabled={loading}
            className={cn(
              'w-full rounded-lg border px-4 py-3 text-sm transition-colors',
              'bg-[var(--rip-surface)] border-[var(--rip-border)] text-[var(--rip-text)]',
              'placeholder:text-[var(--rip-muted)]',
              'focus:border-[var(--rip-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--rip-accent)]',
              'disabled:opacity-50',
            )}
          />
          <button
            type="button"
            onClick={handlePaste}
            disabled={loading}
            className={cn(
              'absolute top-1/2 right-2 -translate-y-1/2 rounded-md px-2 py-1 text-xs transition-colors',
              'text-[var(--rip-muted)] hover:text-[var(--rip-text)] hover:bg-[var(--rip-border)]',
              'disabled:opacity-50',
            )}
          >
            Paste
          </button>
        </div>

        <button
          type="submit"
          disabled={loading || !url.trim()}
          className={cn(
            'rounded-lg px-6 py-3 text-sm font-medium text-white transition-colors',
            'bg-[var(--rip-accent)] hover:bg-[var(--rip-accent-hover)]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg
                aria-hidden="true"
                className="h-4 w-4 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="opacity-25"
                />
                <path
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  fill="currentColor"
                  className="opacity-75"
                />
              </svg>
              Extracting
            </span>
          ) : (
            'Extract'
          )}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-[var(--rip-error)]">{error}</p>}
    </form>
  );
}

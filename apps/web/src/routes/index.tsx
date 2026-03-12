import type {
  DownloadItem,
  OutputExtension,
  VideoMetadata,
} from '@rip/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import {
  Download,
  LoaderCircle,
  LogOut,
  RefreshCcw,
  Sparkles,
  Trash2,
  XCircle,
} from 'lucide-react'
import {
  type FormEvent,
  startTransition,
  useDeferredValue,
  useEffect,
  useState,
} from 'react'
import { FormatAdvisor } from '#/components/format-advisor'
import {
  api,
  formatBytes,
  formatDuration,
  formatSpeed,
  hasActiveDownloads,
} from '#/lib/api'
import { authClient } from '#/lib/auth-client'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  const session = authClient.useSession()

  if (session.isPending) {
    return (
      <main className="screen loading-screen">
        <div className="loading-card">
          <LoaderCircle className="spin" size={20} />
          <span>Loading rip...</span>
        </div>
      </main>
    )
  }

  if (!session.data?.user) {
    return <AuthScreen onAuthenticated={() => session.refetch()} />
  }

  return (
    <Dashboard
      userName={session.data.user.name}
      onSignOut={async () => {
        await authClient.signOut()
        await session.refetch()
      }}
    />
  )
}

function AuthScreen({
  onAuthenticated,
}: {
  onAuthenticated: () => Promise<void>
}) {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)

    try {
      const result =
        mode === 'sign-in'
          ? await authClient.signIn.email({
              email,
              password,
              rememberMe: true,
            })
          : await authClient.signUp.email({
              name,
              email,
              password,
            })

      if (result.error) {
        setError(result.error.message ?? 'Authentication failed.')
        return
      }

      await onAuthenticated()
    } catch (authError) {
      setError(
        authError instanceof Error
          ? authError.message
          : 'Authentication failed.'
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="screen auth-screen">
      <section className="auth-shell">
        <div className="auth-copy">
          <p className="eyebrow">Bun + TanStack Start</p>
          <h1>rip</h1>
          <p className="hero-text">
            Inspect yt-dlp formats, queue durable downloads in PostgreSQL, and
            track progress from a modern TypeScript stack.
          </p>
          <div className="stat-row">
            <div className="stat-pill">
              <span>Runtime</span>
              <strong>Bun</strong>
            </div>
            <div className="stat-pill">
              <span>Contracts</span>
              <strong>Effect Schema</strong>
            </div>
            <div className="stat-pill">
              <span>State</span>
              <strong>TanStack Query</strong>
            </div>
          </div>
        </div>

        <section className="panel auth-panel">
          <div className="mode-switch">
            <button
              type="button"
              className={mode === 'sign-in' ? 'mode-active' : ''}
              onClick={() => setMode('sign-in')}
            >
              Sign in
            </button>
            <button
              type="button"
              className={mode === 'sign-up' ? 'mode-active' : ''}
              onClick={() => setMode('sign-up')}
            >
              Create account
            </button>
          </div>

          <form className="stack" onSubmit={handleSubmit}>
            {mode === 'sign-up' ? (
              <label className="field">
                <span>Name</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Rip Operator"
                  required
                />
              </label>
            ) : null}

            <label className="field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
              />
            </label>

            <label className="field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                minLength={8}
                required
              />
            </label>

            {error ? <p className="error-text">{error}</p> : null}

            <button className="primary-button" type="submit" disabled={pending}>
              {pending
                ? 'Working...'
                : mode === 'sign-in'
                  ? 'Sign in'
                  : 'Create account'}
            </button>
          </form>
        </section>
      </section>
    </main>
  )
}

function Dashboard({
  onSignOut,
  userName,
}: {
  onSignOut: () => Promise<void>
  userName: string
}) {
  const queryClient = useQueryClient()
  const [url, setUrl] = useState('')
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null)
  const [selectedFormatId, setSelectedFormatId] = useState<string>('')
  const [outputExt, setOutputExt] = useState<OutputExtension | ''>('')
  const [extractError, setExtractError] = useState<string | null>(null)

  const downloadsQuery = useQuery({
    queryKey: ['downloads'],
    queryFn: api.listDownloads,
    refetchInterval: (query) =>
      hasActiveDownloads(query.state.data) ? 2_000 : 8_000,
  })

  const deferredDownloads = useDeferredValue(
    downloadsQuery.data?.downloads ?? []
  )

  const extractMutation = useMutation({
    mutationFn: api.extract,
    onSuccess: (response) => {
      startTransition(() => {
        setMetadata(response.metadata)
        setSelectedFormatId(response.metadata.formats[0]?.formatId ?? '')
        setOutputExt(response.metadata.formats[0]?.ext ?? '')
        setExtractError(null)
      })
    },
    onError: (error) => {
      setExtractError(
        error instanceof Error ? error.message : 'Could not inspect this URL.'
      )
    },
  })

  const queueMutation = useMutation({
    mutationFn: api.queueDownload,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['downloads'],
      })
    },
  })

  const cancelMutation = useMutation({
    mutationFn: api.cancelDownload,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['downloads'],
      })
    },
  })

  const clearMutation = useMutation({
    mutationFn: api.clearCompleted,
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['downloads'],
      })
    },
  })

  const selectedFormat =
    metadata?.formats.find((item) => item.formatId === selectedFormatId) ??
    metadata?.formats[0] ??
    null

  useEffect(() => {
    if (!selectedFormat) {
      setOutputExt('')
      return
    }

    const nextExt = selectedFormat.outputExtensions.includes(outputExt as never)
      ? outputExt
      : selectedFormat.ext

    setOutputExt(nextExt)
  }, [outputExt, selectedFormat])

  const activeCount =
    downloadsQuery.data?.downloads.filter((item) =>
      ['queued', 'downloading', 'processing'].includes(item.status)
    ).length ?? 0

  const completedCount =
    downloadsQuery.data?.downloads.filter((item) => item.status === 'completed')
      .length ?? 0

  return (
    <main className="screen">
      <section className="hero-band">
        <div>
          <p className="eyebrow">Self-hosted downloader</p>
          <h1>rip</h1>
          <p className="hero-text">
            Bun runtime, TanStack Start UI, Better Auth, Drizzle, Effect Schema,
            and a PostgreSQL-backed queue for yt-dlp downloads.
          </p>
        </div>

        <div className="hero-actions">
          <div className="stat-card">
            <span>Active jobs</span>
            <strong>{activeCount}</strong>
          </div>
          <div className="stat-card">
            <span>Completed</span>
            <strong>{completedCount}</strong>
          </div>
          <button
            className="ghost-button"
            type="button"
            onClick={() => void onSignOut()}
          >
            <LogOut size={16} />
            Sign out {userName ? `(${userName})` : ''}
          </button>
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="left-column">
          <section className="panel">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Inspect</p>
                <h2>Extract formats</h2>
              </div>
              <button
                className="ghost-button"
                type="button"
                onClick={() => {
                  setMetadata(null)
                  setSelectedFormatId('')
                  setOutputExt('')
                  setExtractError(null)
                }}
                disabled={!metadata}
              >
                <RefreshCcw size={16} />
                Reset
              </button>
            </div>

            <form
              className="stack"
              onSubmit={(event) => {
                event.preventDefault()
                void extractMutation.mutate({ url })
              }}
            >
              <label className="field">
                <span>Video URL</span>
                <input
                  type="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  required
                />
              </label>
              <button
                className="primary-button"
                type="submit"
                disabled={extractMutation.isPending}
              >
                {extractMutation.isPending
                  ? 'Inspecting...'
                  : 'Inspect formats'}
              </button>
            </form>

            {extractError ? <p className="error-text">{extractError}</p> : null}
          </section>

          {metadata ? (
            <>
              <section className="panel">
                <div className="media-summary">
                  {metadata.thumbnail ? (
                    <img
                      className="media-thumb"
                      src={metadata.thumbnail}
                      alt=""
                      loading="lazy"
                    />
                  ) : null}
                  <div className="media-copy">
                    <p className="eyebrow">Ready to queue</p>
                    <h2>{metadata.title}</h2>
                    <p className="panel-note">
                      {[
                        metadata.uploader,
                        metadata.extractor,
                        formatDuration(metadata.duration),
                      ]
                        .filter(Boolean)
                        .join(' | ')}
                    </p>
                    <a
                      className="text-link"
                      href={metadata.webpageUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open source page
                    </a>
                  </div>
                </div>

                <div className="format-grid">
                  {metadata.formats.length ? (
                    metadata.formats.map((format) => (
                      <label
                        key={format.formatId}
                        className={`format-card ${
                          format.formatId === selectedFormatId
                            ? 'format-card-active'
                            : ''
                        }`}
                      >
                        <input
                          type="radio"
                          name="format"
                          checked={format.formatId === selectedFormatId}
                          onChange={() => setSelectedFormatId(format.formatId)}
                        />
                        <div>
                          <strong>
                            {format.formatId} | {format.ext} |{' '}
                            {format.resolution ?? 'audio'}
                          </strong>
                          <p>
                            {format.filesize || format.filesizeApprox
                              ? formatBytes(
                                  format.filesize ?? format.filesizeApprox
                                )
                              : 'size unknown'}
                            {' | '}
                            {format.hasVideo && format.hasAudio
                              ? 'video + audio'
                              : format.hasVideo
                                ? 'video only'
                                : 'audio only'}
                            {format.formatNote ? ` | ${format.formatNote}` : ''}
                          </p>
                        </div>
                      </label>
                    ))
                  ) : (
                    <p className="panel-note">
                      yt-dlp returned no selectable formats for this URL.
                    </p>
                  )}
                </div>

                <form
                  className="queue-bar"
                  onSubmit={(event) => {
                    event.preventDefault()

                    if (!metadata || !selectedFormat) {
                      return
                    }

                    void queueMutation.mutate({
                      url,
                      formatId: selectedFormat.formatId,
                      title: metadata.title,
                      thumbnail: metadata.thumbnail,
                      ext: outputExt || selectedFormat.ext,
                      sourceExt: selectedFormat.ext,
                      hasVideo: selectedFormat.hasVideo,
                      hasAudio: selectedFormat.hasAudio,
                    })
                  }}
                >
                  <label className="field compact-field">
                    <span>Output format</span>
                    <select
                      value={outputExt}
                      onChange={(event) =>
                        setOutputExt(event.target.value as OutputExtension)
                      }
                      disabled={!selectedFormat}
                    >
                      {selectedFormat?.outputExtensions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      )) ?? <option value="">Choose a format</option>}
                    </select>
                  </label>
                  <button
                    className="primary-button"
                    type="submit"
                    disabled={!selectedFormat || queueMutation.isPending}
                  >
                    <Download size={16} />
                    {queueMutation.isPending ? 'Queueing...' : 'Queue download'}
                  </button>
                </form>

                {queueMutation.error ? (
                  <p className="error-text">
                    {queueMutation.error instanceof Error
                      ? queueMutation.error.message
                      : 'Unable to queue the download.'}
                  </p>
                ) : null}
              </section>

              <FormatAdvisor key={metadata.id} metadata={metadata} />
            </>
          ) : null}
        </div>

        <section className="panel downloads-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Queue</p>
              <h2>Downloads</h2>
            </div>
            <button
              className="ghost-button"
              type="button"
              onClick={() => void clearMutation.mutate()}
              disabled={
                clearMutation.isPending ||
                !downloadsQuery.data?.downloads.length
              }
            >
              <Trash2 size={16} />
              Clear finished
            </button>
          </div>

          {downloadsQuery.isLoading ? (
            <div className="loading-card inline-loading">
              <LoaderCircle className="spin" size={18} />
              <span>Loading downloads...</span>
            </div>
          ) : null}

          {downloadsQuery.error ? (
            <p className="error-text">
              {downloadsQuery.error instanceof Error
                ? downloadsQuery.error.message
                : 'Unable to load downloads.'}
            </p>
          ) : null}

          {!deferredDownloads.length && !downloadsQuery.isLoading ? (
            <div className="empty-state">
              <Sparkles size={18} />
              <span>No downloads yet.</span>
            </div>
          ) : (
            <div className="downloads-list">
              {deferredDownloads.map((item) => (
                <DownloadCard
                  key={item.id}
                  item={item}
                  busy={cancelMutation.isPending}
                  onCancel={() => void cancelMutation.mutate(item.id)}
                />
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  )
}

function DownloadCard({
  item,
  busy,
  onCancel,
}: {
  item: DownloadItem
  busy: boolean
  onCancel: () => void
}) {
  const active = ['queued', 'downloading', 'processing'].includes(item.status)

  return (
    <article className={`download-card status-${item.status}`}>
      <div className="download-head">
        <div>
          <h3>{item.title}</h3>
          <p className="panel-note">
            {item.status} | {item.formatId} | {item.ext}
          </p>
        </div>
        {active ? (
          <button
            className="ghost-button"
            type="button"
            onClick={onCancel}
            disabled={busy}
          >
            <XCircle size={16} />
            Cancel
          </button>
        ) : null}
      </div>

      <div className="progress-track">
        <div
          className="progress-bar"
          style={{ width: `${Math.max(2, item.progress.percentage)}%` }}
        />
      </div>

      <p className="download-meta">
        {item.progress.percentage}% |{' '}
        {formatBytes(item.progress.downloadedBytes)}
        {item.progress.totalBytes
          ? ` / ${formatBytes(item.progress.totalBytes)}`
          : ''}
        {item.progress.speed ? ` | ${formatSpeed(item.progress.speed)}` : ''}
        {item.progress.eta ? ` | ETA ${formatDuration(item.progress.eta)}` : ''}
      </p>

      {item.outputPath ? (
        <p className="download-path">{item.outputPath}</p>
      ) : null}
      {item.error ? <p className="error-text">{item.error}</p> : null}
    </article>
  )
}

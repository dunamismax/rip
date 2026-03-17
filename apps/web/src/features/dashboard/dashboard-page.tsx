import type {
  OutputExtension,
  SessionUser,
  VideoMetadata,
} from '@rip/contracts'
import { ExtractRequestSchema } from '@rip/contracts'
import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Download,
  LoaderCircle,
  LogOut,
  RefreshCcw,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { startTransition, useDeferredValue, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { api } from '@/lib/api'
import { formatBytes, formatDuration, hasActiveDownloads } from '@/lib/format'
import { DownloadCard } from './download-card'

function getFirstError(errors: unknown[]) {
  const [error] = errors
  return typeof error === 'string' ? error : undefined
}

export function DashboardPage({
  user,
  onSignOut,
}: {
  user: SessionUser
  onSignOut: () => Promise<void>
}) {
  const queryClient = useQueryClient()
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null)
  const [lastInspectedUrl, setLastInspectedUrl] = useState('')
  const [selectedFormatId, setSelectedFormatId] = useState('')
  const [outputExt, setOutputExt] = useState<OutputExtension | ''>('')
  const [extractError, setExtractError] = useState<string | null>(null)

  function resetInspectionState() {
    setMetadata(null)
    setLastInspectedUrl('')
    setSelectedFormatId('')
    setOutputExt('')
    setExtractError(null)
    queueMutation.reset()
  }

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
    onMutate: () => {
      resetInspectionState()
    },
    onSuccess: (response, variables) => {
      startTransition(() => {
        setMetadata(response.metadata)
        setLastInspectedUrl(variables.url)
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

  const extractForm = useForm({
    defaultValues: {
      url: '',
    },
    onSubmit: async ({ value }) => {
      await extractMutation.mutateAsync({ url: value.url.trim() })
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
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="space-y-6">
        <Card className="overflow-hidden border-none bg-transparent shadow-none">
          <CardContent className="mesh-panel grid gap-6 rounded-[2.4rem] border border-border/60 p-8 lg:grid-cols-[1.4fr_0.8fr] lg:p-10">
            <div className="space-y-5">
              <Badge>React SPA + Hono API</Badge>
              <div className="space-y-3">
                <p className="font-mono text-xs uppercase tracking-[0.34em] text-muted-foreground">
                  Queue command center
                </p>
                <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
                  Inspect a source, choose an output, and let the workers take
                  it from there.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground">
                  The frontend is now a dedicated Vite SPA, while the API, auth,
                  and queue live behind Hono + Prisma. The product flow stays
                  the same, but the architecture is cleaner and easier to own.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Badge variant="outline">Signed in as {user.name}</Badge>
                <Badge variant="outline">{user.email}</Badge>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              <MetricCard label="Active jobs" value={String(activeCount)} />
              <MetricCard label="Completed" value={String(completedCount)} />
              <Button
                className="justify-center"
                onClick={() => void onSignOut()}
                size="lg"
                type="button"
                variant="outline"
              >
                <LogOut className="size-4" />
                Sign out
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div className="space-y-2">
                  <CardTitle>Inspect a media URL</CardTitle>
                  <CardDescription>
                    Pull the available formats straight from yt-dlp, then queue
                    the one you want.
                  </CardDescription>
                </div>
                <Button
                  onClick={resetInspectionState}
                  type="button"
                  variant="ghost"
                >
                  <RefreshCcw className="size-4" />
                  Reset
                </Button>
              </CardHeader>

              <CardContent className="space-y-5">
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    void extractForm.handleSubmit()
                  }}
                >
                  <extractForm.Field
                    name="url"
                    validators={{
                      onBlur: ({ value }) => {
                        const result =
                          ExtractRequestSchema.shape.url.safeParse(value)
                        return result.success
                          ? undefined
                          : result.error.issues[0]?.message
                      },
                    }}
                  >
                    {(field) => (
                      <div className="space-y-2">
                        <label
                          className="text-sm font-medium text-foreground"
                          htmlFor={field.name}
                        >
                          Video URL
                        </label>
                        <Input
                          id={field.name}
                          name={field.name}
                          onBlur={field.handleBlur}
                          onChange={(event) =>
                            field.handleChange(event.target.value)
                          }
                          placeholder="https://www.youtube.com/watch?v=..."
                          type="url"
                          value={field.state.value}
                        />
                        {getFirstError(field.state.meta.errors) ? (
                          <p className="text-sm text-rose-700">
                            {getFirstError(field.state.meta.errors)}
                          </p>
                        ) : null}
                      </div>
                    )}
                  </extractForm.Field>

                  <Button
                    className="w-full sm:w-auto"
                    disabled={extractMutation.isPending}
                    type="submit"
                  >
                    {extractMutation.isPending ? (
                      <>
                        <LoaderCircle className="size-4 animate-spin" />
                        Inspecting...
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-4" />
                        Inspect formats
                      </>
                    )}
                  </Button>
                </form>

                {extractError ? (
                  <p className="rounded-2xl bg-rose-100/80 px-4 py-3 text-sm text-rose-700">
                    {extractError}
                  </p>
                ) : null}
              </CardContent>
            </Card>

            {metadata ? (
              <Card>
                <CardHeader>
                  <CardTitle>Ready to queue</CardTitle>
                  <CardDescription>
                    Choose the source format and the output container you want
                    on disk.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                  <div className="grid gap-5 md:grid-cols-[220px_1fr]">
                    {metadata.thumbnail ? (
                      <img
                        alt={`${metadata.title} thumbnail`}
                        className="aspect-video w-full rounded-[1.7rem] border border-border/70 object-cover shadow-sm"
                        loading="lazy"
                        src={metadata.thumbnail}
                      />
                    ) : null}

                    <div className="space-y-3">
                      <Badge variant="outline">{metadata.extractor}</Badge>
                      <div>
                        <h2 className="text-2xl font-semibold text-foreground">
                          {metadata.title}
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          {[
                            metadata.uploader,
                            formatDuration(metadata.duration),
                          ]
                            .filter(Boolean)
                            .join(' / ')}
                        </p>
                      </div>
                      <a
                        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                        href={metadata.webpageUrl}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Open source page
                      </a>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid gap-3">
                    {metadata.formats.length ? (
                      metadata.formats.map((format) => {
                        const selected = format.formatId === selectedFormatId

                        return (
                          <button
                            className={`rounded-[1.6rem] border p-4 text-left transition ${
                              selected
                                ? 'border-primary bg-primary/8 shadow-sm'
                                : 'border-border/70 bg-white/70 hover:border-primary/40 hover:bg-accent/60'
                            }`}
                            key={format.formatId}
                            onClick={() => setSelectedFormatId(format.formatId)}
                            type="button"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="font-semibold text-foreground">
                                  {format.formatId} / {format.ext} /{' '}
                                  {format.resolution ?? 'audio'}
                                </p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {format.filesize || format.filesizeApprox
                                    ? formatBytes(
                                        format.filesize ?? format.filesizeApprox
                                      )
                                    : 'size unknown'}
                                  {' / '}
                                  {format.hasVideo && format.hasAudio
                                    ? 'video + audio'
                                    : format.hasVideo
                                      ? 'video only'
                                      : 'audio only'}
                                  {format.formatNote
                                    ? ` / ${format.formatNote}`
                                    : ''}
                                </p>
                              </div>

                              <Badge variant={selected ? 'default' : 'outline'}>
                                {selected ? 'Selected' : 'Available'}
                              </Badge>
                            </div>
                          </button>
                        )
                      })
                    ) : (
                      <p className="rounded-2xl bg-secondary/70 px-4 py-3 text-sm text-muted-foreground">
                        yt-dlp returned no selectable formats for this URL.
                      </p>
                    )}
                  </div>

                  <div className="grid gap-4 rounded-[1.8rem] border border-border/70 bg-secondary/50 p-5 md:grid-cols-[1fr_auto] md:items-end">
                    <div className="space-y-2">
                      <span className="text-sm font-medium text-foreground">
                        Output format
                      </span>
                      <Select
                        disabled={!selectedFormat}
                        onValueChange={(value) =>
                          setOutputExt(value as OutputExtension)
                        }
                        value={outputExt}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a format" />
                        </SelectTrigger>
                        <SelectContent>
                          {selectedFormat?.outputExtensions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      disabled={
                        !selectedFormat ||
                        !lastInspectedUrl ||
                        queueMutation.isPending
                      }
                      onClick={() => {
                        if (!metadata || !selectedFormat) {
                          return
                        }

                        void queueMutation.mutate({
                          url: lastInspectedUrl,
                          formatId: selectedFormat.formatId,
                          title: metadata.title,
                          thumbnail: metadata.thumbnail,
                          ext: outputExt || selectedFormat.ext,
                          sourceExt: selectedFormat.ext,
                          hasVideo: selectedFormat.hasVideo,
                          hasAudio: selectedFormat.hasAudio,
                        })
                      }}
                      size="lg"
                      type="button"
                    >
                      <Download className="size-4" />
                      {queueMutation.isPending
                        ? 'Queueing...'
                        : 'Queue download'}
                    </Button>
                  </div>

                  {queueMutation.error ? (
                    <p className="rounded-2xl bg-rose-100/80 px-4 py-3 text-sm text-rose-700">
                      {queueMutation.error instanceof Error
                        ? queueMutation.error.message
                        : 'Unable to queue the download.'}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}
          </div>

          <Card className="h-full">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div className="space-y-2">
                <CardTitle>Downloads</CardTitle>
                <CardDescription>
                  Active workers poll more often, completed items can be cleared
                  in one shot.
                </CardDescription>
              </div>
              <Button
                disabled={
                  clearMutation.isPending ||
                  !deferredDownloads.some((item) =>
                    ['completed', 'failed', 'cancelled'].includes(item.status)
                  )
                }
                onClick={() => void clearMutation.mutate()}
                type="button"
                variant="outline"
              >
                <Trash2 className="size-4" />
                Clear finished
              </Button>
            </CardHeader>

            <CardContent className="space-y-4">
              {downloadsQuery.isLoading ? (
                <div className="flex items-center gap-3 rounded-[1.7rem] bg-secondary/70 px-4 py-4 text-sm text-muted-foreground">
                  <LoaderCircle className="size-4 animate-spin" />
                  Loading downloads...
                </div>
              ) : null}

              {downloadsQuery.error ? (
                <p className="rounded-2xl bg-rose-100/80 px-4 py-3 text-sm text-rose-700">
                  {downloadsQuery.error instanceof Error
                    ? downloadsQuery.error.message
                    : 'Unable to load downloads.'}
                </p>
              ) : null}

              {!deferredDownloads.length && !downloadsQuery.isLoading ? (
                <div className="flex items-center gap-3 rounded-[1.8rem] border border-dashed border-border bg-secondary/50 px-5 py-6 text-sm text-muted-foreground">
                  <Sparkles className="size-4" />
                  No downloads yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {deferredDownloads.map((item) => (
                    <DownloadCard
                      busy={cancelMutation.isPending}
                      item={item}
                      key={item.id}
                      onCancel={() => void cancelMutation.mutate(item.id)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.7rem] border border-border/70 bg-white/72 p-5 backdrop-blur-sm">
      <p className="font-mono text-xs uppercase tracking-[0.26em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold text-foreground">{value}</p>
    </div>
  )
}

import type { DownloadItem } from '@rip/contracts'
import { XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { formatBytes, formatDuration, formatSpeed } from '@/lib/format'

function statusVariant(status: DownloadItem['status']) {
  switch (status) {
    case 'completed':
      return 'success'
    case 'failed':
    case 'cancelled':
      return 'destructive'
    case 'processing':
      return 'warning'
    default:
      return 'default'
  }
}

export function DownloadCard({
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
    <Card className="rounded-[1.7rem] border-white/70 bg-white/85">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
              <Badge variant="outline">
                {item.formatId} / {item.ext}
              </Badge>
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">
                {item.title}
              </h3>
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {new Date(item.createdAt).toLocaleString()}
              </p>
            </div>
          </div>

          {active ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
              disabled={busy}
            >
              <XCircle className="size-4" />
              Cancel
            </Button>
          ) : null}
        </div>

        <Progress value={Math.max(2, item.progress.percentage)} />

        <p className="text-sm leading-6 text-muted-foreground">
          {item.progress.percentage}% /{' '}
          {formatBytes(item.progress.downloadedBytes)}
          {item.progress.totalBytes
            ? ` of ${formatBytes(item.progress.totalBytes)}`
            : ''}
          {item.progress.speed ? ` / ${formatSpeed(item.progress.speed)}` : ''}
          {item.progress.eta
            ? ` / ETA ${formatDuration(item.progress.eta)}`
            : ''}
        </p>

        {item.outputPath ? (
          <p className="rounded-2xl bg-secondary/70 px-4 py-3 font-mono text-xs text-muted-foreground">
            {item.outputPath}
          </p>
        ) : null}

        {item.error ? (
          <p className="rounded-2xl bg-rose-100/80 px-4 py-3 text-sm text-rose-700">
            {item.error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

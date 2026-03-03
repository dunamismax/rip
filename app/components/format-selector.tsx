import { useMemo } from 'react';
import type { VideoFormat } from '~/lib/types';
import { cn, formatBytes } from '~/lib/utils';

type FormatSelectorProps = {
  formats: VideoFormat[];
  selected: string;
  onSelect: (formatId: string) => void;
};

type FormatGroup = {
  label: string;
  formats: VideoFormat[];
};

export function FormatSelector({ formats, selected, onSelect }: FormatSelectorProps) {
  const groups = useMemo(() => groupFormats(formats), [formats]);

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-wider text-[var(--rip-muted)]">Format</p>
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-1 text-xs text-[var(--rip-muted)]">{group.label}</p>
          <div className="flex flex-wrap gap-2">
            {group.formats.map((f) => {
              const isSelected = selected === f.formatId;
              const size = f.filesize ?? f.filesizeApprox;
              return (
                <button
                  key={f.formatId}
                  type="button"
                  onClick={() => onSelect(f.formatId)}
                  className={cn(
                    'rounded-md border px-3 py-1.5 text-xs transition-all',
                    isSelected
                      ? 'border-[var(--rip-accent)] bg-[var(--rip-accent)] text-white'
                      : 'border-[var(--rip-border)] text-[var(--rip-text)] hover:border-[var(--rip-accent)]',
                  )}
                >
                  <span className="font-medium">{f.resolution ?? f.formatNote ?? f.ext}</span>
                  {size ? <span className="ml-1 opacity-70">({formatBytes(size)})</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function groupFormats(formats: VideoFormat[]): FormatGroup[] {
  const groups: FormatGroup[] = [];

  // Video + Audio combined
  const combined = formats.filter((f) => f.hasVideo && f.hasAudio);
  if (combined.length > 0) {
    // Deduplicate by resolution, keep highest quality per resolution
    const byRes = new Map<string, VideoFormat>();
    for (const f of combined) {
      const key = f.resolution ?? 'unknown';
      const existing = byRes.get(key);
      if (!existing || (f.tbr ?? 0) > (existing.tbr ?? 0)) {
        byRes.set(key, f);
      }
    }
    groups.push({
      label: 'Video + Audio',
      formats: Array.from(byRes.values()).sort((a, b) => (b.tbr ?? 0) - (a.tbr ?? 0)),
    });
  }

  // Video-only formats (higher-res options like 4K that aren't available as combined)
  const combinedResolutions = new Set(combined.map((f) => f.resolution ?? 'unknown'));
  const videoOnly = formats
    .filter((f) => f.hasVideo && !f.hasAudio)
    .sort((a, b) => (b.tbr ?? 0) - (a.tbr ?? 0));
  const byRes = new Map<string, VideoFormat>();
  for (const f of videoOnly) {
    const key = f.resolution ?? 'unknown';
    if (!byRes.has(key) && !combinedResolutions.has(key)) byRes.set(key, f);
  }
  if (byRes.size > 0) {
    groups.push({
      label: 'Video (best audio auto-merged)',
      formats: Array.from(byRes.values()),
    });
  }

  // Audio-only
  const audioOnly = formats.filter((f) => f.hasAudio && !f.hasVideo);
  if (audioOnly.length > 0) {
    const byExt = new Map<string, VideoFormat>();
    for (const f of audioOnly) {
      const key = f.ext;
      const existing = byExt.get(key);
      if (!existing || (f.tbr ?? 0) > (existing.tbr ?? 0)) {
        byExt.set(key, f);
      }
    }
    groups.push({
      label: 'Audio Only',
      formats: Array.from(byExt.values()).sort((a, b) => (b.tbr ?? 0) - (a.tbr ?? 0)),
    });
  }

  return groups;
}

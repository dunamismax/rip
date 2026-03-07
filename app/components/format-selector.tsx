import { useMemo } from 'react';
import { groupFormats } from '~/lib/format-options';
import type { VideoFormat } from '~/lib/types';
import { cn, formatBytes } from '~/lib/utils';

type FormatSelectorProps = {
  formats: VideoFormat[];
  selected: string;
  onSelect: (formatId: string) => void;
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

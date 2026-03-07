import type { VideoFormat } from '../../shared/types';

type FormatGroup = {
  label: string;
  formats: VideoFormat[];
};

export function getSelectableFormats(formats: VideoFormat[]): VideoFormat[] {
  return groupFormats(formats).flatMap((group) => group.formats);
}

export function groupFormats(formats: VideoFormat[]): FormatGroup[] {
  const groups: FormatGroup[] = [];

  const combined = formats.filter((f) => f.hasVideo && f.hasAudio);
  if (combined.length > 0) {
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

  const combinedResolutions = new Set(combined.map((f) => f.resolution ?? 'unknown'));
  const videoOnly = formats
    .filter((f) => f.hasVideo && !f.hasAudio)
    .sort((a, b) => (b.tbr ?? 0) - (a.tbr ?? 0));
  const byRes = new Map<string, VideoFormat>();
  for (const f of videoOnly) {
    const key = f.resolution ?? 'unknown';
    if (!byRes.has(key) && !combinedResolutions.has(key)) {
      byRes.set(key, f);
    }
  }
  if (byRes.size > 0) {
    groups.push({
      label: 'Video (best audio auto-merged)',
      formats: Array.from(byRes.values()),
    });
  }

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

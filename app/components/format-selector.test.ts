import { describe, expect, test } from 'bun:test';
import { getSelectableFormats, groupFormats } from '~/lib/format-options';
import type { VideoFormat } from '~/lib/types';

function makeFormat(
  format: Partial<VideoFormat> & Pick<VideoFormat, 'formatId' | 'ext'>,
): VideoFormat {
  return {
    formatId: format.formatId,
    ext: format.ext,
    resolution: format.resolution ?? null,
    filesize: format.filesize ?? null,
    filesizeApprox: format.filesizeApprox ?? null,
    vcodec: format.vcodec ?? null,
    acodec: format.acodec ?? null,
    fps: format.fps ?? null,
    tbr: format.tbr ?? null,
    formatNote: format.formatNote ?? null,
    hasVideo: format.hasVideo ?? false,
    hasAudio: format.hasAudio ?? false,
  };
}

describe('format selection helpers', () => {
  test('selectable formats match the visible grouped buttons', () => {
    const formats: VideoFormat[] = [
      makeFormat({
        formatId: '18',
        ext: 'mp4',
        resolution: '360p',
        tbr: 500,
        hasVideo: true,
        hasAudio: true,
      }),
      makeFormat({
        formatId: '22',
        ext: 'mp4',
        resolution: '360p',
        tbr: 900,
        hasVideo: true,
        hasAudio: true,
      }),
      makeFormat({
        formatId: '137',
        ext: 'mp4',
        resolution: '1080p',
        tbr: 2500,
        hasVideo: true,
        hasAudio: false,
      }),
      makeFormat({
        formatId: '251',
        ext: 'webm',
        tbr: 160,
        formatNote: '160k',
        hasVideo: false,
        hasAudio: true,
      }),
    ];

    const groups = groupFormats(formats);
    const selectable = getSelectableFormats(formats);

    expect(groups.map((group) => group.label)).toEqual([
      'Video + Audio',
      'Video (best audio auto-merged)',
      'Audio Only',
    ]);
    expect(selectable.map((format) => format.formatId)).toEqual(['22', '137', '251']);
  });

  test('video-only formats at the same resolution stay hidden when a combined option exists', () => {
    const formats: VideoFormat[] = [
      makeFormat({
        formatId: '22',
        ext: 'mp4',
        resolution: '720p',
        tbr: 1200,
        hasVideo: true,
        hasAudio: true,
      }),
      makeFormat({
        formatId: '136',
        ext: 'mp4',
        resolution: '720p',
        tbr: 1400,
        hasVideo: true,
        hasAudio: false,
      }),
      makeFormat({
        formatId: '248',
        ext: 'webm',
        resolution: '1080p',
        tbr: 2400,
        hasVideo: true,
        hasAudio: false,
      }),
    ];

    expect(getSelectableFormats(formats).map((format) => format.formatId)).toEqual(['22', '248']);
  });
});

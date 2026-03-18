import { describe, expect, it } from 'vitest'
import {
  buildDownloadArgs,
  mapMetadata,
  parseMetadataOutput,
  parseProgressLine,
} from './ytdlp'

describe('ytdlp helpers', () => {
  it('includes ffmpeg location and remux arguments for video outputs', () => {
    const args = buildDownloadArgs({
      url: 'https://example.com/watch?v=abc123',
      formatId: '137+140',
      title: 'Example',
      thumbnail: null,
      ext: 'mkv',
      sourceExt: 'mp4',
      hasVideo: true,
      hasAudio: true,
    })

    expect(args).toContain('--ffmpeg-location')
    expect(args[args.indexOf('--ffmpeg-location') + 1]).toBe('ffmpeg')
    expect(args).toContain('--remux-video')
    expect(args[args.indexOf('--remux-video') + 1]).toBe('mkv')
    expect(args).toContain('--no-playlist')
  })

  it('extracts audio when the requested output is audio-only', () => {
    const args = buildDownloadArgs({
      url: 'https://example.com/watch?v=abc123',
      formatId: '251',
      title: 'Example',
      thumbnail: null,
      ext: 'mp3',
      sourceExt: 'webm',
      hasVideo: false,
      hasAudio: true,
    })

    expect(args).toContain('--extract-audio')
    expect(args[args.indexOf('--audio-format') + 1]).toBe('mp3')
  })

  it('parses yt-dlp progress lines into percentages and totals', () => {
    expect(parseProgressLine('512|1024|NA|256|5|downloading')).toEqual({
      downloadedBytes: 512,
      totalBytes: 1024,
      speed: 256,
      eta: 5,
      percentage: 50,
    })
  })

  it('extracts a JSON object when yt-dlp prefixes stdout with extra lines', () => {
    expect(
      parseMetadataOutput(
        [
          '[debug] Optional plugin loaded',
          '{"id":"abc123","title":"Example","formats":[]}',
        ].join('\n')
      )
    ).toEqual({
      id: 'abc123',
      title: 'Example',
      formats: [],
    })
  })

  it('reports a clearer extractor error when yt-dlp returns null', () => {
    expect(() => parseMetadataOutput('null')).toThrow(
      'yt-dlp could not extract metadata for this URL.'
    )
  })

  it('skips unsupported source formats instead of failing the whole metadata response', () => {
    const parsed = mapMetadata({
      id: 'abc123',
      title: 'Example',
      webpage_url: 'https://example.com/watch?v=abc123',
      extractor_key: 'Generic',
      formats: [
        {
          format_id: 'page',
          ext: 'mhtml',
          vcodec: 'none',
          acodec: 'none',
        },
        {
          format_id: '18',
          ext: 'mp4',
          vcodec: 'avc1',
          acodec: 'mp4a',
        },
      ],
    })

    expect(parsed.formats).toHaveLength(1)
    expect(parsed.formats[0]).toMatchObject({
      formatId: '18',
      ext: 'mp4',
    })
  })
})

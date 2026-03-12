import { describe, expect, it } from 'vitest'
import { buildDownloadArgs, parseProgressLine } from './ytdlp'

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
    expect(args[args.indexOf('--ffmpeg-location') + 1]).toBe(
      '/opt/homebrew/bin/ffmpeg'
    )
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
})

import { describe, expect, it } from 'vitest'
import {
  normalizeExtension,
  outputExtensions,
  outputKind,
  validateOutputExtension,
} from './download-options'

describe('download-options', () => {
  it('normalizes leading dots and casing', () => {
    expect(normalizeExtension('.MP4')).toBe('mp4')
  })

  it('classifies audio outputs correctly', () => {
    expect(outputKind('mp3')).toBe('audio')
  })

  it('preserves the source extension and deduplicates output options', () => {
    expect(
      outputExtensions({
        sourceExt: 'mp4',
        hasVideo: true,
        hasAudio: true,
      })
    ).toEqual([
      'mp4',
      'avi',
      'flv',
      'gif',
      'mkv',
      'mov',
      'webm',
      'aac',
      'alac',
      'flac',
      'm4a',
      'mp3',
      'opus',
      'vorbis',
      'wav',
    ])
  })

  it('rejects unsupported output formats', () => {
    expect(() => validateOutputExtension('exe')).toThrow(
      "Unsupported output format 'exe'."
    )
  })
})

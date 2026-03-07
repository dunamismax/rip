import { describe, expect, test } from 'bun:test';
import { countIncompleteDownloads, isIncompleteStatus } from './download-stats';

describe('download queue stats', () => {
  test('counts only incomplete downloads', () => {
    expect(
      countIncompleteDownloads([
        { status: 'queued' },
        { status: 'downloading' },
        { status: 'processing' },
        { status: 'completed' },
        { status: 'failed' },
        { status: 'cancelled' },
      ]),
    ).toBe(3);
  });

  test('recognizes incomplete statuses explicitly', () => {
    expect(isIncompleteStatus('queued')).toBe(true);
    expect(isIncompleteStatus('downloading')).toBe(true);
    expect(isIncompleteStatus('processing')).toBe(true);
    expect(isIncompleteStatus('completed')).toBe(false);
  });
});

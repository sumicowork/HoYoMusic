import { describe, expect, it } from 'vitest';
import {
  formatDuration,
  formatDurationLong,
  formatFileSize,
} from '../format';

describe('formatDuration', () => {
  it('returns a placeholder for falsy input', () => {
    expect(formatDuration(0)).toBe('--:--');
    expect(formatDuration(null)).toBe('--:--');
    expect(formatDuration(undefined)).toBe('--:--');
  });

  it('formats seconds under a minute', () => {
    expect(formatDuration(5)).toBe('0:05');
    expect(formatDuration(9)).toBe('0:09');
  });

  it('formats minutes and seconds with zero padding', () => {
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(600)).toBe('10:00');
    expect(formatDuration(3599)).toBe('59:59');
  });
});

describe('formatDurationLong', () => {
  it('returns a placeholder for falsy input', () => {
    expect(formatDurationLong(0)).toBe('--:--');
    expect(formatDurationLong(undefined)).toBe('--:--');
  });

  it('uses MM:SS for durations under an hour', () => {
    expect(formatDurationLong(65)).toBe('1:05');
    expect(formatDurationLong(3599)).toBe('59:59');
  });

  it('uses H:MM:SS for durations of an hour or more', () => {
    expect(formatDurationLong(3600)).toBe('1:00:00');
    expect(formatDurationLong(3661)).toBe('1:01:01');
    expect(formatDurationLong(7325)).toBe('2:02:05');
  });
});

describe('formatFileSize', () => {
  it('returns 0 B for falsy input', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(null)).toBe('0 B');
    expect(formatFileSize(undefined)).toBe('0 B');
  });

  it('formats bytes and kilobytes without decimals', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(1024)).toBe('1.0 KB');
  });

  it('scales up through units and keeps one decimal', () => {
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(1048576)).toBe('1.0 MB');
    expect(formatFileSize(1073741824)).toBe('1.0 GB');
  });
});

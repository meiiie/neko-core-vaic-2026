import { describe, expect, it } from 'vitest';
import {
  formatDuration,
  formatResolution,
  resumePositionFrom,
  titleFromFileName,
} from './video-probe';

describe('formatDuration', () => {
  it('renders the compact player form below and above one hour', () => {
    expect(formatDuration(204)).toBe('3:24');
    expect(formatDuration(59)).toBe('0:59');
    expect(formatDuration(3725)).toBe('1:02:05');
  });

  it('returns empty for unusable values', () => {
    expect(formatDuration(null)).toBe('');
    expect(formatDuration(0)).toBe('');
    expect(formatDuration(Number.NaN)).toBe('');
    expect(formatDuration(-3)).toBe('');
  });
});

describe('formatResolution', () => {
  it('labels the common teaching-video heights', () => {
    expect(formatResolution(1920, 1080)).toBe('1920×1080 · 1080p');
    expect(formatResolution(1280, 720)).toBe('1280×720 · 720p');
    expect(formatResolution(640, 360)).toBe('640×360');
  });

  it('returns empty when a dimension is missing', () => {
    expect(formatResolution(null, 720)).toBe('');
    expect(formatResolution(1280, null)).toBe('');
  });
});

describe('titleFromFileName', () => {
  it('turns a filename into a readable title draft', () => {
    expect(titleFromFileName('phan-so_bang nhau.final.mp4')).toBe('phan so bang nhau final');
    expect(titleFromFileName('K02 — Phân số bằng nhau.pdf')).toBe('K02 — Phân số bằng nhau');
  });

  it('caps the draft at the 120-character title limit', () => {
    expect(titleFromFileName(`${'a'.repeat(200)}.mp4`)).toHaveLength(120);
  });
});

describe('resumePositionFrom', () => {
  it('restores a mid-video position', () => {
    expect(resumePositionFrom(204, 600)).toBe(204);
  });

  it('ignores an accidental tap below 5 seconds', () => {
    expect(resumePositionFrom(4, 600)).toBeNull();
  });

  it('restarts a video watched past 90 percent', () => {
    expect(resumePositionFrom(590, 600)).toBeNull();
  });

  it('needs both position and duration', () => {
    expect(resumePositionFrom(null, 600)).toBeNull();
    expect(resumePositionFrom(120, null)).toBeNull();
    expect(resumePositionFrom(Number.NaN, 600)).toBeNull();
  });
});

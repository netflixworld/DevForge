import { describe, expect, it } from 'vitest';
import {
  isHttpUrl,
  levelFromXp,
  normalizedCsv,
  overlapScore,
  parseDuration,
  progressBar,
  safeCodeBlock,
  xpForLevel,
} from '../src/utils.js';

describe('utility functions', () => {
  it('normalizes comma-separated skills without duplicates', () => {
    expect(normalizedCsv(' TypeScript, Rust, TypeScript,  Go ')).toBe('TypeScript, Rust, Go');
  });

  it('calculates deterministic XP levels', () => {
    expect(levelFromXp(0)).toBe(0);
    expect(levelFromXp(99)).toBe(0);
    expect(levelFromXp(100)).toBe(1);
    expect(levelFromXp(900)).toBe(3);
    expect(xpForLevel(4)).toBe(1600);
  });

  it('finds shared skills case-insensitively', () => {
    expect(overlapScore('TypeScript, Rust, Docker', 'rust, Go, docker')).toBe(2);
  });

  it('parses safe moderation durations', () => {
    expect(parseDuration('30m')).toBe(1_800_000);
    expect(parseDuration('2h')).toBe(7_200_000);
    expect(parseDuration('7d')).toBe(604_800_000);
    expect(parseDuration('29d')).toBeNull();
    expect(parseDuration('forever')).toBeNull();
  });

  it('rejects non-http URLs', () => {
    expect(isHttpUrl('https://example.com')).toBe(true);
    expect(isHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpUrl('not a url')).toBe(false);
  });

  it('neutralizes nested code fences', () => {
    const rendered = safeCodeBlock('before```after', 'ts');
    expect(rendered).toContain('`\u200b``');
    expect(rendered.startsWith('```ts')).toBe(true);
  });

  it('renders a fixed-width progress bar', () => {
    expect(progressBar(50, 100, 10)).toBe('▰▰▰▰▰▱▱▱▱▱');
  });
});

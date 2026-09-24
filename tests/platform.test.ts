import { describe, expect, it } from 'vitest';
import type { ProjectRow } from '../src/types.js';
import { matchScore, projectHealth } from '../src/services/platform.js';

function project(overrides: Partial<ProjectRow> = {}): ProjectRow {
  return {
    id: 'prj_test', guild_id: 'g1', owner_id: 'u1', title: 'Dev tool', summary: 'A useful tool',
    stack: 'TypeScript, Node.js', repo_url: 'https://github.com/example/tool', demo_url: null,
    looking_for: 'Frontend developer', status: 'open', stars: 4, channel_id: null, message_id: null,
    created_at: '2026-09-01T00:00:00.000Z', closed_at: null, ...overrides,
  };
}

describe('DevForge Platform', () => {
  it('matches profiles to compatible project stacks', () => {
    expect(matchScore('TypeScript, Rust, PostgreSQL', 'Node.js / TypeScript')).toBe(1);
    expect(matchScore('Python', 'Rust, Go')).toBe(0);
  });

  it('marks recently documented projects healthy', () => {
    const now = Date.parse('2026-09-24T00:00:00.000Z');
    const result = projectHealth(project(), [
      { kind: 'workspace', createdAt: '2026-09-23T00:00:00.000Z' },
      { kind: 'devlog', createdAt: '2026-09-23T00:00:00.000Z' },
      { kind: 'milestone', createdAt: '2026-09-22T00:00:00.000Z' },
    ], now);
    expect(result.state).toBe('Healthy');
    expect(result.score).toBeGreaterThanOrEqual(75);
  });

  it('flags old projects without activity for rescue', () => {
    const result = projectHealth(project({ repo_url: null, looking_for: null, stars: 0, created_at: '2026-01-01T00:00:00.000Z' }), [], Date.parse('2026-09-24T00:00:00.000Z'));
    expect(result.state).toBe('Inactive');
    expect(result.recommendations.length).toBeGreaterThan(0);
  });
});

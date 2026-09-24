import { describe, expect, it } from 'vitest';
import { commands } from '../src/commands/index.js';

describe('slash command registry', () => {
  it('contains valid, unique commands within Discord limits', () => {
    const payloads = commands.map((command) => command.data.toJSON());
    const names = payloads.map((command) => command.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names.length).toBeLessThanOrEqual(100);
    expect(names).toContain('ticket');
    expect(names).toContain('health');
    expect(names).toContain('hackathon');
    expect(names).toContain('tools');
    expect(names).toContain('passport');
    expect(names).toContain('discover');
    expect(names).toContain('projecthealth');
    expect(names).toContain('workspace');
  });
});

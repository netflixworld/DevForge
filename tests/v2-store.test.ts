import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FeatureStore } from '../src/v2/store.js';

describe('FeatureStore', () => {
  let store: FeatureStore;

  beforeEach(() => {
    store = new FeatureStore(':memory:');
  });

  afterEach(() => {
    store.close();
  });

  it('creates, updates, and lists typed feature items', () => {
    const item = store.createItem({
      guildId: 'g1',
      type: 'event',
      ownerId: 'u1',
      title: 'Code Jam',
      status: 'registration',
      data: { capacity: 10 },
    });
    store.updateItem(item.id, { status: 'running', data: { capacity: 20 } });
    const updated = store.getItem(item.id);
    expect(updated?.status).toBe('running');
    expect(updated?.data['capacity']).toBe(20);
    expect(store.listItems({ guildId: 'g1', type: 'event' })).toHaveLength(1);
  });

  it('keeps one membership and one vote per user', () => {
    const item = store.createItem({ guildId: 'g1', type: 'poll', ownerId: 'u1', title: 'Question' });
    store.setMember({ itemId: item.id, userId: 'u2', role: 'participant' });
    store.setMember({ itemId: item.id, userId: 'u2', role: 'reviewer' });
    expect(store.listMembers(item.id)).toHaveLength(1);
    expect(store.getMember(item.id, 'u2')?.role).toBe('reviewer');
    expect(store.vote(item.id, 'u2', 'yes')).toEqual({ created: true, total: 1 });
    expect(store.vote(item.id, 'u2', 'yes')).toEqual({ created: false, total: 0 });
  });

  it('enforces non-negative internal credit balances', () => {
    expect(store.changeCredits('g1', 'u1', 50, 'award')).toBe(50);
    expect(store.changeCredits('g1', 'u1', -20, 'purchase')).toBe(30);
    expect(() => store.changeCredits('g1', 'u1', -31, 'invalid')).toThrow('INSUFFICIENT_CREDITS');
    expect(store.wallet('g1', 'u1').credits).toBe(30);
  });

  it('tracks modules, permissions, preferences, and rate limits', () => {
    store.setModule('g1', 'tickets', false);
    store.setPermission('g1', 'ticket', 'role1', true);
    store.setPreference('g1', 'u1', 'notify.events', false);
    expect(store.isModuleEnabled('g1', 'tickets')).toBe(false);
    expect(store.permissions('g1', 'ticket')).toEqual([{ command: 'ticket', role_id: 'role1', allowed: 1 }]);
    expect(store.getPreference('g1', 'u1', 'notify.events', true)).toBe(false);
    expect(store.consumeRateLimit({ guildId: 'g1', userId: 'u1', action: 'test', limit: 1, windowMs: 60_000 }).allowed).toBe(true);
    expect(store.consumeRateLimit({ guildId: 'g1', userId: 'u1', action: 'test', limit: 1, windowMs: 60_000 }).allowed).toBe(false);
  });

  it('tracks daily streaks without double counting the same day', () => {
    expect(store.updateStreak('g1', 'u1', 'focus', '2026-09-20')).toEqual({ current: 1, best: 1 });
    expect(store.updateStreak('g1', 'u1', 'focus', '2026-09-20')).toEqual({ current: 1, best: 1 });
    expect(store.updateStreak('g1', 'u1', 'focus', '2026-09-21')).toEqual({ current: 2, best: 2 });
  });
});

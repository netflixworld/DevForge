import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Database } from '../src/database.js';

describe('Database', () => {
  let database: Database;

  beforeEach(() => {
    database = new Database(':memory:');
  });

  afterEach(() => {
    database.close();
  });

  it('creates safe guild defaults and updates settings', () => {
    const defaults = database.ensureGuild('guild');
    expect(defaults.star_threshold).toBe(3);
    expect(defaults.automod_enabled).toBe(1);
    database.setSetting('guild', 'star_threshold', 5);
    expect(database.getSettings('guild').star_threshold).toBe(5);
  });

  it('stores developer profiles and discovers skills', () => {
    database.upsertProfile({
      guildId: 'guild',
      userId: 'user',
      bio: 'Backend developer',
      skills: 'TypeScript, PostgreSQL',
      github: 'https://github.com/example',
      portfolio: null,
      timezone: 'UTC-3',
      availability: 'Pair programming',
    });
    expect(database.getProfile('guild', 'user')?.bio).toBe('Backend developer');
    expect(database.searchProfiles('guild', 'PostgreSQL')).toHaveLength(1);
  });

  it('applies the XP cooldown while counting every message', () => {
    const first = database.recordMessage('guild', 'user', 20);
    const second = database.recordMessage('guild', 'user', 20);
    expect(first.awarded).toBe(20);
    expect(second.awarded).toBe(0);
    expect(second.stats.messages).toBe(2);
    expect(second.stats.xp).toBe(20);
  });

  it('enforces daily reputation limits', () => {
    expect(database.giveReputation('guild', 'giver', 'one', 'Helpful review').ok).toBe(true);
    expect(database.giveReputation('guild', 'giver', 'two', 'Helpful answer').ok).toBe(true);
    expect(database.giveReputation('guild', 'giver', 'three', 'Great debugging').ok).toBe(true);
    const fourth = database.giveReputation('guild', 'giver', 'four', 'More help');
    expect(fourth.ok).toBe(false);
  });

  it('toggles unique project stars', () => {
    const project = database.createProject({
      guildId: 'guild',
      ownerId: 'owner',
      title: 'Project',
      summary: 'A meaningful open-source developer project.',
      stack: 'TypeScript',
      repoUrl: null,
      demoUrl: null,
      lookingFor: null,
    });
    expect(database.toggleProjectStar(project.id, 'fan')).toEqual({ starred: true, stars: 1 });
    expect(database.toggleProjectStar(project.id, 'fan')).toEqual({ starred: false, stars: 0 });
  });

  it('allows only one reviewer to claim a request', () => {
    const review = database.createReview({
      guildId: 'guild',
      authorId: 'author',
      title: 'Review this module',
      description: 'Please focus on security boundaries.',
      repository: 'https://github.com/example/repo',
      language: 'TypeScript',
      difficulty: 'Focused',
    });
    expect(database.claimReview(review.id, 'reviewer-one')).toBe(true);
    expect(database.claimReview(review.id, 'reviewer-two')).toBe(false);
  });

  it('protects private snippets from search', () => {
    database.saveSnippet({
      guildId: 'guild',
      ownerId: 'owner',
      name: 'private-helper',
      language: 'ts',
      description: 'A private helper',
      code: 'const ok = true;',
      tags: 'helper',
      visibility: 'private',
    });
    expect(database.searchSnippets('guild', 'helper', 'other')).toHaveLength(0);
    expect(database.searchSnippets('guild', 'helper', 'owner')).toHaveLength(1);
  });

  it('matches pair programmers by shared skills', () => {
    const first = database.upsertPairQueue({
      guild_id: 'guild',
      user_id: 'one',
      skills: 'TypeScript, Docker',
      level: 'comfortable',
      timezone: 'UTC-3',
      topic: 'Build an API',
    });
    database.upsertPairQueue({
      guild_id: 'guild',
      user_id: 'two',
      skills: 'Python',
      level: 'learning',
      timezone: 'UTC+1',
      topic: 'Data scripts',
    });
    const best = database.upsertPairQueue({
      guild_id: 'guild',
      user_id: 'three',
      skills: 'Docker, TypeScript',
      level: 'comfortable',
      timezone: 'UTC-3',
      topic: 'Build an API',
    });
    expect(database.findBestPair('guild', 'one')?.user_id).toBe('three');
    const session = database.createPairSession('guild', first, best);
    expect(session.status).toBe('active');
    expect(database.getPairQueueEntry('guild', 'one')).toBeUndefined();
  });

  it('toggles challenge votes without duplicates', () => {
    const challenge = database.saveChallenge({
      guildId: 'guild',
      key: 'test',
      title: 'Test Challenge',
      difficulty: 'Beginner',
      description: 'Build something useful.',
      requirements: 'Tests',
      bonus: 'Documentation',
    });
    const submission = database.submitChallenge({
      challengeId: challenge.id,
      guildId: 'guild',
      userId: 'builder',
      repository: 'https://github.com/example/repo',
      notes: null,
    });
    expect(database.toggleChallengeVote(submission.id, 'voter')).toEqual({ voted: true, votes: 1 });
    expect(database.toggleChallengeVote(submission.id, 'voter')).toEqual({ voted: false, votes: 0 });
  });
});

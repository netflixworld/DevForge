import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type {
  ChallengeRow,
  ChallengeSubmissionRow,
  GuildSettings,
  PairQueueRow,
  PairSessionRow,
  ProfileRow,
  ProjectRow,
  ReviewRow,
  SnippetRow,
  UserStatsRow,
} from './types.js';
import { levelFromXp, nowIso, overlapScore, shortId, todayUtc } from './utils.js';

export type SettingColumn =
  | 'welcome_channel_id'
  | 'showcase_channel_id'
  | 'review_channel_id'
  | 'pairing_channel_id'
  | 'challenge_channel_id'
  | 'github_channel_id'
  | 'starboard_channel_id'
  | 'mod_log_channel_id'
  | 'moderator_role_id'
  | 'mentor_role_id'
  | 'verified_role_id'
  | 'star_threshold'
  | 'xp_enabled'
  | 'automod_enabled'
  | 'anti_invite_enabled'
  | 'welcome_enabled';

const SETTING_COLUMNS = new Set<SettingColumn>([
  'welcome_channel_id',
  'showcase_channel_id',
  'review_channel_id',
  'pairing_channel_id',
  'challenge_channel_id',
  'github_channel_id',
  'starboard_channel_id',
  'mod_log_channel_id',
  'moderator_role_id',
  'mentor_role_id',
  'verified_role_id',
  'star_threshold',
  'xp_enabled',
  'automod_enabled',
  'anti_invite_enabled',
  'welcome_enabled',
]);

function row<T>(value: unknown): T | undefined {
  return value as T | undefined;
}

function rows<T>(value: unknown): T[] {
  return value as T[];
}

export class Database {
  private readonly sqlite: DatabaseSync;

  public constructor(path: string) {
    if (path !== ':memory:') {
      const absolute = resolve(path);
      mkdirSync(dirname(absolute), { recursive: true });
    }
    this.sqlite = new DatabaseSync(path);
    this.sqlite.exec('PRAGMA foreign_keys = ON;');
    if (path !== ':memory:') {
      this.sqlite.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
    }
    this.migrate();
  }

  public close(): void {
    this.sqlite.close();
  }

  private migrate(): void {
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS guild_settings (
        guild_id TEXT PRIMARY KEY,
        welcome_channel_id TEXT,
        showcase_channel_id TEXT,
        review_channel_id TEXT,
        pairing_channel_id TEXT,
        challenge_channel_id TEXT,
        github_channel_id TEXT,
        starboard_channel_id TEXT,
        mod_log_channel_id TEXT,
        moderator_role_id TEXT,
        mentor_role_id TEXT,
        verified_role_id TEXT,
        star_threshold INTEGER NOT NULL DEFAULT 3,
        xp_enabled INTEGER NOT NULL DEFAULT 1,
        automod_enabled INTEGER NOT NULL DEFAULT 1,
        anti_invite_enabled INTEGER NOT NULL DEFAULT 0,
        welcome_enabled INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS profiles (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        bio TEXT NOT NULL,
        skills TEXT NOT NULL,
        github TEXT,
        portfolio TEXT,
        timezone TEXT,
        availability TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (guild_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS user_stats (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        xp INTEGER NOT NULL DEFAULT 0,
        level INTEGER NOT NULL DEFAULT 0,
        reputation INTEGER NOT NULL DEFAULT 0,
        helpful INTEGER NOT NULL DEFAULT 0,
        messages INTEGER NOT NULL DEFAULT 0,
        last_xp_at TEXT,
        PRIMARY KEY (guild_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS reputation_events (
        id TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL,
        from_user_id TEXT NOT NULL,
        to_user_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_reputation_sender ON reputation_events(guild_id, from_user_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_reputation_recipient ON reputation_events(guild_id, to_user_id, created_at);

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        stack TEXT NOT NULL,
        repo_url TEXT,
        demo_url TEXT,
        looking_for TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        stars INTEGER NOT NULL DEFAULT 0,
        channel_id TEXT,
        message_id TEXT,
        created_at TEXT NOT NULL,
        closed_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_projects_guild_status ON projects(guild_id, status, created_at);

      CREATE TABLE IF NOT EXISTS project_stars (
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (project_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS project_applications (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        applicant_id TEXT NOT NULL,
        pitch TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL,
        resolved_at TEXT,
        UNIQUE (project_id, applicant_id)
      );

      CREATE TABLE IF NOT EXISTS project_members (
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        joined_at TEXT NOT NULL,
        PRIMARY KEY (project_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS reviews (
        id TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL,
        author_id TEXT NOT NULL,
        reviewer_id TEXT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        repository TEXT NOT NULL,
        language TEXT NOT NULL,
        difficulty TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        channel_id TEXT,
        message_id TEXT,
        created_at TEXT NOT NULL,
        completed_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_reviews_guild_status ON reviews(guild_id, status, created_at);

      CREATE TABLE IF NOT EXISTS snippets (
        id TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        name TEXT COLLATE NOCASE NOT NULL,
        language TEXT NOT NULL,
        description TEXT NOT NULL,
        code TEXT NOT NULL,
        tags TEXT NOT NULL,
        visibility TEXT NOT NULL DEFAULT 'public',
        uses INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (guild_id, owner_id, name)
      );
      CREATE INDEX IF NOT EXISTS idx_snippets_search ON snippets(guild_id, visibility, name);

      CREATE TABLE IF NOT EXISTS pair_queue (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        skills TEXT NOT NULL,
        level TEXT NOT NULL,
        timezone TEXT NOT NULL,
        topic TEXT NOT NULL,
        joined_at TEXT NOT NULL,
        PRIMARY KEY (guild_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS pair_sessions (
        id TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL,
        user_one_id TEXT NOT NULL,
        user_two_id TEXT NOT NULL,
        topic TEXT NOT NULL,
        thread_id TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        started_at TEXT NOT NULL,
        ended_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_pair_sessions_users ON pair_sessions(guild_id, status, user_one_id, user_two_id);

      CREATE TABLE IF NOT EXISTS challenges (
        id TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL,
        challenge_date TEXT NOT NULL,
        challenge_key TEXT NOT NULL,
        title TEXT NOT NULL,
        difficulty TEXT NOT NULL,
        description TEXT NOT NULL,
        requirements TEXT NOT NULL,
        bonus TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (guild_id, challenge_date)
      );

      CREATE TABLE IF NOT EXISTS challenge_submissions (
        id TEXT PRIMARY KEY,
        challenge_id TEXT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        repository TEXT NOT NULL,
        notes TEXT,
        votes INTEGER NOT NULL DEFAULT 0,
        message_id TEXT,
        created_at TEXT NOT NULL,
        UNIQUE (challenge_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS challenge_votes (
        submission_id TEXT NOT NULL REFERENCES challenge_submissions(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (submission_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS moderation_cases (
        id TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL,
        case_number INTEGER NOT NULL,
        target_id TEXT NOT NULL,
        moderator_id TEXT NOT NULL,
        action TEXT NOT NULL,
        reason TEXT NOT NULL,
        duration_ms INTEGER,
        created_at TEXT NOT NULL,
        UNIQUE (guild_id, case_number)
      );
      CREATE INDEX IF NOT EXISTS idx_cases_target ON moderation_cases(guild_id, target_id, created_at);

      CREATE TABLE IF NOT EXISTS daily_stats (
        guild_id TEXT NOT NULL,
        stat_date TEXT NOT NULL,
        messages INTEGER NOT NULL DEFAULT 0,
        joins INTEGER NOT NULL DEFAULT 0,
        leaves INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (guild_id, stat_date)
      );

      CREATE TABLE IF NOT EXISTS starboard_entries (
        guild_id TEXT NOT NULL,
        source_message_id TEXT NOT NULL,
        source_channel_id TEXT NOT NULL,
        starboard_message_id TEXT NOT NULL,
        author_id TEXT NOT NULL,
        stars INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (guild_id, source_message_id)
      );

      CREATE TABLE IF NOT EXISTS achievements (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        code TEXT NOT NULL,
        awarded_at TEXT NOT NULL,
        PRIMARY KEY (guild_id, user_id, code)
      );
    `);
  }

  private transaction<T>(operation: () => T): T {
    this.sqlite.exec('BEGIN IMMEDIATE;');
    try {
      const result = operation();
      this.sqlite.exec('COMMIT;');
      return result;
    } catch (error) {
      this.sqlite.exec('ROLLBACK;');
      throw error;
    }
  }

  public ensureGuild(guildId: string): GuildSettings {
    this.sqlite
      .prepare('INSERT OR IGNORE INTO guild_settings (guild_id, updated_at) VALUES (?, ?)')
      .run(guildId, nowIso());
    return this.getSettings(guildId);
  }

  public getSettings(guildId: string): GuildSettings {
    const current = row<GuildSettings>(
      this.sqlite.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId),
    );
    if (current) return current;
    this.sqlite
      .prepare('INSERT INTO guild_settings (guild_id, updated_at) VALUES (?, ?)')
      .run(guildId, nowIso());
    const created = row<GuildSettings>(
      this.sqlite.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId),
    );
    if (!created) throw new Error('Could not initialize guild settings.');
    return created;
  }

  public setSetting(guildId: string, column: SettingColumn, value: string | number | null): void {
    if (!SETTING_COLUMNS.has(column)) throw new Error(`Unsupported setting: ${column}`);
    this.ensureGuild(guildId);
    this.sqlite
      .prepare(`UPDATE guild_settings SET ${column} = ?, updated_at = ? WHERE guild_id = ?`)
      .run(value, nowIso(), guildId);
  }

  public getGithubDestinations(): Array<{ guild_id: string; github_channel_id: string }> {
    return rows(
      this.sqlite
        .prepare(
          'SELECT guild_id, github_channel_id FROM guild_settings WHERE github_channel_id IS NOT NULL',
        )
        .all(),
    );
  }

  public upsertProfile(input: {
    guildId: string;
    userId: string;
    bio: string;
    skills: string;
    github: string | null;
    portfolio: string | null;
    timezone: string | null;
    availability: string | null;
  }): ProfileRow {
    const timestamp = nowIso();
    this.sqlite
      .prepare(`
        INSERT INTO profiles (
          guild_id, user_id, bio, skills, github, portfolio, timezone, availability, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(guild_id, user_id) DO UPDATE SET
          bio = excluded.bio,
          skills = excluded.skills,
          github = excluded.github,
          portfolio = excluded.portfolio,
          timezone = excluded.timezone,
          availability = excluded.availability,
          updated_at = excluded.updated_at
      `)
      .run(
        input.guildId,
        input.userId,
        input.bio,
        input.skills,
        input.github,
        input.portfolio,
        input.timezone,
        input.availability,
        timestamp,
        timestamp,
      );
    return this.getProfile(input.guildId, input.userId)!;
  }

  public getProfile(guildId: string, userId: string): ProfileRow | undefined {
    return row(
      this.sqlite.prepare('SELECT * FROM profiles WHERE guild_id = ? AND user_id = ?').get(guildId, userId),
    );
  }

  public deleteProfile(guildId: string, userId: string): boolean {
    return (
      this.sqlite.prepare('DELETE FROM profiles WHERE guild_id = ? AND user_id = ?').run(guildId, userId)
        .changes > 0
    );
  }

  public searchProfiles(guildId: string, skill: string, limit = 10): ProfileRow[] {
    return rows(
      this.sqlite
        .prepare(
          'SELECT * FROM profiles WHERE guild_id = ? AND skills LIKE ? ORDER BY updated_at DESC LIMIT ?',
        )
        .all(guildId, `%${skill}%`, limit),
    );
  }

  public findProfilesByGithub(guildId: string, username: string): ProfileRow[] {
    const normalized = `https://github.com/${username.toLowerCase()}`;
    return rows(
      this.sqlite
        .prepare('SELECT * FROM profiles WHERE guild_id = ? AND LOWER(RTRIM(github, \'/\')) = ? LIMIT 10')
        .all(guildId, normalized),
    );
  }

  private ensureStats(guildId: string, userId: string): void {
    this.sqlite
      .prepare('INSERT OR IGNORE INTO user_stats (guild_id, user_id) VALUES (?, ?)')
      .run(guildId, userId);
  }

  public getStats(guildId: string, userId: string): UserStatsRow {
    this.ensureStats(guildId, userId);
    const result = row<UserStatsRow>(
      this.sqlite.prepare('SELECT * FROM user_stats WHERE guild_id = ? AND user_id = ?').get(guildId, userId),
    );
    if (!result) throw new Error('Could not initialize user statistics.');
    return result;
  }

  public recordMessage(
    guildId: string,
    userId: string,
    xpAmount: number,
    cooldownMs = 60_000,
  ): { awarded: number; previousLevel: number; newLevel: number; stats: UserStatsRow } {
    const previous = this.getStats(guildId, userId);
    const elapsed = previous.last_xp_at ? Date.now() - new Date(previous.last_xp_at).getTime() : Infinity;
    const awarded = elapsed >= cooldownMs ? Math.max(0, xpAmount) : 0;
    const xp = previous.xp + awarded;
    const nextLevel = levelFromXp(xp);
    this.sqlite
      .prepare(`
        UPDATE user_stats
        SET xp = ?, level = ?, messages = messages + 1, last_xp_at = COALESCE(?, last_xp_at)
        WHERE guild_id = ? AND user_id = ?
      `)
      .run(xp, nextLevel, awarded > 0 ? nowIso() : null, guildId, userId);
    this.incrementDaily(guildId, 'messages');
    return { awarded, previousLevel: previous.level, newLevel: nextLevel, stats: this.getStats(guildId, userId) };
  }

  public giveReputation(
    guildId: string,
    fromUserId: string,
    toUserId: string,
    reason: string,
  ): { ok: true; stats: UserStatsRow } | { ok: false; reason: string } {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const pairCutoff = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const daily = row<{ total: number }>(
      this.sqlite
        .prepare(
          'SELECT COUNT(*) AS total FROM reputation_events WHERE guild_id = ? AND from_user_id = ? AND created_at >= ?',
        )
        .get(guildId, fromUserId, cutoff),
    )?.total ?? 0;
    if (daily >= 3) return { ok: false, reason: 'You have used all 3 reputation points available today.' };

    const recentPair = row<{ total: number }>(
      this.sqlite
        .prepare(`
          SELECT COUNT(*) AS total FROM reputation_events
          WHERE guild_id = ? AND from_user_id = ? AND to_user_id = ? AND created_at >= ?
        `)
        .get(guildId, fromUserId, toUserId, pairCutoff),
    )?.total ?? 0;
    if (recentPair > 0) {
      return { ok: false, reason: 'You can give reputation to the same member once every 12 hours.' };
    }

    this.transaction(() => {
      this.ensureStats(guildId, toUserId);
      this.sqlite
        .prepare(`
          INSERT INTO reputation_events (id, guild_id, from_user_id, to_user_id, reason, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `)
        .run(shortId('rep'), guildId, fromUserId, toUserId, reason, nowIso());
      this.sqlite
        .prepare(
          'UPDATE user_stats SET reputation = reputation + 1, helpful = helpful + 1 WHERE guild_id = ? AND user_id = ?',
        )
        .run(guildId, toUserId);
    });
    return { ok: true, stats: this.getStats(guildId, toUserId) };
  }

  public leaderboard(
    guildId: string,
    type: 'xp' | 'reputation' | 'helpful',
    limit = 10,
  ): UserStatsRow[] {
    const columns = { xp: 'xp', reputation: 'reputation', helpful: 'helpful' } as const;
    return rows(
      this.sqlite
        .prepare(`SELECT * FROM user_stats WHERE guild_id = ? ORDER BY ${columns[type]} DESC LIMIT ?`)
        .all(guildId, limit),
    );
  }

  public awardSystemReputation(guildId: string, userId: string, amount = 1): UserStatsRow {
    this.ensureStats(guildId, userId);
    const safeAmount = Math.min(10, Math.max(0, Math.floor(amount)));
    this.sqlite
      .prepare('UPDATE user_stats SET reputation = reputation + ?, helpful = helpful + 1 WHERE guild_id = ? AND user_id = ?')
      .run(safeAmount, guildId, userId);
    return this.getStats(guildId, userId);
  }

  public createProject(input: {
    guildId: string;
    ownerId: string;
    title: string;
    summary: string;
    stack: string;
    repoUrl: string | null;
    demoUrl: string | null;
    lookingFor: string | null;
  }): ProjectRow {
    const id = shortId('prj');
    this.sqlite
      .prepare(`
        INSERT INTO projects (
          id, guild_id, owner_id, title, summary, stack, repo_url, demo_url, looking_for, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        input.guildId,
        input.ownerId,
        input.title,
        input.summary,
        input.stack,
        input.repoUrl,
        input.demoUrl,
        input.lookingFor,
        nowIso(),
      );
    return this.getProject(id)!;
  }

  public getProject(id: string): ProjectRow | undefined {
    return row(this.sqlite.prepare('SELECT * FROM projects WHERE id = ?').get(id));
  }

  public listProjects(guildId: string, stack?: string, ownerId?: string, limit = 10): ProjectRow[] {
    if (ownerId) {
      return rows(
        this.sqlite
          .prepare('SELECT * FROM projects WHERE guild_id = ? AND owner_id = ? ORDER BY created_at DESC LIMIT ?')
          .all(guildId, ownerId, limit),
      );
    }
    if (stack) {
      return rows(
        this.sqlite
          .prepare(`
            SELECT * FROM projects WHERE guild_id = ? AND status = 'open' AND stack LIKE ?
            ORDER BY stars DESC, created_at DESC LIMIT ?
          `)
          .all(guildId, `%${stack}%`, limit),
      );
    }
    return rows(
      this.sqlite
        .prepare(`
          SELECT * FROM projects WHERE guild_id = ? AND status = 'open'
          ORDER BY stars DESC, created_at DESC LIMIT ?
        `)
        .all(guildId, limit),
    );
  }

  public setProjectMessage(id: string, channelId: string, messageId: string): void {
    this.sqlite
      .prepare('UPDATE projects SET channel_id = ?, message_id = ? WHERE id = ?')
      .run(channelId, messageId, id);
  }

  public closeProject(id: string): void {
    this.sqlite
      .prepare("UPDATE projects SET status = 'closed', closed_at = ? WHERE id = ?")
      .run(nowIso(), id);
  }

  public toggleProjectStar(id: string, userId: string): { starred: boolean; stars: number } {
    return this.transaction(() => {
      const exists = row<{ total: number }>(
        this.sqlite
          .prepare('SELECT COUNT(*) AS total FROM project_stars WHERE project_id = ? AND user_id = ?')
          .get(id, userId),
      )?.total ?? 0;
      if (exists) {
        this.sqlite.prepare('DELETE FROM project_stars WHERE project_id = ? AND user_id = ?').run(id, userId);
      } else {
        this.sqlite
          .prepare('INSERT INTO project_stars (project_id, user_id, created_at) VALUES (?, ?, ?)')
          .run(id, userId, nowIso());
      }
      const stars = row<{ total: number }>(
        this.sqlite.prepare('SELECT COUNT(*) AS total FROM project_stars WHERE project_id = ?').get(id),
      )?.total ?? 0;
      this.sqlite.prepare('UPDATE projects SET stars = ? WHERE id = ?').run(stars, id);
      return { starred: !exists, stars };
    });
  }

  public createProjectApplication(projectId: string, applicantId: string, pitch: string): string {
    const existing = row<{ id: string }>(
      this.sqlite
        .prepare('SELECT id FROM project_applications WHERE project_id = ? AND applicant_id = ?')
        .get(projectId, applicantId),
    );
    const id = existing?.id ?? shortId('app');
    this.sqlite
      .prepare(`
        INSERT INTO project_applications (id, project_id, applicant_id, pitch, status, created_at)
        VALUES (?, ?, ?, ?, 'pending', ?)
        ON CONFLICT(project_id, applicant_id) DO UPDATE SET
          pitch = excluded.pitch, status = 'pending', created_at = excluded.created_at, resolved_at = NULL
      `)
      .run(id, projectId, applicantId, pitch, nowIso());
    return id;
  }

  public getProjectApplication(id: string):
    | { id: string; project_id: string; applicant_id: string; pitch: string; status: string }
    | undefined {
    return row(this.sqlite.prepare('SELECT * FROM project_applications WHERE id = ?').get(id));
  }

  public resolveProjectApplication(id: string, status: 'accepted' | 'declined'): void {
    this.transaction(() => {
      const application = this.getProjectApplication(id);
      if (!application) throw new Error('Application not found.');
      this.sqlite
        .prepare('UPDATE project_applications SET status = ?, resolved_at = ? WHERE id = ?')
        .run(status, nowIso(), id);
      if (status === 'accepted') {
        this.sqlite
          .prepare('INSERT OR IGNORE INTO project_members (project_id, user_id, joined_at) VALUES (?, ?, ?)')
          .run(application.project_id, application.applicant_id, nowIso());
      }
    });
  }

  public createReview(input: {
    guildId: string;
    authorId: string;
    title: string;
    description: string;
    repository: string;
    language: string;
    difficulty: string;
  }): ReviewRow {
    const id = shortId('rev');
    this.sqlite
      .prepare(`
        INSERT INTO reviews (
          id, guild_id, author_id, title, description, repository, language, difficulty, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id,
        input.guildId,
        input.authorId,
        input.title,
        input.description,
        input.repository,
        input.language,
        input.difficulty,
        nowIso(),
      );
    return this.getReview(id)!;
  }

  public getReview(id: string): ReviewRow | undefined {
    return row(this.sqlite.prepare('SELECT * FROM reviews WHERE id = ?').get(id));
  }

  public listReviews(guildId: string, userId?: string, limit = 10): ReviewRow[] {
    if (userId) {
      return rows(
        this.sqlite
          .prepare(`
            SELECT * FROM reviews WHERE guild_id = ? AND (author_id = ? OR reviewer_id = ?)
            ORDER BY created_at DESC LIMIT ?
          `)
          .all(guildId, userId, userId, limit),
      );
    }
    return rows(
      this.sqlite
        .prepare("SELECT * FROM reviews WHERE guild_id = ? AND status IN ('open', 'claimed') ORDER BY created_at ASC LIMIT ?")
        .all(guildId, limit),
    );
  }

  public setReviewMessage(id: string, channelId: string, messageId: string): void {
    this.sqlite
      .prepare('UPDATE reviews SET channel_id = ?, message_id = ? WHERE id = ?')
      .run(channelId, messageId, id);
  }

  public claimReview(id: string, reviewerId: string): boolean {
    return (
      this.sqlite
        .prepare("UPDATE reviews SET reviewer_id = ?, status = 'claimed' WHERE id = ? AND status = 'open'")
        .run(reviewerId, id).changes > 0
    );
  }

  public completeReview(id: string): ReviewRow | undefined {
    this.sqlite
      .prepare("UPDATE reviews SET status = 'completed', completed_at = ? WHERE id = ? AND status = 'claimed'")
      .run(nowIso(), id);
    return this.getReview(id);
  }

  public saveSnippet(input: {
    guildId: string;
    ownerId: string;
    name: string;
    language: string;
    description: string;
    code: string;
    tags: string;
    visibility: 'public' | 'private';
  }): SnippetRow {
    const existing = row<{ id: string; created_at: string }>(
      this.sqlite
        .prepare('SELECT id, created_at FROM snippets WHERE guild_id = ? AND owner_id = ? AND name = ?')
        .get(input.guildId, input.ownerId, input.name),
    );
    const id = existing?.id ?? shortId('snp');
    const timestamp = nowIso();
    this.sqlite
      .prepare(`
        INSERT INTO snippets (
          id, guild_id, owner_id, name, language, description, code, tags, visibility, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(guild_id, owner_id, name) DO UPDATE SET
          language = excluded.language,
          description = excluded.description,
          code = excluded.code,
          tags = excluded.tags,
          visibility = excluded.visibility,
          updated_at = excluded.updated_at
      `)
      .run(
        id,
        input.guildId,
        input.ownerId,
        input.name,
        input.language,
        input.description,
        input.code,
        input.tags,
        input.visibility,
        existing?.created_at ?? timestamp,
        timestamp,
      );
    return this.getSnippetById(id)!;
  }

  public getSnippetById(id: string): SnippetRow | undefined {
    return row(this.sqlite.prepare('SELECT * FROM snippets WHERE id = ?').get(id));
  }

  public getSnippet(guildId: string, name: string, requesterId: string, ownerId?: string): SnippetRow | undefined {
    if (ownerId) {
      return row(
        this.sqlite
          .prepare(`
            SELECT * FROM snippets
            WHERE guild_id = ? AND name = ? AND owner_id = ? AND (visibility = 'public' OR owner_id = ?)
          `)
          .get(guildId, name, ownerId, requesterId),
      );
    }
    return row(
      this.sqlite
        .prepare(`
          SELECT * FROM snippets
          WHERE guild_id = ? AND name = ? AND (visibility = 'public' OR owner_id = ?)
          ORDER BY CASE WHEN owner_id = ? THEN 0 ELSE 1 END, uses DESC LIMIT 1
        `)
        .get(guildId, name, requesterId, requesterId),
    );
  }

  public searchSnippets(guildId: string, query: string, requesterId: string, limit = 10): SnippetRow[] {
    return rows(
      this.sqlite
        .prepare(`
          SELECT * FROM snippets
          WHERE guild_id = ? AND (visibility = 'public' OR owner_id = ?)
            AND (name LIKE ? OR description LIKE ? OR tags LIKE ? OR language LIKE ?)
          ORDER BY uses DESC, updated_at DESC LIMIT ?
        `)
        .all(guildId, requesterId, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, limit),
    );
  }

  public autocompleteSnippets(guildId: string, query: string, requesterId: string): SnippetRow[] {
    return rows(
      this.sqlite
        .prepare(`
          SELECT * FROM snippets
          WHERE guild_id = ? AND (visibility = 'public' OR owner_id = ?) AND name LIKE ?
          ORDER BY uses DESC LIMIT 25
        `)
        .all(guildId, requesterId, `%${query}%`),
    );
  }

  public incrementSnippetUses(id: string): void {
    this.sqlite.prepare('UPDATE snippets SET uses = uses + 1 WHERE id = ?').run(id);
  }

  public deleteSnippet(id: string, ownerId: string): boolean {
    return this.sqlite.prepare('DELETE FROM snippets WHERE id = ? AND owner_id = ?').run(id, ownerId).changes > 0;
  }

  public upsertPairQueue(input: Omit<PairQueueRow, 'joined_at'>): PairQueueRow {
    this.sqlite
      .prepare(`
        INSERT INTO pair_queue (guild_id, user_id, skills, level, timezone, topic, joined_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(guild_id, user_id) DO UPDATE SET
          skills = excluded.skills, level = excluded.level, timezone = excluded.timezone,
          topic = excluded.topic, joined_at = excluded.joined_at
      `)
      .run(
        input.guild_id,
        input.user_id,
        input.skills,
        input.level,
        input.timezone,
        input.topic,
        nowIso(),
      );
    return this.getPairQueueEntry(input.guild_id, input.user_id)!;
  }

  public getPairQueueEntry(guildId: string, userId: string): PairQueueRow | undefined {
    return row(
      this.sqlite.prepare('SELECT * FROM pair_queue WHERE guild_id = ? AND user_id = ?').get(guildId, userId),
    );
  }

  public removePairQueue(guildId: string, userId: string): boolean {
    return this.sqlite.prepare('DELETE FROM pair_queue WHERE guild_id = ? AND user_id = ?').run(guildId, userId)
      .changes > 0;
  }

  public findBestPair(guildId: string, userId: string): PairQueueRow | undefined {
    const source = this.getPairQueueEntry(guildId, userId);
    if (!source) return undefined;
    const candidates = rows<PairQueueRow>(
      this.sqlite
        .prepare('SELECT * FROM pair_queue WHERE guild_id = ? AND user_id != ? ORDER BY joined_at ASC LIMIT 50')
        .all(guildId, userId),
    );
    return candidates
      .map((candidate) => ({
        candidate,
        score:
          overlapScore(source.skills, candidate.skills) * 4 +
          (source.level === candidate.level ? 2 : 0) +
          (source.timezone.toLowerCase() === candidate.timezone.toLowerCase() ? 1 : 0),
      }))
      .sort((a, b) => b.score - a.score)[0]?.candidate;
  }

  public createPairSession(guildId: string, first: PairQueueRow, second: PairQueueRow): PairSessionRow {
    return this.transaction(() => {
      const id = shortId('pair');
      const topic = first.topic === second.topic ? first.topic : `${first.topic} / ${second.topic}`;
      this.sqlite
        .prepare(`
          INSERT INTO pair_sessions (id, guild_id, user_one_id, user_two_id, topic, started_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `)
        .run(id, guildId, first.user_id, second.user_id, topic, nowIso());
      this.sqlite
        .prepare('DELETE FROM pair_queue WHERE guild_id = ? AND user_id IN (?, ?)')
        .run(guildId, first.user_id, second.user_id);
      return this.getPairSession(id)!;
    });
  }

  public getPairSession(id: string): PairSessionRow | undefined {
    return row(this.sqlite.prepare('SELECT * FROM pair_sessions WHERE id = ?').get(id));
  }

  public getActivePairSession(guildId: string, userId: string): PairSessionRow | undefined {
    return row(
      this.sqlite
        .prepare(`
          SELECT * FROM pair_sessions
          WHERE guild_id = ? AND status = 'active' AND (user_one_id = ? OR user_two_id = ?)
          ORDER BY started_at DESC LIMIT 1
        `)
        .get(guildId, userId, userId),
    );
  }

  public setPairThread(id: string, threadId: string): void {
    this.sqlite.prepare('UPDATE pair_sessions SET thread_id = ? WHERE id = ?').run(threadId, id);
  }

  public completePairSession(id: string): PairSessionRow | undefined {
    this.sqlite
      .prepare("UPDATE pair_sessions SET status = 'completed', ended_at = ? WHERE id = ? AND status = 'active'")
      .run(nowIso(), id);
    return this.getPairSession(id);
  }

  public saveChallenge(input: {
    guildId: string;
    date?: string;
    key: string;
    title: string;
    difficulty: string;
    description: string;
    requirements: string;
    bonus: string;
  }): ChallengeRow {
    const date = input.date ?? todayUtc();
    const existing = row<{ id: string }>(
      this.sqlite.prepare('SELECT id FROM challenges WHERE guild_id = ? AND challenge_date = ?').get(input.guildId, date),
    );
    const id = existing?.id ?? shortId('chl');
    this.sqlite
      .prepare(`
        INSERT INTO challenges (
          id, guild_id, challenge_date, challenge_key, title, difficulty,
          description, requirements, bonus, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(guild_id, challenge_date) DO UPDATE SET
          challenge_key = excluded.challenge_key,
          title = excluded.title,
          difficulty = excluded.difficulty,
          description = excluded.description,
          requirements = excluded.requirements,
          bonus = excluded.bonus
      `)
      .run(
        id,
        input.guildId,
        date,
        input.key,
        input.title,
        input.difficulty,
        input.description,
        input.requirements,
        input.bonus,
        nowIso(),
      );
    return this.getChallenge(input.guildId, date)!;
  }

  public getChallenge(guildId: string, date = todayUtc()): ChallengeRow | undefined {
    return row(
      this.sqlite.prepare('SELECT * FROM challenges WHERE guild_id = ? AND challenge_date = ?').get(guildId, date),
    );
  }

  public getChallengeById(id: string): ChallengeRow | undefined {
    return row(this.sqlite.prepare('SELECT * FROM challenges WHERE id = ?').get(id));
  }

  public submitChallenge(input: {
    challengeId: string;
    guildId: string;
    userId: string;
    repository: string;
    notes: string | null;
  }): ChallengeSubmissionRow {
    const existing = row<{ id: string }>(
      this.sqlite
        .prepare('SELECT id FROM challenge_submissions WHERE challenge_id = ? AND user_id = ?')
        .get(input.challengeId, input.userId),
    );
    const id = existing?.id ?? shortId('sub');
    this.sqlite
      .prepare(`
        INSERT INTO challenge_submissions (
          id, challenge_id, guild_id, user_id, repository, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(challenge_id, user_id) DO UPDATE SET
          repository = excluded.repository, notes = excluded.notes, created_at = excluded.created_at
      `)
      .run(id, input.challengeId, input.guildId, input.userId, input.repository, input.notes, nowIso());
    return this.getChallengeSubmission(id)!;
  }

  public getChallengeSubmission(id: string): ChallengeSubmissionRow | undefined {
    return row(this.sqlite.prepare('SELECT * FROM challenge_submissions WHERE id = ?').get(id));
  }

  public setChallengeSubmissionMessage(id: string, messageId: string): void {
    this.sqlite.prepare('UPDATE challenge_submissions SET message_id = ? WHERE id = ?').run(messageId, id);
  }

  public toggleChallengeVote(id: string, userId: string): { voted: boolean; votes: number } {
    return this.transaction(() => {
      const exists = row<{ total: number }>(
        this.sqlite
          .prepare('SELECT COUNT(*) AS total FROM challenge_votes WHERE submission_id = ? AND user_id = ?')
          .get(id, userId),
      )?.total ?? 0;
      if (exists) {
        this.sqlite.prepare('DELETE FROM challenge_votes WHERE submission_id = ? AND user_id = ?').run(id, userId);
      } else {
        this.sqlite
          .prepare('INSERT INTO challenge_votes (submission_id, user_id, created_at) VALUES (?, ?, ?)')
          .run(id, userId, nowIso());
      }
      const votes = row<{ total: number }>(
        this.sqlite.prepare('SELECT COUNT(*) AS total FROM challenge_votes WHERE submission_id = ?').get(id),
      )?.total ?? 0;
      this.sqlite.prepare('UPDATE challenge_submissions SET votes = ? WHERE id = ?').run(votes, id);
      return { voted: !exists, votes };
    });
  }

  public challengeLeaderboard(guildId: string, limit = 10): Array<{ user_id: string; votes: number; entries: number }> {
    return rows(
      this.sqlite
        .prepare(`
          SELECT user_id, SUM(votes) AS votes, COUNT(*) AS entries
          FROM challenge_submissions WHERE guild_id = ?
          GROUP BY user_id ORDER BY votes DESC, entries DESC LIMIT ?
        `)
        .all(guildId, limit),
    );
  }

  public createModerationCase(input: {
    guildId: string;
    targetId: string;
    moderatorId: string;
    action: string;
    reason: string;
    durationMs?: number;
  }): { id: string; caseNumber: number } {
    return this.transaction(() => {
      const maximum = row<{ maximum: number | null }>(
        this.sqlite
          .prepare('SELECT MAX(case_number) AS maximum FROM moderation_cases WHERE guild_id = ?')
          .get(input.guildId),
      )?.maximum;
      const caseNumber = (maximum ?? 0) + 1;
      const id = shortId('case');
      this.sqlite
        .prepare(`
          INSERT INTO moderation_cases (
            id, guild_id, case_number, target_id, moderator_id, action, reason, duration_ms, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          id,
          input.guildId,
          caseNumber,
          input.targetId,
          input.moderatorId,
          input.action,
          input.reason,
          input.durationMs ?? null,
          nowIso(),
        );
      return { id, caseNumber };
    });
  }

  public getModerationCases(guildId: string, targetId: string, limit = 10): Array<Record<string, unknown>> {
    return rows(
      this.sqlite
        .prepare(`
          SELECT * FROM moderation_cases WHERE guild_id = ? AND target_id = ?
          ORDER BY case_number DESC LIMIT ?
        `)
        .all(guildId, targetId, limit),
    );
  }

  public incrementDaily(guildId: string, field: 'messages' | 'joins' | 'leaves'): void {
    const date = todayUtc();
    this.sqlite
      .prepare(`
        INSERT INTO daily_stats (guild_id, stat_date, ${field}) VALUES (?, ?, 1)
        ON CONFLICT(guild_id, stat_date) DO UPDATE SET ${field} = ${field} + 1
      `)
      .run(guildId, date);
  }

  public getInsights(guildId: string): {
    messages7d: number;
    joins7d: number;
    projects: number;
    openReviews: number;
    snippets: number;
    pairSessions: number;
  } {
    const cutoff = new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10);
    const activity = row<{ messages: number | null; joins: number | null }>(
      this.sqlite
        .prepare(`
          SELECT SUM(messages) AS messages, SUM(joins) AS joins
          FROM daily_stats WHERE guild_id = ? AND stat_date >= ?
        `)
        .get(guildId, cutoff),
    );
    const scalar = (sql: string): number =>
      row<{ total: number }>(this.sqlite.prepare(sql).get(guildId))?.total ?? 0;
    return {
      messages7d: activity?.messages ?? 0,
      joins7d: activity?.joins ?? 0,
      projects: scalar('SELECT COUNT(*) AS total FROM projects WHERE guild_id = ?'),
      openReviews: scalar("SELECT COUNT(*) AS total FROM reviews WHERE guild_id = ? AND status IN ('open', 'claimed')"),
      snippets: scalar("SELECT COUNT(*) AS total FROM snippets WHERE guild_id = ? AND visibility = 'public'"),
      pairSessions: scalar('SELECT COUNT(*) AS total FROM pair_sessions WHERE guild_id = ?'),
    };
  }

  public getStarboardEntry(
    guildId: string,
    sourceMessageId: string,
  ): { starboard_message_id: string; stars: number } | undefined {
    return row(
      this.sqlite
        .prepare('SELECT * FROM starboard_entries WHERE guild_id = ? AND source_message_id = ?')
        .get(guildId, sourceMessageId),
    );
  }

  public upsertStarboardEntry(input: {
    guildId: string;
    sourceMessageId: string;
    sourceChannelId: string;
    starboardMessageId: string;
    authorId: string;
    stars: number;
  }): void {
    this.sqlite
      .prepare(`
        INSERT INTO starboard_entries (
          guild_id, source_message_id, source_channel_id, starboard_message_id, author_id, stars, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(guild_id, source_message_id) DO UPDATE SET
          starboard_message_id = excluded.starboard_message_id, stars = excluded.stars
      `)
      .run(
        input.guildId,
        input.sourceMessageId,
        input.sourceChannelId,
        input.starboardMessageId,
        input.authorId,
        input.stars,
        nowIso(),
      );
  }

  public deleteStarboardEntry(guildId: string, sourceMessageId: string): void {
    this.sqlite
      .prepare('DELETE FROM starboard_entries WHERE guild_id = ? AND source_message_id = ?')
      .run(guildId, sourceMessageId);
  }

  public awardAchievement(guildId: string, userId: string, code: string): boolean {
    return (
      this.sqlite
        .prepare('INSERT OR IGNORE INTO achievements (guild_id, user_id, code, awarded_at) VALUES (?, ?, ?, ?)')
        .run(guildId, userId, code, nowIso()).changes > 0
    );
  }

  public getAchievements(guildId: string, userId: string): Array<{ code: string; awarded_at: string }> {
    return rows(
      this.sqlite
        .prepare('SELECT code, awarded_at FROM achievements WHERE guild_id = ? AND user_id = ? ORDER BY awarded_at')
        .all(guildId, userId),
    );
  }

  public countOwnedProjects(guildId: string, userId: string): number {
    return (
      row<{ total: number }>(
        this.sqlite.prepare('SELECT COUNT(*) AS total FROM projects WHERE guild_id = ? AND owner_id = ?').get(guildId, userId),
      )?.total ?? 0
    );
  }

  public countCompletedReviews(guildId: string, userId: string): number {
    return (
      row<{ total: number }>(
        this.sqlite
          .prepare("SELECT COUNT(*) AS total FROM reviews WHERE guild_id = ? AND reviewer_id = ? AND status = 'completed'")
          .get(guildId, userId),
      )?.total ?? 0
    );
  }
}

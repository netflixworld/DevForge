import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { nowIso, shortId, todayUtc } from '../utils.js';

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

interface RawItemRow {
  id: string;
  guild_id: string;
  type: string;
  owner_id: string;
  title: string;
  status: string;
  data: string;
  due_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeatureItem<T extends JsonObject = JsonObject>
  extends Omit<RawItemRow, 'data'> {
  data: T;
}

export interface FeatureMember {
  item_id: string;
  user_id: string;
  role: string;
  status: string;
  data: JsonObject;
  created_at: string;
  updated_at: string;
}

export interface AuditEntry {
  id: string;
  guild_id: string;
  actor_id: string;
  action: string;
  target: string | null;
  details: string;
  created_at: string;
}

function row<T>(value: unknown): T | undefined {
  return value as T | undefined;
}

function rows<T>(value: unknown): T[] {
  return value as T[];
}

function parseObject(value: string): JsonObject {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as JsonObject) : {};
  } catch {
    return {};
  }
}

function decodeItem<T extends JsonObject = JsonObject>(item: RawItemRow | undefined): FeatureItem<T> | undefined {
  if (!item) return undefined;
  return { ...item, data: parseObject(item.data) as T };
}

function decodeMember(item: Omit<FeatureMember, 'data'> & { data: string }): FeatureMember {
  return { ...item, data: parseObject(item.data) };
}

export class FeatureStore {
  private readonly sqlite: DatabaseSync;

  public constructor(path: string) {
    if (path !== ':memory:') {
      const absolute = resolve(path);
      mkdirSync(dirname(absolute), { recursive: true });
    }
    this.sqlite = new DatabaseSync(path);
    this.sqlite.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    if (path !== ':memory:') this.sqlite.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
    this.migrate();
  }

  public close(): void {
    this.sqlite.close();
  }

  private migrate(): void {
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS v2_items (
        id TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL,
        type TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        data TEXT NOT NULL DEFAULT '{}',
        due_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_v2_items_lookup
        ON v2_items(guild_id, type, status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_v2_items_due
        ON v2_items(type, status, due_at);

      CREATE TABLE IF NOT EXISTS v2_members (
        item_id TEXT NOT NULL REFERENCES v2_items(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        status TEXT NOT NULL DEFAULT 'active',
        data TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (item_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS v2_votes (
        item_id TEXT NOT NULL REFERENCES v2_items(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        value TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (item_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS v2_settings (
        guild_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (guild_id, key)
      );

      CREATE TABLE IF NOT EXISTS v2_modules (
        guild_id TEXT NOT NULL,
        module TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (guild_id, module)
      );

      CREATE TABLE IF NOT EXISTS v2_audit (
        id TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        action TEXT NOT NULL,
        target TEXT,
        details TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_v2_audit_guild ON v2_audit(guild_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS v2_command_usage (
        guild_id TEXT NOT NULL,
        command TEXT NOT NULL,
        uses INTEGER NOT NULL DEFAULT 0,
        last_used_at TEXT NOT NULL,
        PRIMARY KEY (guild_id, command)
      );

      CREATE TABLE IF NOT EXISTS v2_channel_activity (
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        activity_date TEXT NOT NULL,
        hour INTEGER NOT NULL,
        messages INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (guild_id, channel_id, activity_date, hour)
      );

      CREATE TABLE IF NOT EXISTS v2_user_activity (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        activity_date TEXT NOT NULL,
        messages INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (guild_id, user_id, activity_date)
      );

      CREATE TABLE IF NOT EXISTS v2_skill_xp (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        area TEXT NOT NULL,
        xp INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (guild_id, user_id, area)
      );

      CREATE TABLE IF NOT EXISTS v2_wallets (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        credits INTEGER NOT NULL DEFAULT 0,
        earned INTEGER NOT NULL DEFAULT 0,
        spent INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (guild_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS v2_ledger (
        id TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        amount INTEGER NOT NULL,
        reason TEXT NOT NULL,
        reference TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_v2_ledger_user ON v2_ledger(guild_id, user_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS v2_streaks (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        current_count INTEGER NOT NULL DEFAULT 0,
        best_count INTEGER NOT NULL DEFAULT 0,
        last_date TEXT,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (guild_id, user_id, kind)
      );

      CREATE TABLE IF NOT EXISTS v2_permissions (
        guild_id TEXT NOT NULL,
        command TEXT NOT NULL,
        role_id TEXT NOT NULL,
        allowed INTEGER NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (guild_id, command, role_id)
      );

      CREATE TABLE IF NOT EXISTS v2_preferences (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (guild_id, user_id, key)
      );

      CREATE TABLE IF NOT EXISTS v2_rate_limits (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        action TEXT NOT NULL,
        window_start TEXT NOT NULL,
        uses INTEGER NOT NULL DEFAULT 1,
        PRIMARY KEY (guild_id, user_id, action)
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

  public createItem<T extends JsonObject>(input: {
    guildId: string;
    type: string;
    ownerId: string;
    title: string;
    status?: string;
    data?: T;
    dueAt?: string | null;
    idPrefix?: string;
  }): FeatureItem<T> {
    const id = shortId(input.idPrefix ?? input.type.slice(0, 5));
    const timestamp = nowIso();
    this.sqlite.prepare(`
      INSERT INTO v2_items (id, guild_id, type, owner_id, title, status, data, due_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.guildId,
      input.type,
      input.ownerId,
      input.title,
      input.status ?? 'active',
      JSON.stringify(input.data ?? {}),
      input.dueAt ?? null,
      timestamp,
      timestamp,
    );
    return this.getItem<T>(id)!;
  }

  public getItem<T extends JsonObject = JsonObject>(id: string, type?: string): FeatureItem<T> | undefined {
    const result = type
      ? row<RawItemRow>(this.sqlite.prepare('SELECT * FROM v2_items WHERE id = ? AND type = ?').get(id, type))
      : row<RawItemRow>(this.sqlite.prepare('SELECT * FROM v2_items WHERE id = ?').get(id));
    return decodeItem<T>(result);
  }

  public listItems<T extends JsonObject = JsonObject>(input: {
    guildId: string;
    type: string;
    status?: string;
    ownerId?: string;
    limit?: number;
  }): FeatureItem<T>[] {
    const clauses = ['guild_id = ?', 'type = ?'];
    const values: Array<string | number> = [input.guildId, input.type];
    if (input.status) {
      clauses.push('status = ?');
      values.push(input.status);
    }
    if (input.ownerId) {
      clauses.push('owner_id = ?');
      values.push(input.ownerId);
    }
    values.push(Math.min(100, Math.max(1, input.limit ?? 20)));
    const result = rows<RawItemRow>(
      this.sqlite.prepare(`SELECT * FROM v2_items WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC LIMIT ?`).all(...values),
    );
    return result.map((item) => decodeItem<T>(item)!);
  }

  public dueItems<T extends JsonObject = JsonObject>(type: string, before = nowIso(), limit = 50): FeatureItem<T>[] {
    return rows<RawItemRow>(
      this.sqlite
        .prepare("SELECT * FROM v2_items WHERE type = ? AND status = 'active' AND due_at IS NOT NULL AND due_at <= ? ORDER BY due_at LIMIT ?")
        .all(type, before, Math.min(100, limit)),
    ).map((item) => decodeItem<T>(item)!);
  }

  public updateItem<T extends JsonObject = JsonObject>(
    id: string,
    updates: { title?: string; status?: string; data?: Partial<T>; dueAt?: string | null },
  ): FeatureItem<T> | undefined {
    const current = this.getItem<T>(id);
    if (!current) return undefined;
    const merged = { ...current.data, ...(updates.data ?? {}) } as T;
    this.sqlite.prepare(`
      UPDATE v2_items SET title = ?, status = ?, data = ?, due_at = ?, updated_at = ? WHERE id = ?
    `).run(
      updates.title ?? current.title,
      updates.status ?? current.status,
      JSON.stringify(merged),
      updates.dueAt === undefined ? current.due_at : updates.dueAt,
      nowIso(),
      id,
    );
    return this.getItem<T>(id);
  }

  public deleteItem(id: string): boolean {
    return this.sqlite.prepare('DELETE FROM v2_items WHERE id = ?').run(id).changes > 0;
  }

  public setMember(input: {
    itemId: string;
    userId: string;
    role?: string;
    status?: string;
    data?: JsonObject;
  }): void {
    const timestamp = nowIso();
    this.sqlite.prepare(`
      INSERT INTO v2_members (item_id, user_id, role, status, data, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(item_id, user_id) DO UPDATE SET
        role = excluded.role, status = excluded.status, data = excluded.data, updated_at = excluded.updated_at
    `).run(
      input.itemId,
      input.userId,
      input.role ?? 'member',
      input.status ?? 'active',
      JSON.stringify(input.data ?? {}),
      timestamp,
      timestamp,
    );
  }

  public removeMember(itemId: string, userId: string): boolean {
    return this.sqlite.prepare('DELETE FROM v2_members WHERE item_id = ? AND user_id = ?').run(itemId, userId).changes > 0;
  }

  public getMember(itemId: string, userId: string): FeatureMember | undefined {
    const result = row<Omit<FeatureMember, 'data'> & { data: string }>(
      this.sqlite.prepare('SELECT * FROM v2_members WHERE item_id = ? AND user_id = ?').get(itemId, userId),
    );
    return result ? decodeMember(result) : undefined;
  }

  public listMembers(itemId: string): FeatureMember[] {
    return rows<Omit<FeatureMember, 'data'> & { data: string }>(
      this.sqlite.prepare('SELECT * FROM v2_members WHERE item_id = ? ORDER BY created_at').all(itemId),
    ).map(decodeMember);
  }

  public vote(itemId: string, userId: string, value: string): { created: boolean; total: number } {
    const timestamp = nowIso();
    const existing = row<{ value: string }>(
      this.sqlite.prepare('SELECT value FROM v2_votes WHERE item_id = ? AND user_id = ?').get(itemId, userId),
    );
    if (existing?.value === value) {
      this.sqlite.prepare('DELETE FROM v2_votes WHERE item_id = ? AND user_id = ?').run(itemId, userId);
    } else {
      this.sqlite.prepare(`
        INSERT INTO v2_votes (item_id, user_id, value, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(item_id, user_id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `).run(itemId, userId, value, timestamp, timestamp);
    }
    const total = row<{ total: number }>(
      this.sqlite.prepare('SELECT COUNT(*) AS total FROM v2_votes WHERE item_id = ? AND value = ?').get(itemId, value),
    )?.total ?? 0;
    return { created: existing?.value !== value, total };
  }

  public voteCounts(itemId: string): Array<{ value: string; total: number }> {
    return rows(
      this.sqlite.prepare('SELECT value, COUNT(*) AS total FROM v2_votes WHERE item_id = ? GROUP BY value ORDER BY total DESC').all(itemId),
    );
  }

  public votes(itemId: string): Array<{ user_id: string; value: string; created_at: string }> {
    return rows(
      this.sqlite.prepare('SELECT user_id, value, created_at FROM v2_votes WHERE item_id = ? ORDER BY created_at').all(itemId),
    );
  }

  public setSetting(guildId: string, key: string, value: JsonValue): void {
    this.sqlite.prepare(`
      INSERT INTO v2_settings (guild_id, key, value, updated_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(guild_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(guildId, key, JSON.stringify(value), nowIso());
  }

  public getSetting<T extends JsonValue>(guildId: string, key: string, fallback: T): T {
    const result = row<{ value: string }>(
      this.sqlite.prepare('SELECT value FROM v2_settings WHERE guild_id = ? AND key = ?').get(guildId, key),
    );
    if (!result) return fallback;
    try {
      return JSON.parse(result.value) as T;
    } catch {
      return fallback;
    }
  }

  public listSettings(guildId: string): Array<{ key: string; value: JsonValue }> {
    return rows<{ key: string; value: string }>(
      this.sqlite.prepare('SELECT key, value FROM v2_settings WHERE guild_id = ? ORDER BY key').all(guildId),
    ).map((item) => {
      try {
        return { key: item.key, value: JSON.parse(item.value) as JsonValue };
      } catch {
        return { key: item.key, value: item.value };
      }
    });
  }

  public setModule(guildId: string, module: string, enabled: boolean): void {
    this.sqlite.prepare(`
      INSERT INTO v2_modules (guild_id, module, enabled, updated_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(guild_id, module) DO UPDATE SET enabled = excluded.enabled, updated_at = excluded.updated_at
    `).run(guildId, module, enabled ? 1 : 0, nowIso());
  }

  public isModuleEnabled(guildId: string, module: string): boolean {
    const result = row<{ enabled: number }>(
      this.sqlite.prepare('SELECT enabled FROM v2_modules WHERE guild_id = ? AND module = ?').get(guildId, module),
    );
    return result?.enabled !== 0;
  }

  public listModules(guildId: string): Array<{ module: string; enabled: number }> {
    return rows(this.sqlite.prepare('SELECT module, enabled FROM v2_modules WHERE guild_id = ? ORDER BY module').all(guildId));
  }

  public audit(guildId: string, actorId: string, action: string, details: string, target?: string): void {
    this.sqlite.prepare(`
      INSERT INTO v2_audit (id, guild_id, actor_id, action, target, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(shortId('audit'), guildId, actorId, action, target ?? null, details, nowIso());
  }

  public auditLog(guildId: string, limit = 20, action?: string): AuditEntry[] {
    if (action) {
      return rows(
        this.sqlite.prepare('SELECT * FROM v2_audit WHERE guild_id = ? AND action LIKE ? ORDER BY created_at DESC LIMIT ?').all(guildId, `%${action}%`, limit),
      );
    }
    return rows(this.sqlite.prepare('SELECT * FROM v2_audit WHERE guild_id = ? ORDER BY created_at DESC LIMIT ?').all(guildId, limit));
  }

  public recordCommand(guildId: string, command: string): void {
    this.sqlite.prepare(`
      INSERT INTO v2_command_usage (guild_id, command, uses, last_used_at) VALUES (?, ?, 1, ?)
      ON CONFLICT(guild_id, command) DO UPDATE SET uses = uses + 1, last_used_at = excluded.last_used_at
    `).run(guildId, command, nowIso());
  }

  public commandStats(guildId?: string, limit = 20): Array<{ command: string; uses: number }> {
    if (guildId) {
      return rows(
        this.sqlite.prepare('SELECT command, uses FROM v2_command_usage WHERE guild_id = ? ORDER BY uses DESC LIMIT ?').all(guildId, limit),
      );
    }
    return rows(
      this.sqlite.prepare('SELECT command, SUM(uses) AS uses FROM v2_command_usage GROUP BY command ORDER BY uses DESC LIMIT ?').all(limit),
    );
  }

  public recordActivity(guildId: string, channelId: string, userId: string, date = new Date()): void {
    const day = date.toISOString().slice(0, 10);
    const hour = date.getUTCHours();
    this.transaction(() => {
      this.sqlite.prepare(`
        INSERT INTO v2_channel_activity (guild_id, channel_id, activity_date, hour, messages) VALUES (?, ?, ?, ?, 1)
        ON CONFLICT(guild_id, channel_id, activity_date, hour) DO UPDATE SET messages = messages + 1
      `).run(guildId, channelId, day, hour);
      this.sqlite.prepare(`
        INSERT INTO v2_user_activity (guild_id, user_id, activity_date, messages) VALUES (?, ?, ?, 1)
        ON CONFLICT(guild_id, user_id, activity_date) DO UPDATE SET messages = messages + 1
      `).run(guildId, userId, day);
    });
  }

  public analytics(guildId: string, days = 7): {
    messages: number;
    activeMembers: number;
    peakHour: number | null;
    channels: Array<{ channel_id: string; messages: number }>;
  } {
    const cutoff = new Date(Date.now() - Math.max(1, days - 1) * 86_400_000).toISOString().slice(0, 10);
    const total = row<{ total: number | null }>(
      this.sqlite.prepare('SELECT SUM(messages) AS total FROM v2_channel_activity WHERE guild_id = ? AND activity_date >= ?').get(guildId, cutoff),
    )?.total ?? 0;
    const active = row<{ total: number }>(
      this.sqlite.prepare('SELECT COUNT(DISTINCT user_id) AS total FROM v2_user_activity WHERE guild_id = ? AND activity_date >= ?').get(guildId, cutoff),
    )?.total ?? 0;
    const peak = row<{ hour: number }>(
      this.sqlite.prepare(`
        SELECT hour, SUM(messages) AS total FROM v2_channel_activity
        WHERE guild_id = ? AND activity_date >= ? GROUP BY hour ORDER BY total DESC LIMIT 1
      `).get(guildId, cutoff),
    );
    const channels = rows<{ channel_id: string; messages: number }>(
      this.sqlite.prepare(`
        SELECT channel_id, SUM(messages) AS messages FROM v2_channel_activity
        WHERE guild_id = ? AND activity_date >= ? GROUP BY channel_id ORDER BY messages DESC LIMIT 10
      `).all(guildId, cutoff),
    );
    return { messages: total, activeMembers: active, peakHour: peak?.hour ?? null, channels };
  }

  public addSkillXp(guildId: string, userId: string, area: string, amount: number): number {
    const safeAmount = Math.min(1000, Math.max(0, Math.floor(amount)));
    this.sqlite.prepare(`
      INSERT INTO v2_skill_xp (guild_id, user_id, area, xp, updated_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(guild_id, user_id, area) DO UPDATE SET xp = xp + excluded.xp, updated_at = excluded.updated_at
    `).run(guildId, userId, area, safeAmount, nowIso());
    return row<{ xp: number }>(
      this.sqlite.prepare('SELECT xp FROM v2_skill_xp WHERE guild_id = ? AND user_id = ? AND area = ?').get(guildId, userId, area),
    )?.xp ?? 0;
  }

  public skills(guildId: string, userId: string): Array<{ area: string; xp: number }> {
    return rows(
      this.sqlite.prepare('SELECT area, xp FROM v2_skill_xp WHERE guild_id = ? AND user_id = ? ORDER BY xp DESC').all(guildId, userId),
    );
  }

  public skillLeaderboard(guildId: string, area: string, limit = 10): Array<{ user_id: string; xp: number }> {
    return rows(
      this.sqlite.prepare('SELECT user_id, xp FROM v2_skill_xp WHERE guild_id = ? AND area = ? ORDER BY xp DESC LIMIT ?').all(guildId, area, limit),
    );
  }

  public changeCredits(guildId: string, userId: string, amount: number, reason: string, reference?: string): number {
    return this.transaction(() => {
      const current = this.wallet(guildId, userId);
      const next = current.credits + Math.trunc(amount);
      if (next < 0) throw new Error('INSUFFICIENT_CREDITS');
      this.sqlite.prepare(`
        INSERT INTO v2_wallets (guild_id, user_id, credits, earned, spent, updated_at) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(guild_id, user_id) DO UPDATE SET
          credits = excluded.credits, earned = excluded.earned, spent = excluded.spent, updated_at = excluded.updated_at
      `).run(
        guildId,
        userId,
        next,
        current.earned + Math.max(0, amount),
        current.spent + Math.max(0, -amount),
        nowIso(),
      );
      this.sqlite.prepare(`
        INSERT INTO v2_ledger (id, guild_id, user_id, amount, reason, reference, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(shortId('txn'), guildId, userId, amount, reason, reference ?? null, nowIso());
      return next;
    });
  }

  public wallet(guildId: string, userId: string): { credits: number; earned: number; spent: number } {
    return row<{ credits: number; earned: number; spent: number }>(
      this.sqlite.prepare('SELECT credits, earned, spent FROM v2_wallets WHERE guild_id = ? AND user_id = ?').get(guildId, userId),
    ) ?? { credits: 0, earned: 0, spent: 0 };
  }

  public creditLeaderboard(guildId: string, limit = 10): Array<{ user_id: string; credits: number }> {
    return rows(
      this.sqlite.prepare('SELECT user_id, credits FROM v2_wallets WHERE guild_id = ? ORDER BY credits DESC LIMIT ?').all(guildId, limit),
    );
  }

  public ledger(guildId: string, userId: string, limit = 20): Array<{ amount: number; reason: string; reference: string | null; created_at: string }> {
    return rows(
      this.sqlite.prepare('SELECT amount, reason, reference, created_at FROM v2_ledger WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT ?').all(guildId, userId, limit),
    );
  }

  public healthCheck(): { ok: boolean; items: number; auditEntries: number } {
    const result = row<{ ok: number }>(this.sqlite.prepare('SELECT 1 AS ok').get());
    const items = row<{ total: number }>(this.sqlite.prepare('SELECT COUNT(*) AS total FROM v2_items').get())?.total ?? 0;
    const auditEntries = row<{ total: number }>(this.sqlite.prepare('SELECT COUNT(*) AS total FROM v2_audit').get())?.total ?? 0;
    return { ok: result?.ok === 1, items, auditEntries };
  }

  public updateStreak(guildId: string, userId: string, kind: string, date = todayUtc()): { current: number; best: number } {
    const previous = row<{ current_count: number; best_count: number; last_date: string | null }>(
      this.sqlite.prepare('SELECT current_count, best_count, last_date FROM v2_streaks WHERE guild_id = ? AND user_id = ? AND kind = ?').get(guildId, userId, kind),
    );
    if (previous?.last_date === date) return { current: previous.current_count, best: previous.best_count };
    const yesterday = new Date(`${date}T00:00:00.000Z`);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const consecutive = previous?.last_date === yesterday.toISOString().slice(0, 10);
    const current = consecutive ? previous.current_count + 1 : 1;
    const best = Math.max(previous?.best_count ?? 0, current);
    this.sqlite.prepare(`
      INSERT INTO v2_streaks (guild_id, user_id, kind, current_count, best_count, last_date, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(guild_id, user_id, kind) DO UPDATE SET
        current_count = excluded.current_count, best_count = excluded.best_count,
        last_date = excluded.last_date, updated_at = excluded.updated_at
    `).run(guildId, userId, kind, current, best, date, nowIso());
    return { current, best };
  }

  public streaks(guildId: string, userId: string): Array<{ kind: string; current_count: number; best_count: number; last_date: string | null }> {
    return rows(
      this.sqlite.prepare('SELECT kind, current_count, best_count, last_date FROM v2_streaks WHERE guild_id = ? AND user_id = ? ORDER BY current_count DESC').all(guildId, userId),
    );
  }

  public setPermission(guildId: string, command: string, roleId: string, allowed: boolean): void {
    this.sqlite.prepare(`
      INSERT INTO v2_permissions (guild_id, command, role_id, allowed, updated_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(guild_id, command, role_id) DO UPDATE SET allowed = excluded.allowed, updated_at = excluded.updated_at
    `).run(guildId, command, roleId, allowed ? 1 : 0, nowIso());
  }

  public removePermission(guildId: string, command: string, roleId: string): boolean {
    return this.sqlite.prepare('DELETE FROM v2_permissions WHERE guild_id = ? AND command = ? AND role_id = ?').run(guildId, command, roleId).changes > 0;
  }

  public permissions(guildId: string, command?: string): Array<{ command: string; role_id: string; allowed: number }> {
    if (command) {
      return rows(this.sqlite.prepare('SELECT command, role_id, allowed FROM v2_permissions WHERE guild_id = ? AND command = ?').all(guildId, command));
    }
    return rows(this.sqlite.prepare('SELECT command, role_id, allowed FROM v2_permissions WHERE guild_id = ? ORDER BY command').all(guildId));
  }

  public setPreference(guildId: string, userId: string, key: string, value: JsonValue): void {
    this.sqlite.prepare(`
      INSERT INTO v2_preferences (guild_id, user_id, key, value, updated_at) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(guild_id, user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(guildId, userId, key, JSON.stringify(value), nowIso());
  }

  public getPreference<T extends JsonValue>(guildId: string, userId: string, key: string, fallback: T): T {
    const result = row<{ value: string }>(
      this.sqlite.prepare('SELECT value FROM v2_preferences WHERE guild_id = ? AND user_id = ? AND key = ?').get(guildId, userId, key),
    );
    if (!result) return fallback;
    try {
      return JSON.parse(result.value) as T;
    } catch {
      return fallback;
    }
  }

  public preferences(guildId: string, userId: string): Array<{ key: string; value: JsonValue }> {
    return rows<{ key: string; value: string }>(
      this.sqlite.prepare('SELECT key, value FROM v2_preferences WHERE guild_id = ? AND user_id = ? ORDER BY key').all(guildId, userId),
    ).map((item) => {
      try {
        return { key: item.key, value: JSON.parse(item.value) as JsonValue };
      } catch {
        return { key: item.key, value: item.value };
      }
    });
  }

  public consumeRateLimit(input: {
    guildId: string;
    userId: string;
    action: string;
    limit: number;
    windowMs: number;
  }): { allowed: boolean; remaining: number; resetAt: string } {
    return this.transaction(() => {
      const current = row<{ window_start: string; uses: number }>(
        this.sqlite.prepare('SELECT window_start, uses FROM v2_rate_limits WHERE guild_id = ? AND user_id = ? AND action = ?').get(input.guildId, input.userId, input.action),
      );
      const now = Date.now();
      const expired = !current || now - new Date(current.window_start).getTime() >= input.windowMs;
      const windowStart = expired ? nowIso() : current.window_start;
      const uses = expired ? 1 : current.uses + 1;
      this.sqlite.prepare(`
        INSERT INTO v2_rate_limits (guild_id, user_id, action, window_start, uses) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(guild_id, user_id, action) DO UPDATE SET window_start = excluded.window_start, uses = excluded.uses
      `).run(input.guildId, input.userId, input.action, windowStart, uses);
      const resetAt = new Date(new Date(windowStart).getTime() + input.windowMs).toISOString();
      return { allowed: uses <= input.limit, remaining: Math.max(0, input.limit - uses), resetAt };
    });
  }
}

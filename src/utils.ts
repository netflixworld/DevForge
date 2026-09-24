import { randomBytes } from 'node:crypto';
import type {
  ButtonInteraction,
  ChatInputCommandInteraction,
  GuildMember,
  ModalSubmitInteraction,
  PermissionResolvable,
} from 'discord.js';
import type { BotContext } from './types.js';
import { errorEmbed } from './theme.js';

export function shortId(prefix: string): string {
  return `${prefix}_${randomBytes(4).toString('hex')}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function truncate(value: string, maximum: number): string {
  if (value.length <= maximum) return value;
  return `${value.slice(0, Math.max(0, maximum - 1))}…`;
}

export function csv(value: string): string[] {
  return [...new Set(value.split(',').map((part) => part.trim()).filter(Boolean))].slice(0, 15);
}

export function normalizedCsv(value: string): string {
  return csv(value).join(', ');
}

export function languageToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_+#.-]/g, '').slice(0, 20) || 'text';
}

export function safeCodeBlock(code: string, language: string): string {
  const clean = code.replaceAll('```', '`\u200b``');
  return `\`\`\`${languageToken(language)}\n${clean}\n\`\`\``;
}

export function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function normalizeGithub(value: string): string | null {
  const trimmed = value.trim().replace(/^@/, '');
  if (!trimmed) return null;
  if (/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(trimmed)) {
    return `https://github.com/${trimmed}`;
  }
  if (isHttpUrl(trimmed)) {
    const url = new URL(trimmed);
    if (url.hostname === 'github.com' || url.hostname === 'www.github.com') return url.toString();
  }
  return null;
}

export function relativeTimestamp(iso: string): string {
  return `<t:${Math.floor(new Date(iso).getTime() / 1000)}:R>`;
}

export function levelFromXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 100));
}

export function xpForLevel(level: number): number {
  return Math.max(0, level) ** 2 * 100;
}

export function progressBar(current: number, target: number, size = 10): string {
  const ratio = target <= 0 ? 1 : clamp(current / target, 0, 1);
  const filled = Math.round(ratio * size);
  return `${'▰'.repeat(filled)}${'▱'.repeat(size - filled)}`;
}

export function overlapScore(first: string, second: string): number {
  const a = new Set(csv(first).map((value) => value.toLowerCase()));
  const b = new Set(csv(second).map((value) => value.toLowerCase()));
  let score = 0;
  for (const item of a) if (b.has(item)) score += 1;
  return score;
}

export function memberHasPermission(member: GuildMember, permission: PermissionResolvable): boolean {
  return member.permissions.has(permission);
}

type Repliable =
  | ChatInputCommandInteraction
  | ButtonInteraction
  | ModalSubmitInteraction;

export async function deny(
  interaction: Repliable,
  context: BotContext,
  description: string,
): Promise<void> {
  const payload = { embeds: [errorEmbed(context, 'Action unavailable', description)], ephemeral: true };
  if (interaction.deferred || interaction.replied) await interaction.followUp(payload);
  else await interaction.reply(payload);
}

export function parseDuration(input: string): number | null {
  const match = /^(\d+)(m|h|d)$/i.exec(input.trim());
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2]?.toLowerCase();
  const multiplier = unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;
  const result = amount * multiplier;
  return result > 0 && result <= 28 * 86_400_000 ? result : null;
}

export function randomInt(minimum: number, maximum: number): number {
  return Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
}

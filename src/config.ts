import 'dotenv/config';
import { resolveColor, type ColorResolvable } from 'discord.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface AppConfig {
  token: string;
  clientId: string;
  guildId?: string;
  botName: string;
  botStatus: string;
  primaryColor: number;
  accentColor: number;
  databasePath: string;
  port: number;
  githubWebhookSecret?: string;
  githubToken?: string;
  githubRepositoryFilter: Set<string>;
  dashboardEnabled: boolean;
  dashboardToken?: string;
  publicBaseUrl?: string;
  logLevel: LogLevel;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value || value.startsWith('replace_with_')) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  if (!value || value.startsWith('replace_with_')) return undefined;
  return value;
}

function color(name: string, fallback: ColorResolvable): number {
  const value = optional(name);
  if (!value) return resolveColor(fallback);
  try {
    return resolveColor(value as ColorResolvable);
  } catch {
    throw new Error(`${name} must be a valid hex color, for example #5865F2.`);
  }
}

export function loadConfig(): AppConfig {
  const port = Number(optional('PORT') ?? '3000');
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  const logLevel = (optional('LOG_LEVEL') ?? 'info') as LogLevel;
  if (!['debug', 'info', 'warn', 'error'].includes(logLevel)) {
    throw new Error('LOG_LEVEL must be debug, info, warn, or error.');
  }

  const githubRepositoryFilter = new Set(
    (optional('GITHUB_REPOSITORY_FILTER') ?? '')
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );

  const guildId = optional('DISCORD_GUILD_ID');
  const githubWebhookSecret = optional('GITHUB_WEBHOOK_SECRET');
  const githubToken = optional('GITHUB_TOKEN');
  const dashboardEnabled = (optional('DASHBOARD_ENABLED') ?? 'false').toLowerCase() === 'true';
  const dashboardToken = optional('DASHBOARD_TOKEN');
  const publicBaseUrl = optional('PUBLIC_BASE_URL')?.replace(/\/$/, '');
  if (dashboardEnabled && (!dashboardToken || dashboardToken.length < 24)) {
    throw new Error('DASHBOARD_TOKEN must contain at least 24 characters when DASHBOARD_ENABLED=true.');
  }

  return {
    token: required('DISCORD_TOKEN'),
    clientId: required('DISCORD_CLIENT_ID'),
    ...(guildId ? { guildId } : {}),
    botName: optional('BOT_NAME') ?? 'DevForge',
    botStatus: optional('BOT_STATUS') ?? 'Building better software together',
    primaryColor: color('PRIMARY_COLOR', '#5865F2'),
    accentColor: color('ACCENT_COLOR', '#22D3EE'),
    databasePath: optional('DATABASE_PATH') ?? './data/devforge.sqlite',
    port,
    ...(githubWebhookSecret ? { githubWebhookSecret } : {}),
    ...(githubToken ? { githubToken } : {}),
    githubRepositoryFilter,
    dashboardEnabled,
    ...(dashboardToken ? { dashboardToken } : {}),
    ...(publicBaseUrl ? { publicBaseUrl } : {}),
    logLevel,
  };
}

import type {
  AutocompleteInteraction,
  ButtonInteraction,
  ChatInputCommandInteraction,
  Client,
  ModalSubmitInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  StringSelectMenuInteraction,
} from 'discord.js';
import type { AppConfig } from './config.js';
import type { Database } from './database.js';
import type { Logger } from './logger.js';
import type { FeatureStore } from './v2/store.js';

export interface CommandDefinition {
  name: string;
  toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody;
}

export interface BotCommand {
  data: CommandDefinition;
  module?: string;
  execute(interaction: ChatInputCommandInteraction<'cached'>, context: BotContext): Promise<void>;
  autocomplete?(interaction: AutocompleteInteraction<'cached'>, context: BotContext): Promise<void>;
}

export interface SelectHandler {
  prefix: string;
  execute(interaction: StringSelectMenuInteraction<'cached'>, context: BotContext): Promise<void>;
}

export interface ComponentHandler {
  prefix: string;
  execute(interaction: ButtonInteraction, context: BotContext): Promise<void>;
}

export interface ModalHandler {
  prefix: string;
  execute(interaction: ModalSubmitInteraction<'cached'>, context: BotContext): Promise<void>;
}

export interface SpamEntry {
  content: string;
  timestamps: number[];
}

export interface BotContext {
  client: Client<true>;
  config: AppConfig;
  db: Database;
  v2: FeatureStore;
  logger: Logger;
  spamCache: Map<string, SpamEntry>;
  commands: Map<string, BotCommand>;
  runtime: {
    startedAt: number;
    joinWindows: Map<string, number[]>;
    voiceOwners: Map<string, string>;
  };
}

export interface GuildSettings {
  guild_id: string;
  welcome_channel_id: string | null;
  showcase_channel_id: string | null;
  review_channel_id: string | null;
  pairing_channel_id: string | null;
  challenge_channel_id: string | null;
  github_channel_id: string | null;
  starboard_channel_id: string | null;
  mod_log_channel_id: string | null;
  moderator_role_id: string | null;
  mentor_role_id: string | null;
  verified_role_id: string | null;
  star_threshold: number;
  xp_enabled: number;
  automod_enabled: number;
  anti_invite_enabled: number;
  welcome_enabled: number;
  updated_at: string;
}

export interface ProfileRow {
  guild_id: string;
  user_id: string;
  bio: string;
  skills: string;
  github: string | null;
  portfolio: string | null;
  timezone: string | null;
  availability: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserStatsRow {
  guild_id: string;
  user_id: string;
  xp: number;
  level: number;
  reputation: number;
  helpful: number;
  messages: number;
  last_xp_at: string | null;
}

export interface ProjectRow {
  id: string;
  guild_id: string;
  owner_id: string;
  title: string;
  summary: string;
  stack: string;
  repo_url: string | null;
  demo_url: string | null;
  looking_for: string | null;
  status: 'open' | 'closed';
  stars: number;
  channel_id: string | null;
  message_id: string | null;
  created_at: string;
  closed_at: string | null;
}

export interface ReviewRow {
  id: string;
  guild_id: string;
  author_id: string;
  reviewer_id: string | null;
  title: string;
  description: string;
  repository: string;
  language: string;
  difficulty: string;
  status: 'open' | 'claimed' | 'completed' | 'cancelled';
  channel_id: string | null;
  message_id: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface SnippetRow {
  id: string;
  guild_id: string;
  owner_id: string;
  name: string;
  language: string;
  description: string;
  code: string;
  tags: string;
  visibility: 'public' | 'private';
  uses: number;
  created_at: string;
  updated_at: string;
}

export interface PairQueueRow {
  guild_id: string;
  user_id: string;
  skills: string;
  level: string;
  timezone: string;
  topic: string;
  joined_at: string;
}

export interface PairSessionRow {
  id: string;
  guild_id: string;
  user_one_id: string;
  user_two_id: string;
  topic: string;
  thread_id: string | null;
  status: 'active' | 'completed' | 'cancelled';
  started_at: string;
  ended_at: string | null;
}

export interface ChallengeRow {
  id: string;
  guild_id: string;
  challenge_date: string;
  challenge_key: string;
  title: string;
  difficulty: string;
  description: string;
  requirements: string;
  bonus: string;
  created_at: string;
}

export interface ChallengeSubmissionRow {
  id: string;
  challenge_id: string;
  guild_id: string;
  user_id: string;
  repository: string;
  notes: string | null;
  votes: number;
  message_id: string | null;
  created_at: string;
}

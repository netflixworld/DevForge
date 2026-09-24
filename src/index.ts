import {
  ActivityType,
  Client,
  Events,
  GatewayIntentBits,
  Partials,
} from 'discord.js';
import { commandMap } from './commands/index.js';
import { loadConfig } from './config.js';
import { Database } from './database.js';
import { registerCommunityEvents } from './events/community.js';
import { registerV2Events } from './v2/events.js';
import { registerInteractionHandler } from './handlers/interactions.js';
import { Logger } from './logger.js';
import { startGithubWebhookServer } from './services/github-webhook.js';
import type { BotContext } from './types.js';
import { FeatureStore } from './v2/store.js';
import { startScheduler } from './v2/scheduler.js';

const config = loadConfig();
const logger = new Logger(config.logLevel);
const database = new Database(config.databasePath);
const featureStore = new FeatureStore(config.databasePath);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User],
  allowedMentions: {
    parse: ['users', 'roles'],
    repliedUser: false,
  },
});

let webhookServer: ReturnType<typeof startGithubWebhookServer> | undefined;
let scheduler: NodeJS.Timeout | undefined;

client.once(Events.ClientReady, (readyClient) => {
  const context: BotContext = {
    client: readyClient,
    config,
    db: database,
    v2: featureStore,
    logger,
    spamCache: new Map(),
    commands: commandMap(),
    runtime: {
      startedAt: Date.now(),
      joinWindows: new Map(),
      voiceOwners: new Map(),
    },
  };

  for (const guild of readyClient.guilds.cache.values()) database.ensureGuild(guild.id);
  registerInteractionHandler(readyClient, context);
  registerCommunityEvents(readyClient, context);
  registerV2Events(readyClient, context);
  scheduler = startScheduler(context);
  webhookServer = startGithubWebhookServer(readyClient, context);

  const presence = {
    activities: [{ name: config.botStatus, type: ActivityType.Watching }],
    status: 'online',
  } as const;
  readyClient.user.setPresence(presence);
  logger.info('DevForge is online.', {
    user: readyClient.user.tag,
    guilds: readyClient.guilds.cache.size,
    commands: context.commands.size,
  });
});

client.on(Events.Error, (error) => logger.error('Discord client error.', error));
client.on(Events.Warn, (message) => logger.warn('Discord client warning.', { warning: message }));

process.on('unhandledRejection', (error) => logger.error('Unhandled promise rejection.', error));
process.on('uncaughtException', (error) => logger.error('Uncaught exception.', error));

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('Graceful shutdown started.', { signal });
  webhookServer?.close();
  if (scheduler) clearInterval(scheduler);
  client.destroy();
  database.close();
  featureStore.close();
  process.exit(0);
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

await client.login(config.token);

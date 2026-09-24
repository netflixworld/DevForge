import { REST, Routes } from 'discord.js';
import { commands } from '../src/commands/index.js';
import { loadConfig } from '../src/config.js';

const config = loadConfig();
const rest = new REST({ version: '10' }).setToken(config.token);
const body = commands.map((command) => command.data.toJSON());
const commandNames = body.map((command) => command.name);
const duplicateNames = commandNames.filter((name, index) => commandNames.indexOf(name) !== index);

if (duplicateNames.length > 0) {
  throw new Error(`Duplicate command definitions detected: ${[...new Set(duplicateNames)].join(', ')}`);
}

if (config.guildId) {
  const globalRoute = Routes.applicationCommands(config.clientId);
  const existingGlobalCommands = (await rest.get(globalRoute)) as Array<{ name: string }>;

  if (existingGlobalCommands.length > 0) {
    console.log(`Removing ${existingGlobalCommands.length} old global command(s) to prevent duplicates...`);
    await rest.put(globalRoute, { body: [] });
    console.log('Old global commands removed.');
  }

  const guildRoute = Routes.applicationGuildCommands(config.clientId, config.guildId);
  const registeredCommands = (await rest.put(guildRoute, { body })) as Array<{ name: string }>;
  const registeredNames = new Set(registeredCommands.map((command) => command.name));
  const missingCommands = commandNames.filter((name) => !registeredNames.has(name));

  if (registeredCommands.length !== body.length || missingCommands.length > 0) {
    throw new Error(
      `Discord returned an incomplete command collection. Missing: ${missingCommands.join(', ') || 'unknown'}`,
    );
  }

  console.log(`Synchronized ${registeredCommands.length} unique commands in server ${config.guildId}.`);
} else {
  await rest.put(Routes.applicationCommands(config.clientId), { body });
  console.log(`Registered ${body.length} global commands.`);
  console.warn(
    'Global mode is active. If this application still has guild commands, set DISCORD_GUILD_ID and run this script once to remove duplicates.',
  );
}

console.log(commandNames.map((name) => `/${name}`).join(', '));

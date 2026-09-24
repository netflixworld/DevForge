import type { BotCommand } from '../types.js';
import { adminCommands } from './admin.js';
import { collaborationCommands } from './collaboration.js';
import { communityCommands } from './community.js';
import { projectCommands } from './projects.js';
import { snippetCommands } from './snippets.js';
import { toolCommands } from './tools.js';
import { pluginCommands } from '../modules/plugins.js';

export const commands: BotCommand[] = [
  ...communityCommands,
  ...projectCommands,
  ...snippetCommands,
  ...collaborationCommands,
  ...toolCommands,
  ...adminCommands,
  ...pluginCommands,
];

export function commandMap(): Map<string, BotCommand> {
  return new Map(commands.map((command) => [command.data.name, command]));
}

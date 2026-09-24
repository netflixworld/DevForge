import { v2CollaborationCommands, v2CollaborationComponents, v2CollaborationModals } from '../commands/v2-collaboration.js';
import { v2CommunityCommands } from '../commands/v2-community.js';
import { v2ModerationCommands } from '../commands/v2-moderation.js';
import { v2OperationsCommands } from '../commands/v2-operations.js';
import { v2ProductivityCommands } from '../commands/v2-productivity.js';
import { v2WorkspaceCommands, v2WorkspaceComponents, v2WorkspaceModals, v2WorkspaceSelects } from '../commands/v2-workspaces.js';
import { platformCommands } from '../commands/platform.js';
import type { BotCommand, ComponentHandler, ModalHandler, SelectHandler } from '../types.js';

export interface DevForgePlugin {
  name: string;
  commands: BotCommand[];
  components?: ComponentHandler[];
  modals?: ModalHandler[];
  selects?: SelectHandler[];
}

export const plugins: readonly DevForgePlugin[] = [
  { name: 'devforge-platform', commands: platformCommands },
  { name: 'advanced-moderation', commands: v2ModerationCommands },
  {
    name: 'community-workspaces',
    commands: v2WorkspaceCommands,
    components: v2WorkspaceComponents,
    modals: v2WorkspaceModals,
    selects: v2WorkspaceSelects,
  },
  { name: 'developer-community', commands: v2CommunityCommands },
  { name: 'operations', commands: v2OperationsCommands },
  { name: 'productivity', commands: v2ProductivityCommands },
  {
    name: 'collaboration-v2',
    commands: v2CollaborationCommands,
    components: v2CollaborationComponents,
    modals: v2CollaborationModals,
  },
];

export const pluginCommands = plugins.flatMap((plugin) => plugin.commands);
export const pluginComponents = plugins.flatMap((plugin) => plugin.components ?? []);
export const pluginModals = plugins.flatMap((plugin) => plugin.modals ?? []);
export const pluginSelects = plugins.flatMap((plugin) => plugin.selects ?? []);

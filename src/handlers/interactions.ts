import { Events, PermissionFlagsBits, type Client, type GuildMember, type Interaction } from 'discord.js';
import { moduleForCommand } from '../modules/registry.js';
import { errorEmbed } from '../theme.js';
import type { BotContext } from '../types.js';
import { componentHandlers } from './components.js';
import { modalHandlers } from './modals.js';
import { selectHandlers } from './selects.js';

async function reportFailure(interaction: Interaction, context: BotContext, error: unknown): Promise<void> {
  context.logger.error('Interaction handler failed.', error, {
    interactionId: interaction.id,
    userId: interaction.user.id,
    type: interaction.type,
  });
  if (!interaction.isRepliable()) return;
  const payload = {
    embeds: [
      errorEmbed(
        context,
        'Something went wrong',
        'The action could not be completed. Nothing sensitive was exposed; please try again or contact a moderator.',
      ),
    ],
    ephemeral: true,
  } as const;
  try {
    if (interaction.deferred || interaction.replied) await interaction.followUp(payload);
    else await interaction.reply(payload);
  } catch {
    // The interaction token may already have expired; the original error is logged.
  }
}

export function registerInteractionHandler(client: Client<true>, context: BotContext): void {
  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      if (interaction.isAutocomplete()) {
        if (!interaction.inCachedGuild()) return;
        const command = context.commands.get(interaction.commandName);
        if (command?.autocomplete) await command.autocomplete(interaction, context);
        return;
      }

      if (interaction.isChatInputCommand()) {
        if (!interaction.inCachedGuild()) {
          await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
          return;
        }
        const command = context.commands.get(interaction.commandName);
        if (!command) {
          await interaction.reply({ content: 'This command is not available in the current version.', ephemeral: true });
          return;
        }
        const module = command.module ?? moduleForCommand(interaction.commandName);
        if (module && !context.v2.isModuleEnabled(interaction.guildId, module)) {
          await interaction.reply({ content: `The **${module}** module is disabled in this server.`, ephemeral: true });
          return;
        }
        const member = interaction.member as GuildMember;
        if (!member.permissions.has(PermissionFlagsBits.Administrator) && !member.permissions.has(PermissionFlagsBits.ManageGuild)) {
          const rules = context.v2.permissions(interaction.guildId, interaction.commandName);
          const denied = rules.some((rule) => !rule.allowed && member.roles.cache.has(rule.role_id));
          const allowRules = rules.filter((rule) => Boolean(rule.allowed));
          const allowed = !allowRules.length || allowRules.some((rule) => member.roles.cache.has(rule.role_id));
          if (denied || !allowed) {
            await interaction.reply({ content: 'Your roles are not allowed to use this command.', ephemeral: true });
            return;
          }
        }
        context.v2.recordCommand(interaction.guildId, interaction.commandName);
        await command.execute(interaction, context);
        return;
      }

      if (interaction.isButton()) {
        const handler = componentHandlers.find((candidate) => interaction.customId.startsWith(candidate.prefix));
        if (handler) await handler.execute(interaction, context);
        return;
      }

      if (interaction.isModalSubmit()) {
        if (!interaction.inCachedGuild()) {
          await interaction.reply({ content: 'This form can only be submitted inside a server.', ephemeral: true });
          return;
        }
        const handler = modalHandlers.find((candidate) => interaction.customId.startsWith(candidate.prefix));
        if (handler) await handler.execute(interaction, context);
        return;
      }

      if (interaction.isStringSelectMenu()) {
        if (!interaction.inCachedGuild()) return;
        const handler = selectHandlers.find((candidate) => interaction.customId.startsWith(candidate.prefix));
        if (handler) await handler.execute(interaction, context);
      }
    } catch (error) {
      await reportFailure(interaction, context, error);
    }
  });
}

import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type GuildMember,
} from 'discord.js';
import type { SettingColumn } from '../database.js';
import { bootstrapGuild } from '../services/bootstrap.js';
import { embed, fields, successEmbed } from '../theme.js';
import type { BotCommand, BotContext } from '../types.js';
import { deny, parseDuration, relativeTimestamp, truncate } from '../utils.js';

const channelSettings: Record<string, SettingColumn> = {
  welcome: 'welcome_channel_id',
  showcase: 'showcase_channel_id',
  reviews: 'review_channel_id',
  pairing: 'pairing_channel_id',
  challenges: 'challenge_channel_id',
  github: 'github_channel_id',
  starboard: 'starboard_channel_id',
  modlog: 'mod_log_channel_id',
};

const roleSettings: Record<string, SettingColumn> = {
  moderator: 'moderator_role_id',
  mentor: 'mentor_role_id',
  verified: 'verified_role_id',
};

const featureSettings: Record<string, SettingColumn> = {
  xp: 'xp_enabled',
  automod: 'automod_enabled',
  anti_invite: 'anti_invite_enabled',
  welcome: 'welcome_enabled',
};

const configCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configure DevForge for this developer community.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) =>
      subcommand.setName('bootstrap').setDescription('Create a complete recommended role and channel structure.'),
    )
    .addSubcommand((subcommand) => subcommand.setName('view').setDescription('View the current server configuration.'))
    .addSubcommand((subcommand) =>
      subcommand
        .setName('channel')
        .setDescription('Choose a channel used by a feature.')
        .addStringOption((option) =>
          option
            .setName('purpose')
            .setDescription('Feature destination.')
            .setRequired(true)
            .addChoices(
              { name: 'Welcome', value: 'welcome' },
              { name: 'Project showcase', value: 'showcase' },
              { name: 'Code reviews', value: 'reviews' },
              { name: 'Pair programming', value: 'pairing' },
              { name: 'Daily challenges', value: 'challenges' },
              { name: 'GitHub events', value: 'github' },
              { name: 'Starboard', value: 'starboard' },
              { name: 'Moderation log', value: 'modlog' },
            ),
        )
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('Destination text channel.')
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('role')
        .setDescription('Choose a role used by permissions or recognition.')
        .addStringOption((option) =>
          option
            .setName('purpose')
            .setDescription('Role purpose.')
            .setRequired(true)
            .addChoices(
              { name: 'Moderator', value: 'moderator' },
              { name: 'Code mentor', value: 'mentor' },
              { name: 'Verified developer', value: 'verified' },
            ),
        )
        .addRoleOption((option) => option.setName('role').setDescription('The role to use.').setRequired(true)),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('feature')
        .setDescription('Enable or disable an optional feature.')
        .addStringOption((option) =>
          option
            .setName('feature')
            .setDescription('Feature to update.')
            .setRequired(true)
            .addChoices(
              { name: 'XP and levels', value: 'xp' },
              { name: 'Automod', value: 'automod' },
              { name: 'Block Discord invites', value: 'anti_invite' },
              { name: 'Welcome messages', value: 'welcome' },
            ),
        )
        .addBooleanOption((option) => option.setName('enabled').setDescription('New state.').setRequired(true)),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('star-threshold')
        .setDescription('Set the number of ⭐ reactions required for the starboard.')
        .addIntegerOption((option) =>
          option.setName('count').setDescription('Between 2 and 25.').setRequired(true).setMinValue(2).setMaxValue(25),
        ),
    ),
  async execute(interaction, context) {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
      await deny(interaction, context, 'You need **Manage Server** to configure the bot.');
      return;
    }
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'bootstrap') {
      await interaction.deferReply({ ephemeral: true });
      try {
        const result = await bootstrapGuild(interaction.guild, context);
        const welcome = result.channels['welcome'];
        await welcome?.send({
          embeds: [
            embed(
              context,
              `👋 Welcome to ${interaction.guild.name}`,
              'Build your developer identity, collaborate on real projects, and help others grow. Start with the commands below.',
            )
              .setColor(context.config.accentColor)
              .addFields(
                ...fields([
                  ['1 • Introduce yourself', 'Use `/profile set` to add your skills, GitHub, timezone, and availability.'],
                  ['2 • Ship in public', 'Use `/project create` to showcase work and recruit collaborators.'],
                  ['3 • Learn together', 'Try `/pair join`, `/review request`, or `/challenge current`.'],
                  ['Community principle', 'Be specific, constructive, and generous with context. Never share secrets or private data.'],
                ]),
              ),
          ],
        });
        await interaction.editReply({
          embeds: [
            successEmbed(
              context,
              'Community workspace ready',
              `Created **${result.createdChannels.length} channels** and **${result.createdRoles.length} roles**. Existing matching resources were preserved.`,
            ),
          ],
        });
      } catch (error) {
        context.logger.error('Guild bootstrap failed.', error, { guildId: interaction.guildId });
        await interaction.editReply({
          embeds: [
            embed(
              context,
              'Bootstrap could not finish',
              'Make sure the bot has **Manage Channels** and **Manage Roles**, and that its role is above the roles it needs to manage.',
            ).setColor(0xef4444),
          ],
        });
      }
      return;
    }

    if (subcommand === 'view') {
      const settings = context.db.getSettings(interaction.guildId);
      await interaction.reply({
        embeds: [
          embed(context, '⚙️ DevForge Configuration').addFields(
            ...fields([
              ['Welcome', settings.welcome_channel_id ? `<#${settings.welcome_channel_id}>` : 'Not set', true],
              ['Projects', settings.showcase_channel_id ? `<#${settings.showcase_channel_id}>` : 'Not set', true],
              ['Reviews', settings.review_channel_id ? `<#${settings.review_channel_id}>` : 'Not set', true],
              ['Pairing', settings.pairing_channel_id ? `<#${settings.pairing_channel_id}>` : 'Not set', true],
              ['Challenges', settings.challenge_channel_id ? `<#${settings.challenge_channel_id}>` : 'Not set', true],
              ['GitHub', settings.github_channel_id ? `<#${settings.github_channel_id}>` : 'Not set', true],
              ['Starboard', settings.starboard_channel_id ? `<#${settings.starboard_channel_id}>` : 'Not set', true],
              ['Mod log', settings.mod_log_channel_id ? `<#${settings.mod_log_channel_id}>` : 'Not set', true],
              ['Moderator', settings.moderator_role_id ? `<@&${settings.moderator_role_id}>` : 'Not set', true],
              ['Mentor', settings.mentor_role_id ? `<@&${settings.mentor_role_id}>` : 'Not set', true],
              ['Verified', settings.verified_role_id ? `<@&${settings.verified_role_id}>` : 'Not set', true],
              ['Features', `XP ${settings.xp_enabled ? '✅' : '❌'} • Automod ${settings.automod_enabled ? '✅' : '❌'} • Anti-invite ${settings.anti_invite_enabled ? '✅' : '❌'} • Welcome ${settings.welcome_enabled ? '✅' : '❌'}`],
              ['Star threshold', settings.star_threshold.toString(), true],
            ]),
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    if (subcommand === 'channel') {
      const purpose = interaction.options.getString('purpose', true);
      const channel = interaction.options.getChannel('channel', true);
      context.db.setSetting(interaction.guildId, channelSettings[purpose]!, channel.id);
      await interaction.reply({
        embeds: [successEmbed(context, 'Channel configured', `**${purpose}** will now use ${channel}.`)],
        ephemeral: true,
      });
      return;
    }

    if (subcommand === 'role') {
      const purpose = interaction.options.getString('purpose', true);
      const role = interaction.options.getRole('role', true);
      context.db.setSetting(interaction.guildId, roleSettings[purpose]!, role.id);
      await interaction.reply({
        embeds: [successEmbed(context, 'Role configured', `**${purpose}** will now use ${role}.`)],
        ephemeral: true,
      });
      return;
    }

    if (subcommand === 'feature') {
      const feature = interaction.options.getString('feature', true);
      const enabled = interaction.options.getBoolean('enabled', true);
      context.db.setSetting(interaction.guildId, featureSettings[feature]!, enabled ? 1 : 0);
      await interaction.reply({
        embeds: [successEmbed(context, 'Feature updated', `**${feature}** is now **${enabled ? 'enabled' : 'disabled'}**.`)],
        ephemeral: true,
      });
      return;
    }

    const count = interaction.options.getInteger('count', true);
    context.db.setSetting(interaction.guildId, 'star_threshold', count);
    await interaction.reply({
      embeds: [successEmbed(context, 'Starboard threshold updated', `Messages now need **${count} stars**.`)],
      ephemeral: true,
    });
  },
};

async function logCase(
  context: BotContext,
  guildId: string,
  options: {
    caseNumber: number;
    targetId: string;
    moderatorId: string;
    action: string;
    reason: string;
    duration?: string;
  },
): Promise<void> {
  const settings = context.db.getSettings(guildId);
  if (!settings.mod_log_channel_id) return;
  const channel = await context.client.channels.fetch(settings.mod_log_channel_id).catch(() => null);
  if (channel?.type !== ChannelType.GuildText) return;
  await channel.send({
    embeds: [
      embed(context, `🛡️ Case #${options.caseNumber} • ${options.action}`)
        .setColor(0xef4444)
        .addFields(
          ...fields([
            ['Member', `<@${options.targetId}> • \`${options.targetId}\``],
            ['Moderator', `<@${options.moderatorId}>`, true],
            ['Duration', options.duration ?? 'Not applicable', true],
            ['Reason', options.reason],
          ]),
        ),
    ],
  });
}

const modCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('mod')
    .setDescription('Moderation cases, timeouts, warnings, and cleanup.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand((subcommand) =>
      subcommand
        .setName('warn')
        .setDescription('Issue a formal warning.')
        .addUserOption((option) => option.setName('member').setDescription('Member to warn.').setRequired(true))
        .addStringOption((option) =>
          option.setName('reason').setDescription('Reason for the warning.').setRequired(true).setMaxLength(500),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('timeout')
        .setDescription('Temporarily restrict a member.')
        .addUserOption((option) => option.setName('member').setDescription('Member to restrict.').setRequired(true))
        .addStringOption((option) =>
          option.setName('duration').setDescription('For example 30m, 2h, or 7d.').setRequired(true).setMaxLength(10),
        )
        .addStringOption((option) =>
          option.setName('reason').setDescription('Reason for the timeout.').setRequired(true).setMaxLength(500),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('note')
        .setDescription('Add a private moderation note without notifying the member.')
        .addUserOption((option) => option.setName('member').setDescription('Member to document.').setRequired(true))
        .addStringOption((option) =>
          option.setName('note').setDescription('Internal note.').setRequired(true).setMaxLength(750),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('cases')
        .setDescription('View recent cases for a member.')
        .addUserOption((option) => option.setName('member').setDescription('Member to inspect.').setRequired(true)),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('purge')
        .setDescription('Delete recent messages in the current channel.')
        .addIntegerOption((option) =>
          option.setName('amount').setDescription('Number of recent messages.').setRequired(true).setMinValue(1).setMaxValue(100),
        )
        .addUserOption((option) => option.setName('member').setDescription('Only delete messages from this member.')),
    ),
  async execute(interaction, context) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'purge') {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages)) {
        await deny(interaction, context, 'You need **Manage Messages** to purge a channel.');
        return;
      }
      const channel = interaction.channel;
      if (!channel || !('bulkDelete' in channel) || !('messages' in channel)) {
        await deny(interaction, context, 'This command only works in a server text channel or thread.');
        return;
      }
      await interaction.deferReply({ ephemeral: true });
      const amount = interaction.options.getInteger('amount', true);
      const member = interaction.options.getUser('member');
      if (!member) {
        const deleted = await channel.bulkDelete(amount, true);
        await interaction.editReply({
          embeds: [successEmbed(context, 'Channel cleaned', `Deleted **${deleted.size}** recent messages.`)],
        });
        return;
      }
      const fetched = await channel.messages.fetch({ limit: 100 });
      const selected = fetched.filter((message) => message.author.id === member.id).first(amount);
      const deleted = await channel.bulkDelete(selected, true);
      await interaction.editReply({
        embeds: [successEmbed(context, 'Channel cleaned', `Deleted **${deleted.size}** recent messages from ${member}.`)],
      });
      return;
    }

    const user = interaction.options.getUser('member', true);
    if (subcommand === 'cases') {
      const cases = context.db.getModerationCases(interaction.guildId, user.id);
      const body = cases.length
        ? cases
            .map(
              (item) =>
                `**#${String(item['case_number'])} • ${String(item['action'])}** — ${relativeTimestamp(String(item['created_at']))}\n${truncate(String(item['reason']), 220)} • <@${String(item['moderator_id'])}>`,
            )
            .join('\n\n')
        : 'No moderation cases were found for this member.';
      await interaction.reply({ embeds: [embed(context, `🛡️ Cases for ${user.displayName}`, body)], ephemeral: true });
      return;
    }

    if (user.bot || user.id === interaction.user.id) {
      await deny(interaction, context, 'Select another human member.');
      return;
    }
    const member = interaction.options.getMember('member') as GuildMember | null;
    const reason =
      subcommand === 'note' ? interaction.options.getString('note', true) : interaction.options.getString('reason', true);
    let action = 'Warning';
    let durationMs: number | undefined;
    let durationLabel: string | undefined;

    if (subcommand === 'timeout') {
      if (!member) {
        await deny(interaction, context, 'That member is not currently in the server.');
        return;
      }
      const duration = interaction.options.getString('duration', true);
      durationMs = parseDuration(duration) ?? undefined;
      if (!durationMs) {
        await deny(interaction, context, 'Use a duration such as `30m`, `2h`, or `7d` (maximum 28 days).');
        return;
      }
      if (!member.moderatable) {
        await deny(interaction, context, 'I cannot moderate that member. Check role hierarchy and bot permissions.');
        return;
      }
      await member.timeout(durationMs, `${interaction.user.tag}: ${reason}`);
      action = 'Timeout';
      durationLabel = duration;
    } else if (subcommand === 'note') {
      action = 'Internal note';
    }

    const created = context.db.createModerationCase({
      guildId: interaction.guildId,
      targetId: user.id,
      moderatorId: interaction.user.id,
      action,
      reason,
      ...(durationMs ? { durationMs } : {}),
    });
    await logCase(context, interaction.guildId, {
      caseNumber: created.caseNumber,
      targetId: user.id,
      moderatorId: interaction.user.id,
      action,
      reason,
      ...(durationLabel ? { duration: durationLabel } : {}),
    });

    if (subcommand !== 'note') {
      await user
        .send({
          embeds: [
            embed(
              context,
              `${action} in ${interaction.guild.name}`,
              `Reason: ${reason}${durationLabel ? `\nDuration: ${durationLabel}` : ''}\nCase: #${created.caseNumber}`,
            ).setColor(0xef4444),
          ],
        })
        .catch(() => null);
    }
    await interaction.reply({
      embeds: [
        successEmbed(
          context,
          `${action} recorded`,
          `Case **#${created.caseNumber}** was created for ${user}.${subcommand === 'note' ? ' The note is only visible to moderators.' : ''}`,
        ),
      ],
      ephemeral: true,
    });
  },
};

export const adminCommands: BotCommand[] = [configCommand, modCommand];

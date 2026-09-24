import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type GuildMember,
} from 'discord.js';
import { embed, fields, successEmbed } from '../theme.js';
import type { BotCommand, BotContext } from '../types.js';
import { deny, parseDuration, relativeTimestamp, truncate } from '../utils.js';

async function moderationLog(
  context: BotContext,
  guildId: string,
  input: { caseNumber: number; targetId: string; moderatorId: string; action: string; reason: string },
): Promise<void> {
  context.v2.audit(guildId, input.moderatorId, `moderation.${input.action.toLowerCase()}`, input.reason, input.targetId);
  const settings = context.db.getSettings(guildId);
  if (!settings.mod_log_channel_id) return;
  const channel = await context.client.channels.fetch(settings.mod_log_channel_id).catch(() => null);
  if (channel?.type !== ChannelType.GuildText) return;
  await channel.send({
    embeds: [
      embed(context, `🛡️ Case #${input.caseNumber} • ${input.action}`)
        .setColor(0xef4444)
        .addFields(
          ...fields([
            ['Member', `<@${input.targetId}> • \`${input.targetId}\``],
            ['Moderator', `<@${input.moderatorId}>`, true],
            ['Reason', input.reason],
          ]),
        ),
    ],
  });
}

async function createCase(
  context: BotContext,
  interaction: ChatInputCommandInteraction<'cached'>,
  targetId: string,
  action: string,
  reason: string,
  durationMs?: number,
): Promise<number> {
  const result = context.db.createModerationCase({
    guildId: interaction.guildId,
    targetId,
    moderatorId: interaction.user.id,
    action,
    reason,
    ...(durationMs ? { durationMs } : {}),
  });
  await moderationLog(context, interaction.guildId, {
    caseNumber: result.caseNumber,
    targetId,
    moderatorId: interaction.user.id,
    action,
    reason,
  });
  return result.caseNumber;
}

function memberFrom(interaction: ChatInputCommandInteraction<'cached'>): GuildMember | null {
  return interaction.options.getMember('member') as GuildMember | null;
}

function invalidTarget(interaction: ChatInputCommandInteraction<'cached'>, member: GuildMember | null): boolean {
  return !member || member.user.bot || member.id === interaction.user.id || member.id === interaction.guild.ownerId;
}

const banCommand: BotCommand = {
  module: 'moderation',
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member and record a moderation case.')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption((option) => option.setName('member').setDescription('Member to ban.').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Reason.').setRequired(true).setMaxLength(500))
    .addIntegerOption((option) =>
      option.setName('delete_days').setDescription('Delete recent messages (0–7 days).').setMinValue(0).setMaxValue(7),
    ),
  async execute(interaction, context) {
    const user = interaction.options.getUser('member', true);
    const member = memberFrom(interaction);
    if (user.id === interaction.user.id || user.id === interaction.guild.ownerId || user.bot) {
      await deny(interaction, context, 'That account cannot be banned with this command.');
      return;
    }
    if (member && !member.bannable) {
      await deny(interaction, context, 'I cannot ban that member. Check role hierarchy and permissions.');
      return;
    }
    const reason = interaction.options.getString('reason', true);
    const days = interaction.options.getInteger('delete_days') ?? 0;
    await interaction.deferReply({ ephemeral: true });
    await interaction.guild.members.ban(user, { deleteMessageSeconds: days * 86_400, reason: `${interaction.user.tag}: ${reason}` });
    const caseNumber = await createCase(context, interaction, user.id, 'Ban', reason);
    await interaction.editReply({ embeds: [successEmbed(context, 'Member banned', `${user.tag} was banned. Case **#${caseNumber}**.`)] });
  },
};

const kickCommand: BotCommand = {
  module: 'moderation',
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Remove a member from the server and record a case.')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption((option) => option.setName('member').setDescription('Member to kick.').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Reason.').setRequired(true).setMaxLength(500)),
  async execute(interaction, context) {
    const member = memberFrom(interaction);
    if (invalidTarget(interaction, member) || !member?.kickable) {
      await deny(interaction, context, 'I cannot kick that member. Check the target and role hierarchy.');
      return;
    }
    const reason = interaction.options.getString('reason', true);
    await interaction.deferReply({ ephemeral: true });
    await member.kick(`${interaction.user.tag}: ${reason}`);
    const caseNumber = await createCase(context, interaction, member.id, 'Kick', reason);
    await interaction.editReply({ embeds: [successEmbed(context, 'Member kicked', `${member.user.tag} was removed. Case **#${caseNumber}**.`)] });
  },
};

const timeoutCommand: BotCommand = {
  module: 'moderation',
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Apply or remove a member timeout.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) => option.setName('member').setDescription('Member to restrict.').setRequired(true))
    .addStringOption((option) => option.setName('duration').setDescription('30m, 2h, 7d, or off.').setRequired(true).setMaxLength(10))
    .addStringOption((option) => option.setName('reason').setDescription('Reason.').setRequired(true).setMaxLength(500)),
  async execute(interaction, context) {
    const member = memberFrom(interaction);
    if (invalidTarget(interaction, member) || !member?.moderatable) {
      await deny(interaction, context, 'I cannot timeout that member. Check the target and role hierarchy.');
      return;
    }
    const durationText = interaction.options.getString('duration', true).toLowerCase();
    const reason = interaction.options.getString('reason', true);
    const removing = durationText === 'off' || durationText === 'remove' || durationText === '0';
    const durationMs = removing ? null : parseDuration(durationText);
    if (!removing && !durationMs) {
      await deny(interaction, context, 'Use `30m`, `2h`, `7d`, or `off` (maximum 28 days).');
      return;
    }
    await member.timeout(durationMs, `${interaction.user.tag}: ${reason}`);
    const action = removing ? 'Timeout removed' : 'Timeout';
    const caseNumber = await createCase(context, interaction, member.id, action, reason, durationMs ?? undefined);
    await interaction.reply({
      embeds: [successEmbed(context, action, `${member} ${removing ? 'can participate again' : `was restricted for **${durationText}**`}. Case **#${caseNumber}**.`)],
      ephemeral: true,
    });
  },
};

const warnCommand: BotCommand = {
  module: 'moderation',
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a member with automatic escalation.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption((option) => option.setName('member').setDescription('Member to warn.').setRequired(true))
    .addStringOption((option) => option.setName('reason').setDescription('Reason.').setRequired(true).setMaxLength(500)),
  async execute(interaction, context) {
    const member = memberFrom(interaction);
    if (invalidTarget(interaction, member)) {
      await deny(interaction, context, 'Select another human member.');
      return;
    }
    const reason = interaction.options.getString('reason', true);
    const caseNumber = await createCase(context, interaction, member!.id, 'Warning', reason);
    const warningCount = context.db
      .getModerationCases(interaction.guildId, member!.id, 100)
      .filter((item) => String(item['action']).toLowerCase() === 'warning').length;
    const levels = context.v2.getSetting<Record<string, number> & { [key: string]: number }>(
      interaction.guildId,
      'moderation.escalation',
      { '3': 3_600_000, '5': 86_400_000, '7': 604_800_000 },
    );
    const escalation = levels[String(warningCount)];
    let escalated = '';
    if (escalation && member!.moderatable) {
      await member!.timeout(escalation, `Automatic escalation after ${warningCount} warnings`).catch(() => null);
      const label = escalation >= 86_400_000 ? `${Math.round(escalation / 86_400_000)}d` : `${Math.round(escalation / 3_600_000)}h`;
      escalated = ` Automatic escalation applied: **${label} timeout**.`;
      await createCase(context, interaction, member!.id, 'Automatic escalation', `${warningCount} accumulated warnings`, escalation);
    }
    await member!.send({
      embeds: [embed(context, `Warning in ${interaction.guild.name}`, `Reason: ${reason}\nCase: #${caseNumber}${escalated}`).setColor(0xef4444)],
    }).catch(() => null);
    await interaction.reply({
      embeds: [successEmbed(context, 'Warning recorded', `${member} now has **${warningCount}** recorded warning(s).${escalated}`)],
      ephemeral: true,
    });
  },
};

const purgeCommand: BotCommand = {
  module: 'moderation',
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Delete recent messages from the current channel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((option) => option.setName('amount').setDescription('1–100 messages.').setRequired(true).setMinValue(1).setMaxValue(100))
    .addUserOption((option) => option.setName('member').setDescription('Only messages from this member.')),
  async execute(interaction, context) {
    const channel = interaction.channel;
    if (!channel || !('bulkDelete' in channel) || !('messages' in channel)) {
      await deny(interaction, context, 'Use this command in a server text channel or thread.');
      return;
    }
    await interaction.deferReply({ ephemeral: true });
    const amount = interaction.options.getInteger('amount', true);
    const user = interaction.options.getUser('member');
    if (!user) {
      const deleted = await channel.bulkDelete(amount, true);
      context.v2.audit(interaction.guildId, interaction.user.id, 'moderation.purge', `${deleted.size} messages`, channel.id);
      await interaction.editReply({ embeds: [successEmbed(context, 'Messages purged', `Deleted **${deleted.size}** recent messages.`)] });
      return;
    }
    const messages = await channel.messages.fetch({ limit: 100 });
    const selected = messages.filter((message) => message.author.id === user.id).first(amount);
    const deleted = await channel.bulkDelete(selected, true);
    context.v2.audit(interaction.guildId, interaction.user.id, 'moderation.purge', `${deleted.size} messages from ${user.id}`, channel.id);
    await interaction.editReply({ embeds: [successEmbed(context, 'Messages purged', `Deleted **${deleted.size}** messages from ${user}.`)] });
  },
};

const slowmodeCommand: BotCommand = {
  module: 'moderation',
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Set the current channel slowmode.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addIntegerOption((option) => option.setName('seconds').setDescription('0 disables it; maximum 6 hours.').setRequired(true).setMinValue(0).setMaxValue(21_600)),
  async execute(interaction, context) {
    const channel = interaction.channel;
    if (!channel || !('setRateLimitPerUser' in channel)) {
      await deny(interaction, context, 'This channel does not support slowmode.');
      return;
    }
    const seconds = interaction.options.getInteger('seconds', true);
    await channel.setRateLimitPerUser(seconds, `Changed by ${interaction.user.tag}`);
    context.v2.audit(interaction.guildId, interaction.user.id, 'moderation.slowmode', `${seconds}s`, channel.id);
    await interaction.reply({ embeds: [successEmbed(context, 'Slowmode updated', seconds ? `Members can send once every **${seconds}s**.` : 'Slowmode is disabled.')], ephemeral: true });
  },
};

function lockCommand(name: 'lock' | 'unlock', locked: boolean): BotCommand {
  return {
    module: 'moderation',
    data: new SlashCommandBuilder()
      .setName(name)
      .setDescription(`${locked ? 'Lock' : 'Unlock'} the current channel for the default role.`)
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
      .addStringOption((option) => option.setName('reason').setDescription('Reason for the change.').setMaxLength(300)),
    async execute(interaction, context) {
      const channel = interaction.guild.channels.cache.get(interaction.channelId);
      if (!channel || !('permissionOverwrites' in channel)) {
        await deny(interaction, context, 'This channel cannot be locked.');
        return;
      }
      const reason = interaction.options.getString('reason') ?? 'No reason provided';
      await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
        SendMessages: locked ? false : null,
        AddReactions: locked ? false : null,
        SendMessagesInThreads: locked ? false : null,
      }, { reason: `${interaction.user.tag}: ${reason}` });
      context.v2.audit(interaction.guildId, interaction.user.id, `moderation.${name}`, reason, channel.id);
      await interaction.reply({ embeds: [successEmbed(context, locked ? 'Channel locked' : 'Channel unlocked', `${channel} is now ${locked ? 'read-only' : 'open for messages'}.`)] });
    },
  };
}

const nickCommand: BotCommand = {
  module: 'moderation',
  data: new SlashCommandBuilder()
    .setName('nick')
    .setDescription('Change or clear a member nickname.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
    .addUserOption((option) => option.setName('member').setDescription('Member.').setRequired(true))
    .addStringOption((option) => option.setName('nickname').setDescription('Leave empty to clear.').setMaxLength(32)),
  async execute(interaction, context) {
    const member = memberFrom(interaction);
    if (!member || !member.manageable) {
      await deny(interaction, context, 'I cannot manage that member nickname.');
      return;
    }
    const nickname = interaction.options.getString('nickname');
    await member.setNickname(nickname, `Changed by ${interaction.user.tag}`);
    context.v2.audit(interaction.guildId, interaction.user.id, 'moderation.nickname', nickname ?? 'cleared', member.id);
    await interaction.reply({ embeds: [successEmbed(context, 'Nickname updated', nickname ? `${member}'s nickname is now **${nickname}**.` : `${member}'s nickname was cleared.`)], ephemeral: true });
  },
};

const appealCommand: BotCommand = {
  module: 'moderation',
  data: new SlashCommandBuilder()
    .setName('appeal')
    .setDescription('Submit or manage moderation appeals.')
    .addSubcommand((subcommand) =>
      subcommand.setName('submit').setDescription('Appeal one of your moderation cases.')
        .addIntegerOption((option) => option.setName('case').setDescription('Case number.').setRequired(true).setMinValue(1))
        .addStringOption((option) => option.setName('explanation').setDescription('Why should this case be reviewed?').setRequired(true).setMinLength(20).setMaxLength(1000)),
    )
    .addSubcommand((subcommand) => subcommand.setName('status').setDescription('View your recent appeals.'))
    .addSubcommand((subcommand) =>
      subcommand.setName('resolve').setDescription('Accept or reject an appeal (moderators).')
        .addStringOption((option) => option.setName('id').setDescription('Appeal ID.').setRequired(true))
        .addStringOption((option) => option.setName('decision').setDescription('Decision.').setRequired(true).addChoices(
          { name: 'Accept', value: 'accepted' }, { name: 'Reject', value: 'rejected' },
        ))
        .addStringOption((option) => option.setName('note').setDescription('Official response.').setRequired(true).setMaxLength(500)),
    ),
  async execute(interaction, context) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'submit') {
      const caseNumber = interaction.options.getInteger('case', true);
      const ownCases = context.db.getModerationCases(interaction.guildId, interaction.user.id, 100);
      if (!ownCases.some((item) => Number(item['case_number']) === caseNumber)) {
        await deny(interaction, context, 'That case does not belong to your account in this server.');
        return;
      }
      const explanation = interaction.options.getString('explanation', true);
      const appeal = context.v2.createItem({
        guildId: interaction.guildId,
        type: 'appeal',
        ownerId: interaction.user.id,
        title: `Appeal for case #${caseNumber}`,
        status: 'pending',
        data: { caseNumber, explanation },
        idPrefix: 'apl',
      });
      context.v2.audit(interaction.guildId, interaction.user.id, 'appeal.submitted', `Case #${caseNumber}`, appeal.id);
      await interaction.reply({ embeds: [successEmbed(context, 'Appeal submitted', `Appeal **${appeal.id}** is waiting for staff review.`)], ephemeral: true });
      return;
    }
    if (subcommand === 'status') {
      const items = context.v2.listItems({ guildId: interaction.guildId, type: 'appeal', ownerId: interaction.user.id, limit: 10 });
      const body = items.length
        ? items.map((item) => `**${item.id}** • ${item.title} • **${item.status}** • ${relativeTimestamp(item.created_at)}${item.data['note'] ? `\n${truncate(String(item.data['note']), 180)}` : ''}`).join('\n\n')
        : 'You have not submitted any appeals.';
      await interaction.reply({ embeds: [embed(context, '🛡️ Your appeals', body)], ephemeral: true });
      return;
    }
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ModerateMembers)) {
      await deny(interaction, context, 'You need **Moderate Members** to resolve appeals.');
      return;
    }
    const id = interaction.options.getString('id', true);
    const item = context.v2.getItem(id, 'appeal');
    if (!item || item.guild_id !== interaction.guildId) {
      await deny(interaction, context, 'Appeal not found in this server.');
      return;
    }
    const decision = interaction.options.getString('decision', true);
    const note = interaction.options.getString('note', true);
    context.v2.updateItem(id, { status: decision, data: { note, resolvedBy: interaction.user.id } });
    context.v2.audit(interaction.guildId, interaction.user.id, `appeal.${decision}`, note, id);
    const owner = await context.client.users.fetch(item.owner_id).catch(() => null);
    await owner?.send({ embeds: [embed(context, `Appeal ${decision}`, `Server: **${interaction.guild.name}**\nAppeal: **${id}**\n${note}`)] }).catch(() => null);
    await interaction.reply({ embeds: [successEmbed(context, 'Appeal resolved', `Appeal **${id}** was **${decision}**.`)], ephemeral: true });
  },
};

const securityCommand: BotCommand = {
  module: 'moderation',
  data: new SlashCommandBuilder()
    .setName('security')
    .setDescription('Configure anti-raid and account safety rules.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) => subcommand.setName('view').setDescription('View current protection settings.'))
    .addSubcommand((subcommand) =>
      subcommand.setName('configure').setDescription('Update server protection settings.')
        .addBooleanOption((option) => option.setName('anti_raid').setDescription('Detect join bursts.'))
        .addIntegerOption((option) => option.setName('raid_threshold').setDescription('Joins per minute before alert.').setMinValue(3).setMaxValue(100))
        .addIntegerOption((option) => option.setName('new_account_days').setDescription('Flag accounts younger than this.').setMinValue(0).setMaxValue(90))
        .addIntegerOption((option) => option.setName('mention_limit').setDescription('Maximum mentions per message.').setMinValue(2).setMaxValue(50))
        .addBooleanOption((option) => option.setName('anti_role_spam').setDescription('Detect mass role changes.')),
    ),
  async execute(interaction, context) {
    const key = 'security.config';
    const current = context.v2.getSetting(interaction.guildId, key, {
      antiRaid: false,
      raidThreshold: 8,
      newAccountDays: 3,
      mentionLimit: 6,
      antiRoleSpam: true,
    });
    if (interaction.options.getSubcommand() === 'view') {
      await interaction.reply({
        embeds: [embed(context, '🛡️ Security configuration').addFields(...fields([
          ['Anti-raid', current.antiRaid ? 'Enabled' : 'Disabled', true],
          ['Raid threshold', `${current.raidThreshold} joins/min`, true],
          ['New-account alert', `${current.newAccountDays} days`, true],
          ['Mention limit', String(current.mentionLimit), true],
          ['Mass-role detection', current.antiRoleSpam ? 'Enabled' : 'Disabled', true],
          ['Automatic response', 'Raid alerts and suspicious-account quarantine use the configured moderator/verified roles; no mass ban is performed.'],
        ]))],
        ephemeral: true,
      });
      return;
    }
    const updated = {
      antiRaid: interaction.options.getBoolean('anti_raid') ?? current.antiRaid,
      raidThreshold: interaction.options.getInteger('raid_threshold') ?? current.raidThreshold,
      newAccountDays: interaction.options.getInteger('new_account_days') ?? current.newAccountDays,
      mentionLimit: interaction.options.getInteger('mention_limit') ?? current.mentionLimit,
      antiRoleSpam: interaction.options.getBoolean('anti_role_spam') ?? current.antiRoleSpam,
    };
    context.v2.setSetting(interaction.guildId, key, updated);
    context.v2.audit(interaction.guildId, interaction.user.id, 'security.configured', JSON.stringify(updated));
    await interaction.reply({ embeds: [successEmbed(context, 'Security updated', 'The new anti-raid and account-safety rules are active.')], ephemeral: true });
  },
};

export const v2ModerationCommands: BotCommand[] = [
  banCommand,
  kickCommand,
  timeoutCommand,
  warnCommand,
  purgeCommand,
  slowmodeCommand,
  lockCommand('lock', true),
  lockCommand('unlock', false),
  nickCommand,
  appealCommand,
  securityCommand,
];

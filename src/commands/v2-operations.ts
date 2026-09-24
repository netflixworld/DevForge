import { randomInt as secureRandomInt } from 'node:crypto';
import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type GuildMember,
} from 'discord.js';
import { embed, fields, successEmbed } from '../theme.js';
import type { BotCommand } from '../types.js';
import { deny, isHttpUrl, relativeTimestamp, truncate } from '../utils.js';
import type { FeatureItem, JsonObject } from '../v2/store.js';
import { assertPublicUrl, checkPublicUrl } from '../v2/network.js';

function dueFrom(input: string): string | null {
  const match = /^(\d+)(m|h|d|w)$/i.exec(input.trim());
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2]?.toLowerCase();
  const multiplier = unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : unit === 'd' ? 86_400_000 : 604_800_000;
  const milliseconds = amount * multiplier;
  return milliseconds >= 60_000 && milliseconds <= 365 * 86_400_000
    ? new Date(Date.now() + milliseconds).toISOString()
    : null;
}

function formatItems(items: FeatureItem[], empty: string): string {
  return items.length
    ? items.map((item) => `**${item.id} • ${truncate(item.title, 90)}**\n${item.status}${item.due_at ? ` • <t:${Math.floor(new Date(item.due_at).getTime() / 1000)}:R>` : ''}`).join('\n\n')
    : empty;
}

interface MonitorData extends JsonObject {
  url: string;
  channelId: string;
  intervalMinutes: number;
  status: string;
  lastCheckedAt: string | null;
  lastLatencyMs: number | null;
  consecutiveFailures: number;
}

const uptimeCommand: BotCommand = {
  module: 'uptime',
  data: new SlashCommandBuilder()
    .setName('uptime')
    .setDescription('Monitor community websites and APIs.')
    .addSubcommand((subcommand) =>
      subcommand.setName('add').setDescription('Add a URL monitor.')
        .addStringOption((option) => option.setName('name').setDescription('Project/service name.').setRequired(true).setMaxLength(100))
        .addStringOption((option) => option.setName('url').setDescription('HTTP or HTTPS health URL.').setRequired(true).setMaxLength(400))
        .addChannelOption((option) => option.setName('channel').setDescription('Offline/recovery alerts.').setRequired(true).addChannelTypes(ChannelType.GuildText))
        .addIntegerOption((option) => option.setName('interval').setDescription('Check interval in minutes (1–60).').setMinValue(1).setMaxValue(60)),
    )
    .addSubcommand((subcommand) => subcommand.setName('list').setDescription('List configured monitors.'))
    .addSubcommand((subcommand) => subcommand.setName('check').setDescription('Check one monitor immediately.').addStringOption((option) => option.setName('id').setDescription('Monitor ID.').setRequired(true)))
    .addSubcommand((subcommand) => subcommand.setName('remove').setDescription('Disable a monitor.').addStringOption((option) => option.setName('id').setDescription('Monitor ID.').setRequired(true))),
  async execute(interaction, context) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'add') {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
        await deny(interaction, context, 'You need **Manage Server** to add uptime monitors.');
        return;
      }
      const url = interaction.options.getString('url', true);
      if (!isHttpUrl(url)) {
        await deny(interaction, context, 'Provide a valid http:// or https:// URL.');
        return;
      }
      try {
        await assertPublicUrl(url);
      } catch {
        await deny(interaction, context, 'Local and private hostnames cannot be monitored.');
        return;
      }
      const channel = interaction.options.getChannel('channel', true);
      const item = context.v2.createItem<MonitorData>({
        guildId: interaction.guildId,
        type: 'monitor',
        ownerId: interaction.user.id,
        title: interaction.options.getString('name', true),
        status: 'active',
        data: { url, channelId: channel.id, intervalMinutes: interaction.options.getInteger('interval') ?? 5, status: 'unknown', lastCheckedAt: null, lastLatencyMs: null, consecutiveFailures: 0 },
        idPrefix: 'mon',
      });
      await interaction.reply({ embeds: [successEmbed(context, 'Monitor created', `**${item.title}** is monitored as \`${item.id}\`. Alerts will be sent to ${channel}.`)], ephemeral: true });
      return;
    }
    if (subcommand === 'list') {
      const items = context.v2.listItems<MonitorData>({ guildId: interaction.guildId, type: 'monitor', limit: 30 });
      const body = items.length ? items.map((item) => `**${item.id} • ${item.title}** — ${item.status}\n${item.data.url} • service: **${item.data.status}**${item.data.lastLatencyMs === null ? '' : ` • ${item.data.lastLatencyMs} ms`}`).join('\n\n') : 'No uptime monitors configured.';
      await interaction.reply({ embeds: [embed(context, '📡 Uptime monitors', body)], ephemeral: true });
      return;
    }
    const id = interaction.options.getString('id', true);
    const item = context.v2.getItem<MonitorData>(id, 'monitor');
    if (!item || item.guild_id !== interaction.guildId) {
      await deny(interaction, context, 'Monitor not found in this server.');
      return;
    }
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
      await deny(interaction, context, 'You need **Manage Server** to change monitors.');
      return;
    }
    if (subcommand === 'remove') {
      context.v2.updateItem(item.id, { status: 'disabled' });
      await interaction.reply({ embeds: [successEmbed(context, 'Monitor disabled', `**${item.title}** will no longer be checked.`)], ephemeral: true });
      return;
    }
    await interaction.deferReply({ ephemeral: true });
    let online = false;
    let statusCode = 0;
    let latency = 0;
    try {
      const result = await checkPublicUrl(item.data.url);
      statusCode = result.status;
      online = result.online;
      latency = result.latencyMs;
    } catch {
      online = false;
    }
    context.v2.updateItem<MonitorData>(item.id, { data: { status: online ? 'online' : 'offline', lastCheckedAt: new Date().toISOString(), lastLatencyMs: latency, consecutiveFailures: online ? 0 : item.data.consecutiveFailures + 1 } });
    await interaction.editReply({ embeds: [embed(context, online ? '🟢 Service online' : '🔴 Service unavailable', `**${item.title}** • HTTP ${statusCode || 'no response'} • ${latency} ms\n${item.data.url}`).setColor(online ? 0x22c55e : 0xef4444)] });
  },
};

interface ReminderData extends JsonObject {
  message: string;
  channelId: string;
  repeat: string;
  project: string | null;
}

const remindCommand: BotCommand = {
  module: 'reminders',
  data: new SlashCommandBuilder()
    .setName('remind')
    .setDescription('Create personal, recurring, or project reminders.')
    .addSubcommand((subcommand) =>
      subcommand.setName('create').setDescription('Create a reminder.')
        .addStringOption((option) => option.setName('when').setDescription('Examples: 20m, 2h, 3d, 1w.').setRequired(true).setMaxLength(10))
        .addStringOption((option) => option.setName('message').setDescription('What should the bot remind you about?').setRequired(true).setMaxLength(500))
        .addStringOption((option) => option.setName('repeat').setDescription('Optional recurrence.').addChoices(
          { name: 'Never', value: 'none' }, { name: 'Daily', value: 'daily' }, { name: 'Weekly', value: 'weekly' }, { name: 'Monthly (30 days)', value: 'monthly' },
        ))
        .addStringOption((option) => option.setName('project').setDescription('Optional project name or ID.').setMaxLength(100)),
    )
    .addSubcommand((subcommand) => subcommand.setName('list').setDescription('List your active reminders.'))
    .addSubcommand((subcommand) => subcommand.setName('cancel').setDescription('Cancel a reminder.').addStringOption((option) => option.setName('id').setDescription('Reminder ID.').setRequired(true))),
  async execute(interaction, context) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'create') {
      const dueAt = dueFrom(interaction.options.getString('when', true));
      if (!dueAt) {
        await deny(interaction, context, 'Use a future duration such as `20m`, `2h`, `3d`, or `1w`.');
        return;
      }
      const message = interaction.options.getString('message', true);
      const item = context.v2.createItem<ReminderData>({
        guildId: interaction.guildId,
        type: 'reminder',
        ownerId: interaction.user.id,
        title: truncate(message, 100),
        status: 'active',
        dueAt,
        data: { message, channelId: interaction.channelId, repeat: interaction.options.getString('repeat') ?? 'none', project: interaction.options.getString('project') },
        idPrefix: 'rem',
      });
      await interaction.reply({ embeds: [successEmbed(context, 'Reminder scheduled', `**${item.id}** will trigger <t:${Math.floor(new Date(dueAt).getTime() / 1000)}:R>.`)], ephemeral: true });
      return;
    }
    if (subcommand === 'list') {
      const items = context.v2.listItems({ guildId: interaction.guildId, type: 'reminder', ownerId: interaction.user.id, status: 'active', limit: 30 });
      await interaction.reply({ embeds: [embed(context, '⏱️ Your reminders', formatItems(items, 'No active reminders.'))], ephemeral: true });
      return;
    }
    const id = interaction.options.getString('id', true);
    const item = context.v2.getItem(id, 'reminder');
    if (!item || item.guild_id !== interaction.guildId || item.owner_id !== interaction.user.id) {
      await deny(interaction, context, 'Reminder not found or not owned by you.');
      return;
    }
    context.v2.updateItem(id, { status: 'cancelled' });
    await interaction.reply({ embeds: [successEmbed(context, 'Reminder cancelled', `**${id}** will not trigger.`)], ephemeral: true });
  },
};

interface EventData extends JsonObject {
  description: string;
  channelId: string;
  capacity: number;
  remindersSent: number;
}

const eventCommand: BotCommand = {
  module: 'events',
  data: new SlashCommandBuilder()
    .setName('event')
    .setDescription('Create events with registration, waitlists, reminders, and check-in.')
    .addSubcommand((subcommand) =>
      subcommand.setName('create').setDescription('Create a community event.')
        .addStringOption((option) => option.setName('title').setDescription('Event title.').setRequired(true).setMaxLength(100))
        .addStringOption((option) => option.setName('description').setDescription('What will happen?').setRequired(true).setMaxLength(800))
        .addStringOption((option) => option.setName('starts_in').setDescription('Examples: 2h, 3d, 1w.').setRequired(true).setMaxLength(10))
        .addIntegerOption((option) => option.setName('capacity').setDescription('Maximum participants.').setRequired(true).setMinValue(1).setMaxValue(1000)),
    )
    .addSubcommand((subcommand) => subcommand.setName('list').setDescription('Browse upcoming events.'))
    .addSubcommand((subcommand) => subcommand.setName('join').setDescription('Register for an event.').addStringOption((option) => option.setName('id').setDescription('Event ID.').setRequired(true)))
    .addSubcommand((subcommand) => subcommand.setName('leave').setDescription('Leave an event or waiting list.').addStringOption((option) => option.setName('id').setDescription('Event ID.').setRequired(true)))
    .addSubcommand((subcommand) => subcommand.setName('checkin').setDescription('Check in when an event starts.').addStringOption((option) => option.setName('id').setDescription('Event ID.').setRequired(true)))
    .addSubcommand((subcommand) => subcommand.setName('cancel').setDescription('Cancel an event you manage.').addStringOption((option) => option.setName('id').setDescription('Event ID.').setRequired(true))),
  async execute(interaction, context) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'create') {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageEvents)) {
        await deny(interaction, context, 'You need **Manage Events** to create a scheduled event.');
        return;
      }
      const dueAt = dueFrom(interaction.options.getString('starts_in', true));
      if (!dueAt) {
        await deny(interaction, context, 'Use a valid future duration such as `2h`, `3d`, or `1w`.');
        return;
      }
      const item = context.v2.createItem<EventData>({
        guildId: interaction.guildId,
        type: 'event',
        ownerId: interaction.user.id,
        title: interaction.options.getString('title', true),
        status: 'registration',
        dueAt,
        data: { description: interaction.options.getString('description', true), channelId: interaction.channelId, capacity: interaction.options.getInteger('capacity', true), remindersSent: 0 },
        idPrefix: 'evt',
      });
      await interaction.reply({ embeds: [embed(context, `📆 ${item.title}`, item.data.description).addFields(...fields([
        ['ID', `\`${item.id}\``, true], ['Starts', `<t:${Math.floor(new Date(dueAt).getTime() / 1000)}:F>`, true], ['Capacity', String(item.data.capacity), true], ['Register', `Use \`/event join id:${item.id}\``],
      ]))] });
      return;
    }
    if (subcommand === 'list') {
      const items = context.v2.listItems({ guildId: interaction.guildId, type: 'event', limit: 30 }).filter((item) => ['registration', 'running'].includes(item.status));
      await interaction.reply({ embeds: [embed(context, '📆 Upcoming events', formatItems(items, 'No upcoming events.'))] });
      return;
    }
    const id = interaction.options.getString('id', true);
    const item = context.v2.getItem<EventData>(id, 'event');
    if (!item || item.guild_id !== interaction.guildId) {
      await deny(interaction, context, 'Event not found in this server.');
      return;
    }
    if (subcommand === 'join') {
      const members = context.v2.listMembers(item.id);
      const active = members.filter((member) => member.status === 'registered').length;
      const status = active < item.data.capacity ? 'registered' : 'waiting';
      context.v2.setMember({ itemId: item.id, userId: interaction.user.id, role: 'participant', status });
      await interaction.reply({ embeds: [successEmbed(context, status === 'registered' ? 'Registration confirmed' : 'Added to waiting list', status === 'registered' ? `You are registered for **${item.title}**.` : `The event is full; you are waiting at position **${members.filter((member) => member.status === 'waiting').length + 1}**.`)], ephemeral: true });
      return;
    }
    if (subcommand === 'leave') {
      context.v2.removeMember(item.id, interaction.user.id);
      const waiting = context.v2.listMembers(item.id).find((member) => member.status === 'waiting');
      if (waiting) context.v2.setMember({ itemId: item.id, userId: waiting.user_id, role: 'participant', status: 'registered', data: waiting.data });
      await interaction.reply({ embeds: [successEmbed(context, 'Event left', `You are no longer registered for **${item.title}**.`)], ephemeral: true });
      return;
    }
    if (subcommand === 'checkin') {
      const membership = context.v2.getMember(item.id, interaction.user.id);
      if (!membership || membership.status !== 'registered') {
        await deny(interaction, context, 'You must be registered before checking in.');
        return;
      }
      context.v2.setMember({ itemId: item.id, userId: interaction.user.id, role: 'participant', status: 'checked_in', data: membership.data });
      await interaction.reply({ embeds: [successEmbed(context, 'Checked in', `Welcome to **${item.title}**.`)], ephemeral: true });
      return;
    }
    if (item.owner_id !== interaction.user.id && !interaction.memberPermissions.has(PermissionFlagsBits.ManageEvents)) {
      await deny(interaction, context, 'Only the event owner or event managers can cancel it.');
      return;
    }
    context.v2.updateItem(item.id, { status: 'cancelled' });
    await interaction.reply({ embeds: [successEmbed(context, 'Event cancelled', `**${item.title}** was cancelled.`)] });
  },
};

interface GiveawayData extends JsonObject {
  prize: string;
  winners: number;
  requiredRoleId: string | null;
  channelId: string;
  winnerIds: string[];
}

function pickWinners(entries: string[], count: number): string[] {
  const pool = [...new Set(entries)];
  const winners: string[] = [];
  while (pool.length && winners.length < count) {
    winners.push(pool.splice(secureRandomInt(pool.length), 1)[0]!);
  }
  return winners;
}

const giveawayCommand: BotCommand = {
  module: 'giveaways',
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Run fair community giveaways with role requirements and rerolls.')
    .addSubcommand((subcommand) =>
      subcommand.setName('create').setDescription('Create a giveaway.')
        .addStringOption((option) => option.setName('prize').setDescription('Prize or benefit.').setRequired(true).setMaxLength(200))
        .addStringOption((option) => option.setName('duration').setDescription('Examples: 30m, 2h, 3d.').setRequired(true).setMaxLength(10))
        .addIntegerOption((option) => option.setName('winners').setDescription('Number of winners.').setRequired(true).setMinValue(1).setMaxValue(20))
        .addRoleOption((option) => option.setName('required_role').setDescription('Optional required role.')),
    )
    .addSubcommand((subcommand) => subcommand.setName('join').setDescription('Enter a giveaway.').addStringOption((option) => option.setName('id').setDescription('Giveaway ID.').setRequired(true)))
    .addSubcommand((subcommand) => subcommand.setName('draw').setDescription('End and draw a giveaway.').addStringOption((option) => option.setName('id').setDescription('Giveaway ID.').setRequired(true)))
    .addSubcommand((subcommand) => subcommand.setName('reroll').setDescription('Draw new winners.').addStringOption((option) => option.setName('id').setDescription('Giveaway ID.').setRequired(true)))
    .addSubcommand((subcommand) => subcommand.setName('list').setDescription('List active giveaways.')),
  async execute(interaction, context) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'create') {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageEvents)) {
        await deny(interaction, context, 'You need **Manage Events** to create giveaways.');
        return;
      }
      const dueAt = dueFrom(interaction.options.getString('duration', true));
      if (!dueAt) {
        await deny(interaction, context, 'Use a duration such as `30m`, `2h`, or `3d`.');
        return;
      }
      const role = interaction.options.getRole('required_role');
      const item = context.v2.createItem<GiveawayData>({
        guildId: interaction.guildId,
        type: 'giveaway', ownerId: interaction.user.id, title: interaction.options.getString('prize', true), status: 'active', dueAt,
        data: { prize: interaction.options.getString('prize', true), winners: interaction.options.getInteger('winners', true), requiredRoleId: role?.id ?? null, channelId: interaction.channelId, winnerIds: [] }, idPrefix: 'gaw',
      });
      await interaction.reply({ embeds: [embed(context, `🎉 Giveaway • ${item.data.prize}`, `Enter with \`/giveaway join id:${item.id}\`.`).addFields(...fields([
        ['Ends', `<t:${Math.floor(new Date(dueAt).getTime() / 1000)}:R>`, true], ['Winners', String(item.data.winners), true], ['Requirement', role ? `${role}` : 'None', true], ['ID', `\`${item.id}\``, true],
      ]))] });
      return;
    }
    if (subcommand === 'list') {
      await interaction.reply({ embeds: [embed(context, '🎉 Active giveaways', formatItems(context.v2.listItems({ guildId: interaction.guildId, type: 'giveaway', status: 'active', limit: 20 }), 'No active giveaways.'))] });
      return;
    }
    const id = interaction.options.getString('id', true);
    const item = context.v2.getItem<GiveawayData>(id, 'giveaway');
    if (!item || item.guild_id !== interaction.guildId) {
      await deny(interaction, context, 'Giveaway not found in this server.');
      return;
    }
    if (subcommand === 'join') {
      if (item.status !== 'active') {
        await deny(interaction, context, 'This giveaway has ended.');
        return;
      }
      const member = interaction.member as GuildMember;
      if (item.data.requiredRoleId && !member.roles.cache.has(item.data.requiredRoleId)) {
        await deny(interaction, context, `You need <@&${item.data.requiredRoleId}> to enter.`);
        return;
      }
      context.v2.setMember({ itemId: item.id, userId: interaction.user.id, role: 'entrant' });
      await interaction.reply({ embeds: [successEmbed(context, 'Entry confirmed', `You entered the giveaway for **${item.data.prize}**.`)], ephemeral: true });
      return;
    }
    if (item.owner_id !== interaction.user.id && !interaction.memberPermissions.has(PermissionFlagsBits.ManageEvents)) {
      await deny(interaction, context, 'Only the giveaway owner or event managers can draw winners.');
      return;
    }
    const entries = context.v2.listMembers(item.id).map((entry) => entry.user_id).filter((userId) => !item.data.winnerIds.includes(userId));
    const winners = pickWinners(entries, item.data.winners);
    if (!winners.length) {
      await deny(interaction, context, 'There are no eligible entries to draw.');
      return;
    }
    context.v2.updateItem<GiveawayData>(item.id, { status: 'ended', data: { winnerIds: winners } });
    await interaction.reply({ embeds: [embed(context, subcommand === 'reroll' ? '🎉 Giveaway rerolled' : '🎉 Giveaway winners', `Prize: **${item.data.prize}**\nWinners: ${winners.map((idValue) => `<@${idValue}>`).join(', ')}`)] });
  },
};

interface PollData extends JsonObject {
  question: string;
  options: string[];
  multiple: boolean;
  anonymous: boolean;
  requiredRoleId: string | null;
}

const pollCommand: BotCommand = {
  module: 'polls',
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Create advanced timed polls.')
    .addSubcommand((subcommand) =>
      subcommand.setName('create').setDescription('Create a poll with 2–10 options.')
        .addStringOption((option) => option.setName('question').setDescription('Poll question.').setRequired(true).setMaxLength(200))
        .addStringOption((option) => option.setName('options').setDescription('Options separated by |').setRequired(true).setMaxLength(800))
        .addStringOption((option) => option.setName('duration').setDescription('Examples: 30m, 1d.').setRequired(true).setMaxLength(10))
        .addBooleanOption((option) => option.setName('multiple').setDescription('Allow multiple choices.'))
        .addBooleanOption((option) => option.setName('anonymous').setDescription('Hide voter identities in results.'))
        .addRoleOption((option) => option.setName('required_role').setDescription('Optional role required to vote.')),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('vote').setDescription('Vote using option numbers, such as 1 or 1,3.')
        .addStringOption((option) => option.setName('id').setDescription('Poll ID.').setRequired(true))
        .addStringOption((option) => option.setName('choices').setDescription('One or more option numbers.').setRequired(true).setMaxLength(30)),
    )
    .addSubcommand((subcommand) => subcommand.setName('results').setDescription('View poll results.').addStringOption((option) => option.setName('id').setDescription('Poll ID.').setRequired(true)))
    .addSubcommand((subcommand) => subcommand.setName('close').setDescription('Close a poll.').addStringOption((option) => option.setName('id').setDescription('Poll ID.').setRequired(true))),
  async execute(interaction, context) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'create') {
      const options = interaction.options.getString('options', true).split('|').map((option) => option.trim()).filter(Boolean);
      const dueAt = dueFrom(interaction.options.getString('duration', true));
      if (options.length < 2 || options.length > 10 || !dueAt) {
        await deny(interaction, context, 'Provide 2–10 `|`-separated options and a valid duration such as `30m` or `1d`.');
        return;
      }
      const requiredRole = interaction.options.getRole('required_role');
      const item = context.v2.createItem<PollData>({
        guildId: interaction.guildId, type: 'poll', ownerId: interaction.user.id, title: interaction.options.getString('question', true), status: 'open', dueAt,
        data: { question: interaction.options.getString('question', true), options, multiple: interaction.options.getBoolean('multiple') ?? false, anonymous: interaction.options.getBoolean('anonymous') ?? false, requiredRoleId: requiredRole?.id ?? null }, idPrefix: 'poll',
      });
      await interaction.reply({ embeds: [embed(context, `📊 ${item.data.question}`, options.map((option, index) => `**${index + 1}.** ${option}`).join('\n')).addFields(...fields([
        ['Vote', `Use \`/poll vote id:${item.id}\` with an option number${item.data.multiple ? ' or comma-separated numbers' : ''}.`], ['Ends', `<t:${Math.floor(new Date(dueAt).getTime() / 1000)}:R>`, true], ['Mode', `${item.data.multiple ? 'Multiple' : 'Single'} • ${item.data.anonymous ? 'Anonymous' : 'Public'}`, true],
      ]))] });
      return;
    }
    const id = interaction.options.getString('id', true);
    const item = context.v2.getItem<PollData>(id, 'poll');
    if (!item || item.guild_id !== interaction.guildId) {
      await deny(interaction, context, 'Poll not found in this server.');
      return;
    }
    if (subcommand === 'vote') {
      if (item.status !== 'open' || (item.due_at && new Date(item.due_at).getTime() <= Date.now())) {
        await deny(interaction, context, 'This poll is closed.');
        return;
      }
      const member = interaction.member as GuildMember;
      if (item.data.requiredRoleId && !member.roles.cache.has(item.data.requiredRoleId)) {
        await deny(interaction, context, `You need <@&${item.data.requiredRoleId}> to vote.`);
        return;
      }
      const choices = [...new Set(interaction.options.getString('choices', true).split(',').map((value) => Number(value.trim()) - 1))];
      if (!choices.length || choices.some((value) => !Number.isInteger(value) || value < 0 || value >= item.data.options.length) || (!item.data.multiple && choices.length > 1)) {
        await deny(interaction, context, `Choose ${item.data.multiple ? 'one or more valid option numbers' : 'exactly one valid option number'}.`);
        return;
      }
      context.v2.vote(item.id, interaction.user.id, choices.sort((a, b) => a - b).join(','));
      await interaction.reply({ embeds: [successEmbed(context, 'Vote saved', `Selected: ${choices.map((choice) => `**${choice + 1}. ${item.data.options[choice]}**`).join(', ')}`)], ephemeral: true });
      return;
    }
    if (subcommand === 'close') {
      if (item.owner_id !== interaction.user.id && !interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages)) {
        await deny(interaction, context, 'Only the poll author or moderators can close it.');
        return;
      }
      context.v2.updateItem(item.id, { status: 'closed' });
    }
    const totals = item.data.options.map(() => 0);
    const votes = context.v2.votes(item.id);
    for (const vote of votes) {
      for (const choice of vote.value.split(',').map(Number)) if (totals[choice] !== undefined) totals[choice] += 1;
    }
    const body = item.data.options.map((option, index) => `**${index + 1}. ${option}** — ${totals[index]} vote(s)`).join('\n');
    await interaction.reply({ embeds: [embed(context, `📊 ${item.data.question}`, `${body}\n\n**Voters:** ${votes.length} • **Status:** ${subcommand === 'close' ? 'closed' : item.status}`)] });
  },
};

const suggestionCommand: BotCommand = {
  module: 'suggestions',
  data: new SlashCommandBuilder()
    .setName('suggest')
    .setDescription('Submit and manage community suggestions.')
    .addSubcommand((subcommand) =>
      subcommand.setName('create').setDescription('Submit a suggestion.')
        .addStringOption((option) => option.setName('title').setDescription('Suggestion title.').setRequired(true).setMaxLength(100))
        .addStringOption((option) => option.setName('description').setDescription('Explain the benefit and tradeoffs.').setRequired(true).setMaxLength(1000)),
    )
    .addSubcommand((subcommand) => subcommand.setName('list').setDescription('Browse suggestions.'))
    .addSubcommand((subcommand) =>
      subcommand.setName('vote').setDescription('Support or oppose a suggestion.')
        .addStringOption((option) => option.setName('id').setDescription('Suggestion ID.').setRequired(true))
        .addStringOption((option) => option.setName('vote').setDescription('Vote.').setRequired(true).addChoices({ name: 'Support', value: 'up' }, { name: 'Oppose', value: 'down' })),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('status').setDescription('Post an official staff response.')
        .addStringOption((option) => option.setName('id').setDescription('Suggestion ID.').setRequired(true))
        .addStringOption((option) => option.setName('state').setDescription('State.').setRequired(true).addChoices(
          { name: 'Under review', value: 'review' }, { name: 'Planned', value: 'planned' }, { name: 'Implemented', value: 'implemented' }, { name: 'Declined', value: 'declined' },
        ))
        .addStringOption((option) => option.setName('response').setDescription('Official explanation.').setRequired(true).setMaxLength(700)),
    ),
  async execute(interaction, context) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'create') {
      const item = context.v2.createItem({ guildId: interaction.guildId, type: 'suggestion', ownerId: interaction.user.id, title: interaction.options.getString('title', true), status: 'open', data: { description: interaction.options.getString('description', true), response: '' }, idPrefix: 'sug' });
      await interaction.reply({ embeds: [embed(context, `💬 Suggestion • ${item.title}`, String(item.data['description'])).addFields(...fields([['ID', `\`${item.id}\``, true], ['Author', `${interaction.user}`, true], ['Vote', `Use \`/suggest vote id:${item.id}\`.`]]))] });
      return;
    }
    if (subcommand === 'list') {
      await interaction.reply({ embeds: [embed(context, '💬 Community suggestions', formatItems(context.v2.listItems({ guildId: interaction.guildId, type: 'suggestion', limit: 20 }), 'No suggestions yet.'))] });
      return;
    }
    const id = interaction.options.getString('id', true);
    const item = context.v2.getItem(id, 'suggestion');
    if (!item || item.guild_id !== interaction.guildId) {
      await deny(interaction, context, 'Suggestion not found.');
      return;
    }
    if (subcommand === 'vote') {
      const value = interaction.options.getString('vote', true);
      const result = context.v2.vote(item.id, interaction.user.id, value);
      await interaction.reply({ embeds: [successEmbed(context, result.created ? 'Vote recorded' : 'Vote removed', `Current **${value}** votes: ${result.total}.`)], ephemeral: true });
      return;
    }
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages)) {
      await deny(interaction, context, 'You need **Manage Messages** to post an official response.');
      return;
    }
    const state = interaction.options.getString('state', true);
    const response = interaction.options.getString('response', true);
    context.v2.updateItem(item.id, { status: state, data: { response, respondedBy: interaction.user.id } });
    await interaction.reply({ embeds: [embed(context, `💬 Suggestion ${state} • ${item.title}`, response).addFields({ name: 'Official response by', value: `${interaction.user}` })] });
  },
};

interface StarboardData extends JsonObject {
  channelId: string;
  emoji: string;
  threshold: number;
  label: string;
}

const starboardCommand: BotCommand = {
  module: 'starboard',
  data: new SlashCommandBuilder()
    .setName('starboard')
    .setDescription('Configure multiple categorized starboards.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) =>
      subcommand.setName('add').setDescription('Add a starboard route.')
        .addStringOption((option) => option.setName('category').setDescription('Funny, Useful, Showcase...').setRequired(true).setMaxLength(50))
        .addStringOption((option) => option.setName('emoji').setDescription('Unicode emoji such as ⭐ or 💡.').setRequired(true).setMaxLength(20))
        .addIntegerOption((option) => option.setName('threshold').setDescription('Required reactions.').setRequired(true).setMinValue(2).setMaxValue(50))
        .addChannelOption((option) => option.setName('channel').setDescription('Destination channel.').setRequired(true).addChannelTypes(ChannelType.GuildText)),
    )
    .addSubcommand((subcommand) => subcommand.setName('list').setDescription('List configured starboards.'))
    .addSubcommand((subcommand) => subcommand.setName('remove').setDescription('Remove a starboard route.').addStringOption((option) => option.setName('id').setDescription('Starboard ID.').setRequired(true))),
  async execute(interaction, context) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'add') {
      const channel = interaction.options.getChannel('channel', true);
      const item = context.v2.createItem<StarboardData>({ guildId: interaction.guildId, type: 'starboard_board', ownerId: interaction.user.id, title: interaction.options.getString('category', true), data: {
        channelId: channel.id, emoji: interaction.options.getString('emoji', true), threshold: interaction.options.getInteger('threshold', true), label: interaction.options.getString('category', true),
      }, idPrefix: 'star' });
      await interaction.reply({ embeds: [successEmbed(context, 'Starboard added', `**${item.title}** uses ${item.data.emoji} × ${item.data.threshold} and posts to ${channel}.`)], ephemeral: true });
      return;
    }
    if (subcommand === 'list') {
      const items = context.v2.listItems<StarboardData>({ guildId: interaction.guildId, type: 'starboard_board', status: 'active', limit: 20 });
      const body = items.length ? items.map((item) => `**${item.id} • ${item.title}** — ${item.data.emoji} × ${item.data.threshold} → <#${item.data.channelId}>`).join('\n') : 'No v2 starboards configured; the legacy ⭐ starboard remains available.';
      await interaction.reply({ embeds: [embed(context, '⭐ Starboard routes', body)], ephemeral: true });
      return;
    }
    const id = interaction.options.getString('id', true);
    const item = context.v2.getItem(id, 'starboard_board');
    if (!item || item.guild_id !== interaction.guildId) {
      await deny(interaction, context, 'Starboard route not found.');
      return;
    }
    context.v2.updateItem(id, { status: 'disabled' });
    await interaction.reply({ embeds: [successEmbed(context, 'Starboard removed', `Route **${id}** is disabled.`)], ephemeral: true });
  },
};

const voiceCommand: BotCommand = {
  module: 'voice',
  data: new SlashCommandBuilder()
    .setName('voice')
    .setDescription('Configure and control temporary voice rooms.')
    .addSubcommand((subcommand) =>
      subcommand.setName('setup').setDescription('Choose a join-to-create voice channel.')
        .addChannelOption((option) => option.setName('trigger').setDescription('Members join this channel to create a room.').setRequired(true).addChannelTypes(ChannelType.GuildVoice))
        .addChannelOption((option) => option.setName('category').setDescription('Category for temporary rooms.').addChannelTypes(ChannelType.GuildCategory)),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('name').setDescription('Rename your temporary room.')
        .addStringOption((option) => option.setName('name').setDescription('New room name.').setRequired(true).setMaxLength(100)),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('limit').setDescription('Set your room user limit.')
        .addIntegerOption((option) => option.setName('count').setDescription('0 means unlimited.').setRequired(true).setMinValue(0).setMaxValue(99)),
    )
    .addSubcommand((subcommand) => subcommand.setName('lock').setDescription('Lock your room.'))
    .addSubcommand((subcommand) => subcommand.setName('unlock').setDescription('Unlock your room.'))
    .addSubcommand((subcommand) => subcommand.setName('allow').setDescription('Whitelist a member for your room.').addUserOption((option) => option.setName('member').setDescription('Member to allow.').setRequired(true)))
    .addSubcommand((subcommand) => subcommand.setName('deny').setDescription('Remove a member and deny access.').addUserOption((option) => option.setName('member').setDescription('Member to deny.').setRequired(true)))
    .addSubcommand((subcommand) => subcommand.setName('transfer').setDescription('Transfer room ownership.').addUserOption((option) => option.setName('member').setDescription('New owner in the room.').setRequired(true))),
  async execute(interaction, context) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'setup') {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageChannels)) {
        await deny(interaction, context, 'You need **Manage Channels** to configure temporary voice.');
        return;
      }
      const trigger = interaction.options.getChannel('trigger', true);
      const category = interaction.options.getChannel('category');
      context.v2.setSetting(interaction.guildId, 'voice.triggerChannelId', trigger.id);
      context.v2.setSetting(interaction.guildId, 'voice.categoryId', category?.id ?? '');
      await interaction.reply({ embeds: [successEmbed(context, 'Temporary voice enabled', `Joining ${trigger} now creates an owned temporary room.`)], ephemeral: true });
      return;
    }
    const member = interaction.member as GuildMember;
    const channel = member.voice.channel;
    if (!channel || context.runtime.voiceOwners.get(channel.id) !== interaction.user.id) {
      await deny(interaction, context, 'Join a temporary room that you own first.');
      return;
    }
    if (subcommand === 'name') await channel.setName(interaction.options.getString('name', true), 'Temporary room owner control');
    else if (subcommand === 'limit') await channel.setUserLimit(interaction.options.getInteger('count', true), 'Temporary room owner control');
    else if (subcommand === 'lock' || subcommand === 'unlock') {
      await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: subcommand === 'lock' ? false : null });
    } else if (subcommand === 'allow' || subcommand === 'deny') {
      const target = interaction.options.getMember('member') as GuildMember | null;
      if (!target || target.user.bot) {
        await deny(interaction, context, 'Choose a human member from this server.');
        return;
      }
      await channel.permissionOverwrites.edit(target.id, { Connect: subcommand === 'allow' ? true : false, ViewChannel: true });
      if (subcommand === 'deny' && target.voice.channelId === channel.id) await target.voice.disconnect('Removed by temporary room owner').catch(() => null);
    } else {
      const target = interaction.options.getMember('member') as GuildMember | null;
      if (!target || target.voice.channelId !== channel.id) {
        await deny(interaction, context, 'The new owner must currently be in your room.');
        return;
      }
      context.runtime.voiceOwners.set(channel.id, target.id);
      await channel.permissionOverwrites.edit(interaction.user.id, { ManageChannels: null });
      await channel.permissionOverwrites.edit(target.id, { ManageChannels: true, MoveMembers: true });
    }
    await interaction.reply({ embeds: [successEmbed(context, 'Voice room updated', `Changes applied to **${channel.name}**.`)], ephemeral: true });
  },
};

const autoThreadCommand: BotCommand = {
  module: 'threads',
  data: new SlashCommandBuilder()
    .setName('autothread')
    .setDescription('Turn messages in selected channels into organized threads.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addSubcommand((subcommand) =>
      subcommand.setName('add').setDescription('Enable auto threads in a channel.')
        .addChannelOption((option) => option.setName('channel').setDescription('Source channel.').setRequired(true).addChannelTypes(ChannelType.GuildText))
        .addStringOption((option) => option.setName('prefix').setDescription('Optional thread-name prefix.').setMaxLength(30)),
    )
    .addSubcommand((subcommand) => subcommand.setName('list').setDescription('List auto-thread channels.'))
    .addSubcommand((subcommand) => subcommand.setName('remove').setDescription('Disable auto threads.').addChannelOption((option) => option.setName('channel').setDescription('Source channel.').setRequired(true).addChannelTypes(ChannelType.GuildText))),
  async execute(interaction, context) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'list') {
      const items = context.v2.listItems({ guildId: interaction.guildId, type: 'autothread', status: 'active', limit: 50 });
      const body = items.length ? items.map((item) => `<#${String(item.data['channelId'])}> • prefix: **${String(item.data['prefix'] || 'none')}**`).join('\n') : 'No auto-thread channels configured.';
      await interaction.reply({ embeds: [embed(context, '🧵 Auto-thread channels', body)], ephemeral: true });
      return;
    }
    const channel = interaction.options.getChannel('channel', true);
    const existing = context.v2.listItems({ guildId: interaction.guildId, type: 'autothread', limit: 100 }).find((item) => item.data['channelId'] === channel.id);
    if (subcommand === 'remove') {
      if (existing) context.v2.updateItem(existing.id, { status: 'disabled' });
      await interaction.reply({ embeds: [successEmbed(context, 'Auto threads disabled', `${channel} will no longer create threads automatically.`)], ephemeral: true });
      return;
    }
    const prefix = interaction.options.getString('prefix') ?? '';
    if (existing) context.v2.updateItem(existing.id, { status: 'active', data: { prefix } });
    else context.v2.createItem({ guildId: interaction.guildId, type: 'autothread', ownerId: interaction.user.id, title: channel.name, data: { channelId: channel.id, prefix }, idPrefix: 'thread' });
    await interaction.reply({ embeds: [successEmbed(context, 'Auto threads enabled', `New messages in ${channel} will receive a discussion thread.`)], ephemeral: true });
  },
};

const digestCommand: BotCommand = {
  module: 'digest',
  data: new SlashCommandBuilder()
    .setName('digest')
    .setDescription('Configure daily or weekly community summaries.')
    .addSubcommand((subcommand) =>
      subcommand.setName('configure').setDescription('Choose digest channel and schedule.')
        .addChannelOption((option) => option.setName('channel').setDescription('Digest destination.').setRequired(true).addChannelTypes(ChannelType.GuildText))
        .addStringOption((option) => option.setName('frequency').setDescription('Frequency.').setRequired(true).addChoices({ name: 'Daily', value: 'daily' }, { name: 'Weekly', value: 'weekly' })),
    )
    .addSubcommand((subcommand) => subcommand.setName('now').setDescription('Generate a digest immediately.'))
    .addSubcommand((subcommand) => subcommand.setName('disable').setDescription('Disable scheduled digests.')),
  async execute(interaction, context) {
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
      await deny(interaction, context, 'You need **Manage Server** to configure digests.');
      return;
    }
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'configure') {
      const channel = interaction.options.getChannel('channel', true);
      const frequency = interaction.options.getString('frequency', true);
      context.v2.setSetting(interaction.guildId, 'digest.config', { enabled: true, channelId: channel.id, frequency, lastSentAt: null });
      await interaction.reply({ embeds: [successEmbed(context, 'Digest scheduled', `${frequency === 'daily' ? 'Daily' : 'Weekly'} summaries will be posted to ${channel}.`)], ephemeral: true });
      return;
    }
    if (subcommand === 'disable') {
      const current = context.v2.getSetting(interaction.guildId, 'digest.config', { enabled: false, channelId: '', frequency: 'weekly', lastSentAt: null });
      context.v2.setSetting(interaction.guildId, 'digest.config', { ...current, enabled: false });
      await interaction.reply({ embeds: [successEmbed(context, 'Digest disabled', 'No scheduled summaries will be posted.')], ephemeral: true });
      return;
    }
    const analytics = context.v2.analytics(interaction.guildId, 7);
    const projects = context.db.getInsights(interaction.guildId);
    const releases = context.v2.listItems({ guildId: interaction.guildId, type: 'release_event', limit: 5 });
    const events = context.v2.listItems({ guildId: interaction.guildId, type: 'event', limit: 5 }).filter((item) => ['registration', 'running'].includes(item.status));
    await interaction.reply({ embeds: [embed(context, '📰 Community digest').addFields(...fields([
      ['Activity', `**${analytics.messages}** messages from **${analytics.activeMembers}** active members.`],
      ['Top channels', analytics.channels.slice(0, 5).map((item) => `<#${item.channel_id}> • ${item.messages}`).join('\n') || 'No recorded activity.'],
      ['Building together', `**${projects.projects}** projects • **${projects.openReviews}** open reviews • **${projects.pairSessions}** pair sessions`],
      ['Upcoming events', events.map((item) => `**${item.title}** ${item.due_at ? relativeTimestamp(item.due_at) : ''}`).join('\n') || 'No upcoming events.'],
      ['Recent releases', releases.map((item) => `**${item.title}**`).join('\n') || 'No recorded releases.'],
    ]))] });
  },
};

interface ReleaseData extends JsonObject {
  repository: string;
  channelId: string;
}

const releaseCommand: BotCommand = {
  module: 'releases',
  data: new SlashCommandBuilder()
    .setName('release')
    .setDescription('Route GitHub release notifications by repository.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) =>
      subcommand.setName('subscribe').setDescription('Subscribe a channel to releases.')
        .addStringOption((option) => option.setName('repository').setDescription('owner/repository').setRequired(true).setMaxLength(150))
        .addChannelOption((option) => option.setName('channel').setDescription('Release destination.').setRequired(true).addChannelTypes(ChannelType.GuildText)),
    )
    .addSubcommand((subcommand) => subcommand.setName('list').setDescription('List release subscriptions.'))
    .addSubcommand((subcommand) => subcommand.setName('remove').setDescription('Remove a release subscription.').addStringOption((option) => option.setName('id').setDescription('Subscription ID.').setRequired(true))),
  async execute(interaction, context) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'subscribe') {
      const repository = interaction.options.getString('repository', true).toLowerCase();
      if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) {
        await deny(interaction, context, 'Use the `owner/repository` format.');
        return;
      }
      const channel = interaction.options.getChannel('channel', true);
      const item = context.v2.createItem<ReleaseData>({ guildId: interaction.guildId, type: 'release_subscription', ownerId: interaction.user.id, title: repository, data: { repository, channelId: channel.id }, idPrefix: 'rel' });
      await interaction.reply({ embeds: [successEmbed(context, 'Release feed subscribed', `Releases from **${repository}** will post to ${channel}. Subscription: **${item.id}**.`)], ephemeral: true });
      return;
    }
    if (subcommand === 'list') {
      const items = context.v2.listItems<ReleaseData>({ guildId: interaction.guildId, type: 'release_subscription', status: 'active', limit: 50 });
      const body = items.length ? items.map((item) => `**${item.id}** • ${item.data.repository} → <#${item.data.channelId}>`).join('\n') : 'No repository-specific release feeds.';
      await interaction.reply({ embeds: [embed(context, '📣 Release feeds', body)], ephemeral: true });
      return;
    }
    const id = interaction.options.getString('id', true);
    const item = context.v2.getItem(id, 'release_subscription');
    if (!item || item.guild_id !== interaction.guildId) {
      await deny(interaction, context, 'Release subscription not found.');
      return;
    }
    context.v2.updateItem(id, { status: 'disabled' });
    await interaction.reply({ embeds: [successEmbed(context, 'Release feed removed', `Subscription **${id}** is disabled.`)], ephemeral: true });
  },
};

export const v2OperationsCommands: BotCommand[] = [
  uptimeCommand,
  remindCommand,
  eventCommand,
  giveawayCommand,
  pollCommand,
  suggestionCommand,
  starboardCommand,
  voiceCommand,
  autoThreadCommand,
  digestCommand,
  releaseCommand,
];

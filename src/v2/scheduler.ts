import { randomInt } from 'node:crypto';
import { ChannelType, type TextChannel } from 'discord.js';
import { embed, fields } from '../theme.js';
import type { BotContext } from '../types.js';
import { truncate } from '../utils.js';
import { checkPublicUrl } from './network.js';
import type { JsonObject } from './store.js';

interface ReminderData extends JsonObject {
  message: string;
  channelId: string;
  repeat: string;
  project: string | null;
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

interface GiveawayData extends JsonObject {
  prize: string;
  winners: number;
  requiredRoleId: string | null;
  channelId: string;
  winnerIds: string[];
}

interface EventData extends JsonObject {
  description: string;
  channelId: string;
  capacity: number;
  remindersSent: number;
}

function nextRepeat(repeat: string): string | null {
  const milliseconds = repeat === 'daily' ? 86_400_000 : repeat === 'weekly' ? 604_800_000 : repeat === 'monthly' ? 30 * 86_400_000 : 0;
  return milliseconds ? new Date(Date.now() + milliseconds).toISOString() : null;
}

async function textChannel(context: BotContext, id: string): Promise<TextChannel | null> {
  const channel = await context.client.channels.fetch(id).catch(() => null);
  return channel?.type === ChannelType.GuildText ? channel : null;
}

async function processReminders(context: BotContext): Promise<void> {
  for (const item of context.v2.dueItems<ReminderData>('reminder')) {
    const channel = await textChannel(context, item.data.channelId);
    const destination = channel ?? await context.client.users.fetch(item.owner_id).catch(() => null);
    if (destination) {
      await destination.send({
        content: `<@${item.owner_id}>`,
        embeds: [embed(context, '⏱️ Reminder', item.data.message).addFields(...fields([
          ['Project', item.data.project ?? 'Personal', true], ['Reminder ID', `\`${item.id}\``, true],
        ]))],
        allowedMentions: { users: [item.owner_id] },
      }).catch(() => null);
    }
    const next = nextRepeat(item.data.repeat);
    context.v2.updateItem(item.id, next ? { dueAt: next } : { status: 'fired' });
  }
}

async function processMonitors(context: BotContext): Promise<void> {
  for (const guild of context.client.guilds.cache.values()) {
    if (!context.v2.isModuleEnabled(guild.id, 'uptime')) continue;
    const monitors = context.v2.listItems<MonitorData>({ guildId: guild.id, type: 'monitor', status: 'active', limit: 100 });
    for (const monitor of monitors) {
      const last = monitor.data.lastCheckedAt ? new Date(monitor.data.lastCheckedAt).getTime() : 0;
      if (Date.now() - last < monitor.data.intervalMinutes * 60_000) continue;
      let online = false;
      let status = 0;
      let latencyMs = 0;
      try {
        const result = await checkPublicUrl(monitor.data.url);
        online = result.online;
        status = result.status;
        latencyMs = result.latencyMs;
      } catch {
        online = false;
      }
      const failures = online ? 0 : monitor.data.consecutiveFailures + 1;
      const previousStatus = monitor.data.status;
      const nextStatus = online ? 'online' : failures >= 2 ? 'offline' : previousStatus;
      context.v2.updateItem<MonitorData>(monitor.id, { data: {
        status: nextStatus,
        lastCheckedAt: new Date().toISOString(),
        lastLatencyMs: latencyMs,
        consecutiveFailures: failures,
      } });
      const changed = (nextStatus === 'offline' && previousStatus !== 'offline') || (nextStatus === 'online' && previousStatus === 'offline');
      if (!changed) continue;
      const channel = await textChannel(context, monitor.data.channelId);
      await channel?.send({ embeds: [embed(context, nextStatus === 'online' ? `🟢 ${monitor.title} recovered` : `🔴 ${monitor.title} is offline`, `${monitor.data.url}\nHTTP: ${status || 'no response'} • Latency: ${latencyMs || '—'} ms`).setColor(nextStatus === 'online' ? 0x22c55e : 0xef4444)] }).catch(() => null);
    }
  }
}

function selectWinners(entries: string[], count: number): string[] {
  const pool = [...new Set(entries)];
  const winners: string[] = [];
  while (pool.length && winners.length < count) winners.push(pool.splice(randomInt(pool.length), 1)[0]!);
  return winners;
}

async function processGiveaways(context: BotContext): Promise<void> {
  for (const item of context.v2.dueItems<GiveawayData>('giveaway')) {
    const entries = context.v2.listMembers(item.id).map((entry) => entry.user_id);
    const winners = selectWinners(entries, item.data.winners);
    context.v2.updateItem<GiveawayData>(item.id, { status: 'ended', data: { winnerIds: winners } });
    const channel = await textChannel(context, item.data.channelId);
    await channel?.send({ embeds: [embed(context, '🎉 Giveaway ended', winners.length ? `Prize: **${item.data.prize}**\nWinner${winners.length === 1 ? '' : 's'}: ${winners.map((id) => `<@${id}>`).join(', ')}` : `Prize: **${item.data.prize}**\nNo eligible entries.`)] }).catch(() => null);
  }
}

async function processEvents(context: BotContext): Promise<void> {
  for (const guild of context.client.guilds.cache.values()) {
    const events = context.v2.listItems<EventData>({ guildId: guild.id, type: 'event', status: 'registration', limit: 100 });
    for (const item of events) {
      if (!item.due_at) continue;
      const until = new Date(item.due_at).getTime() - Date.now();
      const channel = await textChannel(context, item.data.channelId);
      if (until <= 3_600_000 && until > 0 && item.data.remindersSent < 1) {
        const members = context.v2.listMembers(item.id).filter((member) =>
          member.status === 'registered' && context.v2.getPreference(item.guild_id, member.user_id, 'notify.events', true),
        );
        await channel?.send({ content: members.map((member) => `<@${member.user_id}>`).join(' '), embeds: [embed(context, `📆 ${item.title} starts soon`, `Starts <t:${Math.floor(new Date(item.due_at).getTime() / 1000)}:R>. Use \`/event checkin id:${item.id}\` when it begins.`)], allowedMentions: { users: members.map((member) => member.user_id) } }).catch(() => null);
        context.v2.updateItem<EventData>(item.id, { data: { remindersSent: 1 } });
      }
      if (until <= 0) {
        context.v2.updateItem(item.id, { status: 'running' });
        await channel?.send({ embeds: [embed(context, `🟢 ${item.title} is starting`, `Registered members can now check in with \`/event checkin id:${item.id}\`.`).setColor(0x22c55e)] }).catch(() => null);
      }
    }
  }
}

async function processFocus(context: BotContext): Promise<void> {
  for (const item of context.v2.dueItems('focus')) {
    context.v2.updateItem(item.id, { status: 'completed' });
    const threadId = String(item.data['threadId'] ?? '');
    if (threadId) {
      const thread = await context.client.channels.fetch(threadId).catch(() => null);
      if (thread?.isThread()) {
        await thread.send({ embeds: [embed(context, '⏱️ Focus session complete', `Time is up for **${item.title}**. Share what you finished and take a short break.`)] }).catch(() => null);
        await thread.setArchived(true, 'Focus timer completed').catch(() => null);
      }
    }
    const participants = context.v2.listMembers(item.id);
    for (const participant of participants) {
      context.v2.changeCredits(item.guild_id, participant.user_id, 5, 'Completed group focus session', item.id);
      context.v2.updateStreak(item.guild_id, participant.user_id, 'focus');
    }
  }
}

async function processTickets(context: BotContext): Promise<void> {
  for (const guild of context.client.guilds.cache.values()) {
    const hours = context.v2.getSetting(guild.id, 'ticket.autoCloseHours', 0);
    if (hours <= 0) continue;
    const tickets = context.v2.listItems({ guildId: guild.id, type: 'ticket', status: 'open', limit: 100 });
    for (const ticket of tickets) {
      const lastActivity = new Date(String(ticket.data['lastActivityAt'] ?? ticket.updated_at)).getTime();
      if (Date.now() - lastActivity < hours * 3_600_000) continue;
      context.v2.updateItem(ticket.id, { status: 'closed', data: { closedBy: context.client.user.id } });
      const channel = guild.channels.cache.get(String(ticket.data['channelId']));
      if (channel?.type === ChannelType.GuildText) {
        await channel.permissionOverwrites.edit(ticket.owner_id, { SendMessages: false }).catch(() => null);
        await channel.setName(truncate(`closed-${ticket.id}`, 100)).catch(() => null);
        await channel.send({ embeds: [embed(context, '🔒 Ticket automatically closed', `This ticket was inactive for **${hours} hours**. Staff can still generate or preserve a transcript before deleting the channel.`)] }).catch(() => null);
      }
    }
  }
}

async function processStandups(context: BotContext): Promise<void> {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  for (const guild of context.client.guilds.cache.values()) {
    const config = context.v2.getSetting(guild.id, 'standups.config', { enabled: false, channelId: '', frequency: 'weekdays', hourUtc: 12, roleId: null as string | null, lastPromptDate: null as string | null });
    if (!config.enabled || config.lastPromptDate === date || now.getUTCHours() !== config.hourUtc) continue;
    const day = now.getUTCDay();
    const scheduled = config.frequency === 'daily' || (config.frequency === 'weekdays' && day >= 1 && day <= 5) || (config.frequency === 'weekly' && day === 1);
    if (!scheduled) continue;
    const channel = await textChannel(context, config.channelId);
    if (!channel) continue;
    await channel.send({
      ...(config.roleId ? { content: `<@&${config.roleId}>` } : {}),
      embeds: [embed(context, '☀️ Team stand-up', 'Share **Yesterday / Today / Blockers** with `/standups submit`. Keep it concise, make blockers actionable, and ask for help early.')],
      allowedMentions: { roles: config.roleId ? [config.roleId] : [] },
    });
    context.v2.setSetting(guild.id, 'standups.config', { ...config, lastPromptDate: date });
  }
}

async function processDigests(context: BotContext): Promise<void> {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  if (now.getUTCHours() !== 12) return;
  for (const guild of context.client.guilds.cache.values()) {
    const config = context.v2.getSetting(guild.id, 'digest.config', { enabled: false, channelId: '', frequency: 'weekly', lastSentAt: null as string | null });
    if (!config.enabled || config.lastSentAt === date) continue;
    if (config.frequency === 'weekly' && now.getUTCDay() !== 1) continue;
    const channel = await textChannel(context, config.channelId);
    if (!channel) continue;
    const analytics = context.v2.analytics(guild.id, config.frequency === 'weekly' ? 7 : 1);
    const insights = context.db.getInsights(guild.id);
    const events = context.v2.listItems({ guildId: guild.id, type: 'event', limit: 5 }).filter((item) => ['registration', 'running'].includes(item.status));
    await channel.send({ embeds: [embed(context, `📰 ${config.frequency === 'weekly' ? 'Weekly' : 'Daily'} developer digest`).addFields(...fields([
      ['Activity', `**${analytics.messages}** messages • **${analytics.activeMembers}** active members`],
      ['Top channels', analytics.channels.slice(0, 5).map((item) => `<#${item.channel_id}> — ${item.messages}`).join('\n') || 'No activity recorded.'],
      ['Collaboration', `**${insights.projects}** projects • **${insights.openReviews}** open reviews • **${insights.pairSessions}** pair sessions`],
      ['Upcoming events', events.map((item) => `**${item.title}**${item.due_at ? ` • <t:${Math.floor(new Date(item.due_at).getTime() / 1000)}:R>` : ''}`).join('\n') || 'No upcoming events.'],
    ]))] });
    context.v2.setSetting(guild.id, 'digest.config', { ...config, lastSentAt: date });
  }
}

async function tick(context: BotContext): Promise<void> {
  const tasks = [
    processReminders(context),
    processMonitors(context),
    processGiveaways(context),
    processEvents(context),
    processFocus(context),
    processTickets(context),
    processStandups(context),
    processDigests(context),
  ];
  const results = await Promise.allSettled(tasks);
  for (const result of results) if (result.status === 'rejected') context.logger.warn('A scheduled DevForge task failed.', { error: String(result.reason) });
}

export function startScheduler(context: BotContext): NodeJS.Timeout {
  let running = false;
  const run = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      await tick(context);
    } finally {
      running = false;
    }
  };
  void run();
  return setInterval(() => void run(), 60_000);
}

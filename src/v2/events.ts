import {
  ChannelType,
  Events,
  PermissionFlagsBits,
  type Client,
  type GuildMember,
  type Message,
  type MessageReaction,
  type PartialGuildMember,
  type PartialMessageReaction,
  type VoiceState,
} from 'discord.js';
import { embed, fields } from '../theme.js';
import type { BotContext } from '../types.js';
import { truncate } from '../utils.js';
import type { JsonObject } from './store.js';

interface SecurityConfig extends JsonObject {
  antiRaid: boolean;
  raidThreshold: number;
  newAccountDays: number;
  mentionLimit: number;
  antiRoleSpam: boolean;
}

async function securityLog(context: BotContext, guildId: string, title: string, description: string): Promise<void> {
  const settings = context.db.getSettings(guildId);
  if (!settings.mod_log_channel_id) return;
  const channel = await context.client.channels.fetch(settings.mod_log_channel_id).catch(() => null);
  if (channel?.type !== ChannelType.GuildText) return;
  await channel.send({ embeds: [embed(context, `🛡️ ${title}`, description).setColor(0xef4444)] });
}

async function handleSecurityJoin(member: GuildMember, context: BotContext): Promise<void> {
  const config = context.v2.getSetting<SecurityConfig>(member.guild.id, 'security.config', {
    antiRaid: false,
    raidThreshold: 8,
    newAccountDays: 3,
    mentionLimit: 6,
    antiRoleSpam: true,
  });
  const now = Date.now();
  const recent = [...(context.runtime.joinWindows.get(member.guild.id) ?? []).filter((timestamp) => now - timestamp < 60_000), now];
  context.runtime.joinWindows.set(member.guild.id, recent);
  const accountAgeDays = Math.floor((now - member.user.createdTimestamp) / 86_400_000);
  if (config.newAccountDays > 0 && accountAgeDays < config.newAccountDays) {
    context.v2.audit(member.guild.id, context.client.user.id, 'security.new_account', `${accountAgeDays} day(s) old`, member.id);
    await securityLog(context, member.guild.id, 'New-account alert', `${member} joined with an account created **${accountAgeDays} day(s)** ago.`);
  }
  if (!config.antiRaid || recent.length < config.raidThreshold) return;
  context.v2.audit(member.guild.id, context.client.user.id, 'security.raid_detected', `${recent.length} joins in 60 seconds`, member.id);
  await securityLog(context, member.guild.id, 'Possible raid detected', `**${recent.length} joins** were observed in 60 seconds. ${member} was the latest account. Staff should review recent joins.`);
  if (member.moderatable && accountAgeDays < Math.max(7, config.newAccountDays)) {
    await member.timeout(10 * 60_000, 'DevForge anti-raid quarantine').catch(() => null);
    const moderationCase = context.db.createModerationCase({
      guildId: member.guild.id,
      targetId: member.id,
      moderatorId: context.client.user.id,
      action: 'Anti-raid quarantine',
      reason: `${recent.length} joins in 60 seconds; account age ${accountAgeDays} day(s)`,
      durationMs: 10 * 60_000,
    });
    await securityLog(context, member.guild.id, `Automatic quarantine • Case #${moderationCase.caseNumber}`, `${member} was temporarily restricted for 10 minutes pending review.`);
  }
}

async function handleRoleChanges(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember, context: BotContext): Promise<void> {
  const config = context.v2.getSetting<SecurityConfig>(newMember.guild.id, 'security.config', {
    antiRaid: false,
    raidThreshold: 8,
    newAccountDays: 3,
    mentionLimit: 6,
    antiRoleSpam: true,
  });
  if (!config.antiRoleSpam) return;
  const added = newMember.roles.cache.filter((role) => !oldMember.roles.cache.has(role.id));
  const removed = oldMember.roles.cache.filter((role) => !newMember.roles.cache.has(role.id));
  if (added.size + removed.size < 5) return;
  context.v2.audit(newMember.guild.id, context.client.user.id, 'security.mass_role_change', `${added.size} added, ${removed.size} removed`, newMember.id);
  await securityLog(context, newMember.guild.id, 'Mass role change detected', `${newMember} changed **${added.size + removed.size} roles** in one update. Added: ${added.map((role) => role.name).join(', ') || 'none'}. Removed: ${removed.map((role) => role.name).join(', ') || 'none'}.`);
}

async function handleMessageActivity(message: Message, context: BotContext): Promise<void> {
  if (!message.inGuild() || message.author.bot || message.webhookId) return;
  context.v2.recordActivity(message.guildId, message.channelId, message.author.id);
  context.v2.updateStreak(message.guildId, message.author.id, 'community');

  const ticket = context.v2.listItems({ guildId: message.guildId, type: 'ticket', status: 'open', limit: 100 })
    .find((item) => item.data['channelId'] === message.channelId);
  if (ticket) context.v2.updateItem(ticket.id, { data: { lastActivityAt: new Date().toISOString() } });

  const autoThread = context.v2.listItems({ guildId: message.guildId, type: 'autothread', status: 'active', limit: 100 })
    .find((item) => item.data['channelId'] === message.channelId);
  if (!autoThread || !('startThread' in message)) return;
  const prefix = String(autoThread.data['prefix'] || '');
  const source = message.cleanContent.split('\n')[0]?.trim() || `Discussion by ${message.author.username}`;
  await message.startThread({
    name: truncate(`${prefix ? `${prefix} • ` : ''}${source}`, 100),
    autoArchiveDuration: 1440,
    reason: 'DevForge automatic discussion thread',
  }).catch(() => null);
}

interface StarboardData extends JsonObject {
  channelId: string;
  emoji: string;
  threshold: number;
  label: string;
}

async function handleV2Starboard(
  reaction: MessageReaction | PartialMessageReaction,
  context: BotContext,
): Promise<void> {
  const fullReaction = reaction.partial ? await reaction.fetch().catch(() => null) : reaction;
  if (!fullReaction) return;
  const message = fullReaction.message.partial ? await fullReaction.message.fetch().catch(() => null) : fullReaction.message;
  if (!message?.inGuild() || !message.author || message.author.bot) return;
  const boards = context.v2.listItems<StarboardData>({ guildId: message.guildId, type: 'starboard_board', status: 'active', limit: 50 })
    .filter((item) => item.data.emoji === fullReaction.emoji.name || item.data.emoji === fullReaction.emoji.toString());
  for (const board of boards) {
    if (message.channelId === board.data.channelId) continue;
    const destination = await context.client.channels.fetch(board.data.channelId).catch(() => null);
    if (destination?.type !== ChannelType.GuildText) continue;
    const count = fullReaction.count ?? 0;
    let entry = context.v2.listItems({ guildId: message.guildId, type: 'starboard_v2_entry', limit: 100 })
      .find((item) => item.title === `${board.id}:${message.id}`);
    if (count < board.data.threshold) {
      if (entry) {
        const posted = await destination.messages.fetch(String(entry.data['messageId'])).catch(() => null);
        await posted?.delete().catch(() => null);
        context.v2.deleteItem(entry.id);
      }
      continue;
    }
    const attachment = message.attachments.find((item) => item.contentType?.startsWith('image/'));
    const card = embed(context, `${board.data.emoji} ${board.title} • ${count}`, truncate(message.content || '*Attachment or embed message*', 3500))
      .setAuthor({ name: message.author.displayName, iconURL: message.author.displayAvatarURL() })
      .addFields(...fields([['Source', `[Open original](${message.url})`, true], ['Channel', `${message.channel}`, true]]));
    if (attachment) card.setImage(attachment.url);
    if (entry) {
      const posted = await destination.messages.fetch(String(entry.data['messageId'])).catch(() => null);
      if (posted) {
        await posted.edit({ embeds: [card] });
        context.v2.updateItem(entry.id, { data: { count } });
        continue;
      }
      context.v2.deleteItem(entry.id);
      entry = undefined;
    }
    const posted = await destination.send({ embeds: [card] });
    context.v2.createItem({ guildId: message.guildId, type: 'starboard_v2_entry', ownerId: message.author.id, title: `${board.id}:${message.id}`, data: { boardId: board.id, sourceMessageId: message.id, messageId: posted.id, count }, idPrefix: 'starmsg' });
  }
}

async function handleVoice(oldState: VoiceState, newState: VoiceState, context: BotContext): Promise<void> {
  const guild = newState.guild;
  const triggerId = context.v2.getSetting(guild.id, 'voice.triggerChannelId', '');
  if (newState.channelId === triggerId && newState.member) {
    const parentId = context.v2.getSetting(guild.id, 'voice.categoryId', '');
    const room = await guild.channels.create({
      name: truncate(`${newState.member.displayName}'s room`, 100),
      type: ChannelType.GuildVoice,
      ...(parentId && guild.channels.cache.has(parentId) ? { parent: parentId } : {}),
      permissionOverwrites: [
        { id: newState.member.id, allow: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] },
      ],
      reason: 'DevForge temporary voice room',
    });
    context.runtime.voiceOwners.set(room.id, newState.member.id);
    await newState.setChannel(room, 'Created temporary DevForge room').catch(() => room.delete('Could not move temporary room owner'));
  }

  if (oldState.channelId && context.runtime.voiceOwners.has(oldState.channelId)) {
    const previous = oldState.guild.channels.cache.get(oldState.channelId);
    if (previous?.type === ChannelType.GuildVoice && previous.members.size === 0) {
      context.runtime.voiceOwners.delete(previous.id);
      await previous.delete('Empty temporary DevForge voice room').catch(() => null);
    }
  }
}

export function registerV2Events(client: Client<true>, context: BotContext): void {
  client.on(Events.MessageCreate, (message) => void handleMessageActivity(message, context));
  client.on(Events.GuildMemberAdd, (member) => void handleSecurityJoin(member, context));
  client.on(Events.GuildMemberUpdate, (oldMember, newMember) => void handleRoleChanges(oldMember, newMember, context));
  client.on(Events.MessageReactionAdd, (reaction) => void handleV2Starboard(reaction, context));
  client.on(Events.MessageReactionRemove, (reaction) => void handleV2Starboard(reaction, context));
  client.on(Events.VoiceStateUpdate, (oldState, newState) => void handleVoice(oldState, newState, context));
}

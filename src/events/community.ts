import {
  ChannelType,
  Events,
  PermissionFlagsBits,
  type Client,
  type GuildMember,
  type Message,
  type MessageReaction,
  type PartialMessageReaction,
} from 'discord.js';
import { evaluateAchievements } from '../services/achievements.js';
import { embed, fields } from '../theme.js';
import type { BotContext } from '../types.js';
import { randomInt, truncate } from '../utils.js';

async function automodLog(
  context: BotContext,
  message: Message<true>,
  action: string,
  reason: string,
): Promise<void> {
  const settings = context.db.getSettings(message.guildId);
  if (!settings.mod_log_channel_id) return;
  const channel = await context.client.channels.fetch(settings.mod_log_channel_id).catch(() => null);
  if (channel?.type !== ChannelType.GuildText) return;
  await channel.send({
    embeds: [
      embed(context, `🤖 Automod • ${action}`)
        .setColor(0xef4444)
        .addFields(
          ...fields([
            ['Member', `${message.author} • \`${message.author.id}\``],
            ['Channel', `${message.channel}`, true],
            ['Reason', reason],
            ['Content preview', truncate(message.content || '[no text content]', 500)],
          ]),
        ),
    ],
  });
}

async function handleAutomod(message: Message<true>, context: BotContext): Promise<boolean> {
  const settings = context.db.getSettings(message.guildId);
  if (!settings.automod_enabled || !message.member) return false;
  const isStaff =
    message.member.permissions.has(PermissionFlagsBits.ManageMessages) ||
    Boolean(settings.moderator_role_id && message.member.roles.cache.has(settings.moderator_role_id));
  if (isStaff) return false;

  const security = context.v2.getSetting(message.guildId, 'security.config', {
    antiRaid: false,
    raidThreshold: 8,
    newAccountDays: 3,
    mentionLimit: 6,
    antiRoleSpam: true,
  });

  let reason: string | null = null;
  if (settings.anti_invite_enabled && /(?:discord\.gg|discord(?:app)?\.com\/invite)\/[a-z0-9-]+/i.test(message.content)) {
    reason = 'Discord invite links are disabled in this server.';
  }
  const mentionCount = message.mentions.users.size + message.mentions.roles.size;
  if (mentionCount >= security.mentionLimit) reason = `Mass mentions are not allowed (${mentionCount} mentions; limit ${security.mentionLimit}).`;

  const key = `${message.guildId}:${message.author.id}`;
  const normalized = message.content.trim().toLowerCase().replace(/\s+/g, ' ');
  if (normalized.length >= 4) {
    const previous = context.spamCache.get(key);
    const currentTime = Date.now();
    const timestamps =
      previous?.content === normalized
        ? [...previous.timestamps.filter((timestamp) => currentTime - timestamp < 15_000), currentTime]
        : [currentTime];
    context.spamCache.set(key, { content: normalized, timestamps });
    if (timestamps.length >= 3) reason = 'Repeated-message spam detected.';
  }

  if (!reason) return false;
  await message.delete().catch(() => null);
  const action = reason.includes('spam') ? 'Message removed + 5 minute timeout' : 'Message removed';
  if (reason.includes('spam') && message.member.moderatable) {
    await message.member.timeout(5 * 60_000, `DevForge automod: ${reason}`).catch(() => null);
  }
  const created = context.db.createModerationCase({
    guildId: message.guildId,
    targetId: message.author.id,
    moderatorId: context.client.user.id,
    action: 'Automod',
    reason,
    ...(reason.includes('spam') ? { durationMs: 5 * 60_000 } : {}),
  });
  await automodLog(context, message, `${action} • Case #${created.caseNumber}`, reason);
  await message.author
    .send({
      embeds: [
        embed(context, `Message moderated in ${message.guild.name}`, `${reason}\nCase: #${created.caseNumber}`).setColor(0xef4444),
      ],
    })
    .catch(() => null);
  return true;
}

async function handleMessage(message: Message, context: BotContext): Promise<void> {
  if (!message.inGuild() || message.author.bot || message.webhookId) return;
  if (await handleAutomod(message, context)) return;
  const settings = context.db.getSettings(message.guildId);
  const activity = context.db.recordMessage(
    message.guildId,
    message.author.id,
    settings.xp_enabled ? randomInt(15, 25) : 0,
  );
  if (activity.newLevel > activity.previousLevel) {
    const unlocked = evaluateAchievements(context, message.guildId, message.author.id);
    await message.channel.send({
      embeds: [
        embed(
          context,
          `📈 Level ${activity.newLevel} reached`,
          `${message.author} leveled up through meaningful community participation.${unlocked.length ? `\n${unlocked.map((item) => `${item.icon} **${item.name}** unlocked`).join('\n')}` : ''}`,
        ).setColor(context.config.accentColor),
      ],
    });
  }
}

async function handleStarboard(
  reaction: MessageReaction | PartialMessageReaction,
  context: BotContext,
): Promise<void> {
  const fullReaction = reaction.partial ? await reaction.fetch().catch(() => null) : reaction;
  if (!fullReaction || fullReaction.emoji.name !== '⭐') return;
  const message = fullReaction.message.partial
    ? await fullReaction.message.fetch().catch(() => null)
    : fullReaction.message;
  if (!message) return;
  if (!message.inGuild() || !message.author || message.author.bot) return;
  const settings = context.db.getSettings(message.guildId);
  if (!settings.starboard_channel_id || message.channelId === settings.starboard_channel_id) return;
  const count = fullReaction.count ?? 0;
  const existing = context.db.getStarboardEntry(message.guildId, message.id);
  const destination = await context.client.channels.fetch(settings.starboard_channel_id).catch(() => null);
  if (destination?.type !== ChannelType.GuildText) return;

  if (count < settings.star_threshold) {
    if (existing) {
      const starMessage = await destination.messages.fetch(existing.starboard_message_id).catch(() => null);
      await starMessage?.delete().catch(() => null);
      context.db.deleteStarboardEntry(message.guildId, message.id);
    }
    return;
  }

  const attachment = message.attachments.find((item) => item.contentType?.startsWith('image/'));
  const card = embed(
    context,
    `⭐ ${count} • #${'name' in message.channel ? message.channel.name : 'channel'}`,
    truncate(message.content || '*Attachment or embed message*', 3500),
  )
    .setAuthor({ name: message.author.displayName, iconURL: message.author.displayAvatarURL() })
    .addFields({ name: 'Jump to message', value: `[Open original](${message.url})` });
  if (attachment) card.setImage(attachment.url);

  if (existing) {
    const starMessage = await destination.messages.fetch(existing.starboard_message_id).catch(() => null);
    if (starMessage) {
      await starMessage.edit({ content: `⭐ **${count}** • ${message.channel}`, embeds: [card] });
      context.db.upsertStarboardEntry({
        guildId: message.guildId,
        sourceMessageId: message.id,
        sourceChannelId: message.channelId,
        starboardMessageId: starMessage.id,
        authorId: message.author.id,
        stars: count,
      });
      return;
    }
  }
  const starMessage = await destination.send({ content: `⭐ **${count}** • ${message.channel}`, embeds: [card] });
  context.db.upsertStarboardEntry({
    guildId: message.guildId,
    sourceMessageId: message.id,
    sourceChannelId: message.channelId,
    starboardMessageId: starMessage.id,
    authorId: message.author.id,
    stars: count,
  });
}

async function welcomeMember(member: GuildMember, context: BotContext): Promise<void> {
  context.db.ensureGuild(member.guild.id);
  context.db.incrementDaily(member.guild.id, 'joins');
  const settings = context.db.getSettings(member.guild.id);
  if (!settings.welcome_enabled || !settings.welcome_channel_id) return;
  const channel = await context.client.channels.fetch(settings.welcome_channel_id).catch(() => null);
  if (channel?.type !== ChannelType.GuildText) return;
  await channel.send({
    content: `${member}`,
    embeds: [
      embed(
        context,
        `Welcome to ${member.guild.name}`,
        'Tell us what you build, what you are learning, and what kind of collaboration you are looking for.',
      )
        .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
        .addFields(
          ...fields([
            ['Create your profile', 'Use `/profile set`'],
            ['Find collaborators', 'Use `/project browse` or `/pair join`'],
            ['Get unstuck', 'Use `/rubberduck` or `/review request`'],
          ]),
        ),
    ],
  });
}

export function registerCommunityEvents(client: Client<true>, context: BotContext): void {
  client.on(Events.MessageCreate, (message) => void handleMessage(message, context));
  client.on(Events.MessageReactionAdd, (reaction) => void handleStarboard(reaction, context));
  client.on(Events.MessageReactionRemove, (reaction) => void handleStarboard(reaction, context));
  client.on(Events.GuildMemberAdd, (member) => void welcomeMember(member, context));
  client.on(Events.GuildMemberRemove, (member) => context.db.incrementDaily(member.guild.id, 'leaves'));
  client.on(Events.GuildCreate, (guild) => context.db.ensureGuild(guild.id));
}

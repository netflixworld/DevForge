import {
  ChannelType,
  PermissionFlagsBits,
  type Guild,
  type GuildBasedChannel,
  type Role,
  type TextChannel,
} from 'discord.js';
import type { BotContext } from '../types.js';

interface BootstrapResult {
  createdRoles: Role[];
  createdChannels: GuildBasedChannel[];
  channels: Record<string, TextChannel>;
  roles: Record<string, Role>;
}

async function findOrCreateRole(
  guild: Guild,
  name: string,
  options: { color: number; permissions?: bigint[]; hoist?: boolean },
): Promise<{ role: Role; created: boolean }> {
  const existing = guild.roles.cache.find((role) => role.name === name);
  if (existing) return { role: existing, created: false };
  const role = await guild.roles.create({
    name,
    color: options.color,
    permissions: options.permissions ?? [],
    hoist: options.hoist ?? false,
    mentionable: false,
    reason: 'DevForge community bootstrap',
  });
  return { role, created: true };
}

export async function bootstrapGuild(guild: Guild, context: BotContext): Promise<BootstrapResult> {
  const createdRoles: Role[] = [];
  const createdChannels: GuildBasedChannel[] = [];

  const moderator = await findOrCreateRole(guild, 'Community Moderator', {
    color: 0xef4444,
    hoist: true,
    permissions: [
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.ModerateMembers,
      PermissionFlagsBits.ViewAuditLog,
    ],
  });
  const mentor = await findOrCreateRole(guild, 'Code Mentor', {
    color: context.config.accentColor,
    hoist: true,
  });
  const verified = await findOrCreateRole(guild, 'Verified Developer', {
    color: context.config.primaryColor,
  });
  const eventPing = await findOrCreateRole(guild, 'Dev Events', { color: 0xf59e0b });
  const support = await findOrCreateRole(guild, 'Community Support', {
    color: 0x22c55e,
    permissions: [PermissionFlagsBits.ManageMessages],
  });
  const eventOrganizer = await findOrCreateRole(guild, 'Event Organizer', { color: 0xa855f7 });
  const hackathonJudge = await findOrCreateRole(guild, 'Hackathon Judge', { color: 0xf97316 });
  for (const item of [moderator, mentor, verified, eventPing, support, eventOrganizer, hackathonJudge]) {
    if (item.created) createdRoles.push(item.role);
  }

  let category = guild.channels.cache.find(
    (channel) => channel.type === ChannelType.GuildCategory && channel.name === 'DEV COMMUNITY',
  );
  if (!category) {
    category = await guild.channels.create({
      name: 'DEV COMMUNITY',
      type: ChannelType.GuildCategory,
      reason: 'DevForge community bootstrap',
    });
    createdChannels.push(category);
  }

  const definitions = [
    ['welcome', 'Read the community guide and create your developer profile.'],
    ['dev-chat', 'General conversation, technical discussion, and collaboration.'],
    ['project-showcase', 'Ship in public: share projects and find collaborators.'],
    ['code-review', 'Request and claim structured code reviews.'],
    ['pair-programming', 'Private pair-programming sessions start here.'],
    ['daily-challenge', 'Daily coding prompts and community submissions.'],
    ['dev-updates', 'GitHub updates, community news, and event announcements.'],
    ['dev-logs', 'Progress logs, milestones, and project changelogs.'],
    ['knowledge-base', 'Staff-maintained guides, FAQs, and technical resources.'],
    ['suggestions', 'Ideas and proposals for improving the community.'],
    ['events', 'Code battles, code jams, hackathons, and community events.'],
    ['support', 'Open a guided private ticket through the DevForge ticket panel.'],
    ['starboard', 'The community’s most useful and memorable messages.'],
  ] as const;

  const channels: Record<string, TextChannel> = {};
  for (const [name, topic] of definitions) {
    let channel = guild.channels.cache.find(
      (candidate) => candidate.type === ChannelType.GuildText && candidate.name === name,
    ) as TextChannel | undefined;
    if (!channel) {
      channel = await guild.channels.create({
        name,
        type: ChannelType.GuildText,
        parent: category.id,
        topic,
        reason: 'DevForge community bootstrap',
      });
      createdChannels.push(channel);
    }
    channels[name] = channel;
  }

  let modLog = guild.channels.cache.find(
    (candidate) => candidate.type === ChannelType.GuildText && candidate.name === 'mod-log',
  ) as TextChannel | undefined;
  if (!modLog) {
    modLog = await guild.channels.create({
      name: 'mod-log',
      type: ChannelType.GuildText,
      parent: category.id,
      topic: 'Private moderation and security events.',
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        {
          id: moderator.role.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
        },
      ],
      reason: 'DevForge community bootstrap',
    });
    createdChannels.push(modLog);
  }
  channels['mod-log'] = modLog;

  const mappings = {
    welcome_channel_id: channels['welcome']!.id,
    showcase_channel_id: channels['project-showcase']!.id,
    review_channel_id: channels['code-review']!.id,
    pairing_channel_id: channels['pair-programming']!.id,
    challenge_channel_id: channels['daily-challenge']!.id,
    github_channel_id: channels['dev-updates']!.id,
    starboard_channel_id: channels['starboard']!.id,
    mod_log_channel_id: channels['mod-log']!.id,
    moderator_role_id: moderator.role.id,
    mentor_role_id: mentor.role.id,
    verified_role_id: verified.role.id,
  } as const;
  for (const [key, value] of Object.entries(mappings)) {
    context.db.setSetting(guild.id, key as keyof typeof mappings, value);
  }
  context.v2.setSetting(guild.id, 'ticket.supportRoleId', support.role.id);
  context.v2.setSetting(guild.id, 'ticket.logChannelId', channels['mod-log']!.id);
  context.v2.setSetting(guild.id, 'ticket.categoryId', category.id);

  return {
    createdRoles,
    createdChannels,
    channels,
    roles: {
      moderator: moderator.role,
      mentor: mentor.role,
      verified: verified.role,
      eventPing: eventPing.role,
      support: support.role,
      eventOrganizer: eventOrganizer.role,
      hackathonJudge: hackathonJudge.role,
    },
  };
}

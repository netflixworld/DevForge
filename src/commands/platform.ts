import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type GuildMember,
} from 'discord.js';
import { embed, fields, successEmbed } from '../theme.js';
import type { BotCommand, BotContext } from '../types.js';
import { deny, truncate } from '../utils.js';
import type { JsonObject } from '../v2/store.js';
import { matchScore, projectHealth, type ProjectSignal } from '../services/platform.js';

interface WorkspaceData extends JsonObject {
  projectId: string;
  roleId: string;
  categoryId: string;
  textChannelId: string;
  voiceChannelId: string;
}

function projectSignals(context: BotContext, guildId: string, projectId: string): ProjectSignal[] {
  const items = [
    ...context.v2.listItems({ guildId, type: 'project_milestone', limit: 100 }).map((item) => ({ item, kind: 'milestone' as const })),
    ...context.v2.listItems({ guildId, type: 'devlog', limit: 100 }).map((item) => ({ item, kind: 'devlog' as const })),
    ...context.v2.listItems<WorkspaceData>({ guildId, type: 'project_workspace', limit: 100 }).map((item) => ({ item, kind: 'workspace' as const })),
  ];
  return items.filter(({ item }) => item.title === projectId || item.data['projectId'] === projectId || item.data['project'] === projectId)
    .map(({ item, kind }) => ({ kind, createdAt: item.created_at, updatedAt: item.updated_at }));
}

const passportCommand: BotCommand = {
  module: 'profiles',
  data: new SlashCommandBuilder().setName('passport').setDescription('View a verified overview of a developer’s DevForge journey.')
    .addSubcommand((sub) => sub.setName('view').setDescription('View a Developer Passport.')
      .addUserOption((option) => option.setName('member').setDescription('Member to view.')))
    .addSubcommand((sub) => sub.setName('availability').setDescription('Update project availability.')
      .addStringOption((option) => option.setName('status').setDescription('Your availability.').setRequired(true).setMaxLength(80))),
  async execute(interaction, context) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'availability') {
      const profile = context.db.getProfile(interaction.guildId, interaction.user.id);
      if (!profile) return deny(interaction, context, 'Create your profile first with `/profile edit`.');
      context.db.upsertProfile({ guildId: interaction.guildId, userId: interaction.user.id, bio: profile.bio, skills: profile.skills,
        github: profile.github, portfolio: profile.portfolio, timezone: profile.timezone, availability: interaction.options.getString('status', true) });
      await interaction.reply({ embeds: [successEmbed(context, 'Passport updated', 'Your project availability is now visible in your Developer Passport.')], ephemeral: true });
      return;
    }
    const user = interaction.options.getUser('member') ?? interaction.user;
    const profile = context.db.getProfile(interaction.guildId, user.id);
    if (!profile) return deny(interaction, context, `${user} has not created a developer profile yet.`);
    const stats = context.db.getStats(interaction.guildId, user.id);
    const skills = context.v2.skills(interaction.guildId, user.id).slice(0, 6);
    const wallet = context.v2.wallet(interaction.guildId, user.id);
    const achievements = context.db.getAchievements(interaction.guildId, user.id);
    const projects = context.db.listProjects(interaction.guildId, undefined, user.id, 20);
    const card = embed(context, `🪪 Developer Passport • ${user.displayName}`, truncate(profile.bio, 500))
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .addFields(...fields([
        ['Stack', profile.skills || 'Not set'],
        ['Experience', `Level **${stats.level}** • ${stats.xp} XP`, true],
        ['Reputation', `${stats.reputation} points`, true],
        ['Projects', `${projects.length} created`, true],
        ['Availability', profile.availability ?? 'Not set', true],
        ['Timezone', profile.timezone ?? 'Not set', true],
        ['Credits', String(wallet.credits), true],
        ['Verified skill XP', skills.length ? skills.map((item) => `**${item.area}** ${item.xp}`).join(' • ') : 'No verified activity yet'],
        ['Achievements', achievements.length ? achievements.slice(0, 8).map((item) => `\`${item.code}\``).join(' ') : 'No achievements yet'],
        ['Links', [profile.github && `[GitHub](${profile.github})`, profile.portfolio && `[Portfolio](${profile.portfolio})`].filter(Boolean).join(' • ') || 'Not provided'],
      ]));
    await interaction.reply({ embeds: [card] });
  },
};

const discoverCommand: BotCommand = {
  module: 'projects',
  data: new SlashCommandBuilder().setName('discover').setDescription('Find opportunities matched to your developer profile.')
    .addStringOption((option) => option.setName('skill').setDescription('Override the skills in your profile.').setMaxLength(120)),
  async execute(interaction, context) {
    const profile = context.db.getProfile(interaction.guildId, interaction.user.id);
    const skills = interaction.options.getString('skill') ?? profile?.skills ?? '';
    if (!skills) return deny(interaction, context, 'Create a profile or provide the `skill` option so DevForge can match opportunities.');
    const projects = context.db.listProjects(interaction.guildId, undefined, undefined, 50)
      .filter((project) => project.owner_id !== interaction.user.id)
      .map((project) => ({ project, score: matchScore(skills, project.stack) }))
      .filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score || b.project.stars - a.project.stars).slice(0, 5);
    const reviews = context.db.listReviews(interaction.guildId, undefined, 30)
      .filter((review) => review.author_id !== interaction.user.id && matchScore(skills, review.language) > 0).slice(0, 3);
    const description = projects.length
      ? projects.map(({ project, score }) => `🚀 **${project.title}** · \`${project.id}\` · ${project.stack} · match ${score}`).join('\n')
      : 'No matching open projects right now.';
    const reviewText = reviews.length ? reviews.map((review) => `🔎 **${review.title}** · \`${review.id}\` · ${review.language}`).join('\n') : 'No matching reviews right now.';
    await interaction.reply({ embeds: [embed(context, '🧭 Opportunities for you', `Matched from: **${skills}**`).addFields(...fields([
      ['Projects', description], ['Code review queue', reviewText], ['Next step', 'Use `/project info`, `/project browse`, or `/review list` to continue.'],
    ]))], ephemeral: true });
  },
};

const healthCommand: BotCommand = {
  module: 'projects',
  data: new SlashCommandBuilder().setName('projecthealth').setDescription('Measure project momentum and rescue inactive work.')
    .addSubcommand((sub) => sub.setName('check').setDescription('Calculate a project health score.')
      .addStringOption((option) => option.setName('project_id').setDescription('Project ID.').setRequired(true)))
    .addSubcommand((sub) => sub.setName('rescue').setDescription('Publish a rescue call for an at-risk project.')
      .addStringOption((option) => option.setName('project_id').setDescription('Project ID.').setRequired(true))
      .addStringOption((option) => option.setName('needs').setDescription('What help is needed?').setRequired(true).setMaxLength(500))),
  async execute(interaction, context) {
    const projectId = interaction.options.getString('project_id', true);
    const project = context.db.getProject(projectId);
    if (!project || project.guild_id !== interaction.guildId) return deny(interaction, context, 'Project not found in this server.');
    const result = projectHealth(project, projectSignals(context, interaction.guildId, project.id));
    if (interaction.options.getSubcommand() === 'rescue') {
      const member = interaction.member as GuildMember;
      if (project.owner_id !== interaction.user.id && !member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return deny(interaction, context, 'Only the project owner or a server manager can start a rescue campaign.');
      }
      const needs = interaction.options.getString('needs', true);
      const existing = context.v2.listItems({ guildId: interaction.guildId, type: 'project_rescue', status: 'open', limit: 100 })
        .find((item) => item.data['projectId'] === project.id);
      if (existing) return deny(interaction, context, `A rescue campaign is already open: \`${existing.id}\`.`);
      const rescue = context.v2.createItem({ guildId: interaction.guildId, type: 'project_rescue', ownerId: interaction.user.id,
        title: project.title, status: 'open', data: { projectId: project.id, needs }, idPrefix: 'rescue' });
      await interaction.reply({ embeds: [embed(context, `🛟 Project Rescue • ${project.title}`, needs).addFields(...fields([
        ['Campaign ID', `\`${rescue.id}\``, true], ['Health', `${result.score}/100 • ${result.state}`, true],
        ['Stack', project.stack], ['How to help', `Use \`/project info project_id:${project.id}\` and contact <@${project.owner_id}>.`],
      ]))] });
      return;
    }
    await interaction.reply({ embeds: [embed(context, `💚 Project Health • ${project.title}`, `**${result.score}/100 — ${result.state}**`)
      .addFields(...fields([
        ['Positive signals', result.reasons.join('\n') || 'No recent positive signals found.'],
        ['Recommended actions', result.recommendations.map((item) => `• ${item}`).join('\n') || 'Keep the current rhythm and document progress.'],
      ]))], ephemeral: true });
  },
};

const workspaceCommand: BotCommand = {
  module: 'projects',
  data: new SlashCommandBuilder().setName('workspace').setDescription('Create or archive a private project workspace.')
    .addSubcommand((sub) => sub.setName('create').setDescription('Create project channels and a team role.')
      .addStringOption((option) => option.setName('project_id').setDescription('Project ID.').setRequired(true)))
    .addSubcommand((sub) => sub.setName('archive').setDescription('Archive a project workspace.')
      .addStringOption((option) => option.setName('project_id').setDescription('Project ID.').setRequired(true))),
  async execute(interaction, context) {
    const projectId = interaction.options.getString('project_id', true);
    const project = context.db.getProject(projectId);
    if (!project || project.guild_id !== interaction.guildId) return deny(interaction, context, 'Project not found in this server.');
    const member = interaction.member as GuildMember;
    if (project.owner_id !== interaction.user.id && !member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return deny(interaction, context, 'Only the project owner or a channel manager can manage its workspace.');
    }
    const existing = context.v2.listItems<WorkspaceData>({ guildId: interaction.guildId, type: 'project_workspace', limit: 100 })
      .find((item) => item.data.projectId === project.id && item.status === 'active');
    if (interaction.options.getSubcommand() === 'archive') {
      if (!existing) return deny(interaction, context, 'This project has no active workspace.');
      await interaction.deferReply({ ephemeral: true });
      for (const id of [existing.data.textChannelId, existing.data.voiceChannelId, existing.data.categoryId]) {
        const channel = interaction.guild.channels.cache.get(id);
        if (channel) await channel.delete(`Project workspace archived by ${interaction.user.tag}`).catch(() => null);
      }
      const role = interaction.guild.roles.cache.get(existing.data.roleId);
      if (role) await role.delete(`Project workspace archived by ${interaction.user.tag}`).catch(() => null);
      context.v2.updateItem(existing.id, { status: 'archived' });
      await interaction.editReply({ embeds: [successEmbed(context, 'Workspace archived', `The workspace for **${project.title}** was archived.`)] });
      return;
    }
    if (existing) return deny(interaction, context, `This project already has an active workspace in <#${existing.data.textChannelId}>.`);
    await interaction.deferReply({ ephemeral: true });
    const role = await interaction.guild.roles.create({ name: truncate(`Project • ${project.title}`, 100), mentionable: true, reason: `DevForge workspace ${project.id}` });
    const botId = context.client.user.id;
    const category = await interaction.guild.channels.create({ name: truncate(`project-${project.title}`, 100), type: ChannelType.GuildCategory,
      permissionOverwrites: [
        { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: role.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.Connect] },
        { id: botId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.SendMessages] },
      ] });
    const slug = truncate(project.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || project.id, 80);
    const text = await interaction.guild.channels.create({ name: `${slug}-hub`, type: ChannelType.GuildText, parent: category.id });
    const voice = await interaction.guild.channels.create({ name: truncate(`${project.title} • Pairing`, 100), type: ChannelType.GuildVoice, parent: category.id });
    await member.roles.add(role).catch(() => null);
    const item = context.v2.createItem<WorkspaceData>({ guildId: interaction.guildId, type: 'project_workspace', ownerId: project.owner_id,
      title: project.id, status: 'active', data: { projectId: project.id, roleId: role.id, categoryId: category.id, textChannelId: text.id, voiceChannelId: voice.id }, idPrefix: 'space' });
    await text.send({ embeds: [embed(context, `🏗️ ${project.title}`, project.summary).addFields(...fields([
      ['Project ID', `\`${project.id}\``, true], ['Workspace ID', `\`${item.id}\``, true], ['Stack', project.stack],
      ['Workflow', 'Use `/todo`, `/standups`, `/project milestone`, `/devlog`, and `/projecthealth check` to keep momentum visible.'],
    ]))] });
    await interaction.editReply({ embeds: [successEmbed(context, 'Workspace created', `${text} and ${voice} are ready. Assign ${role} to accepted collaborators.`)] });
  },
};

export const platformCommands: BotCommand[] = [passportCommand, discoverCommand, healthCommand, workspaceCommand];

import {
  ActionRowBuilder,
  ChannelType,
  ModalBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { projectButtons, projectCard } from './projects.js';
import { embed, fields, successEmbed } from '../theme.js';
import type { BotCommand, ComponentHandler, ModalHandler } from '../types.js';
import { deny, isHttpUrl, normalizedCsv, truncate } from '../utils.js';

function standupModal(): ModalBuilder {
  return new ModalBuilder().setCustomId('standup:create').setTitle('Async developer stand-up').addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('shipped').setLabel('Yesterday / shipped / learned').setStyle(TextInputStyle.Paragraph).setMaxLength(700).setRequired(true)),
    new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('next').setLabel('Today / next meaningful step').setStyle(TextInputStyle.Paragraph).setMaxLength(700).setRequired(true)),
    new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('blockers').setLabel('Blockers or help wanted').setPlaceholder('Write “None” if unblocked.').setStyle(TextInputStyle.Paragraph).setMaxLength(500).setRequired(true)),
    new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('mood').setLabel('Energy / focus in one line').setStyle(TextInputStyle.Short).setMaxLength(100).setRequired(false)),
  );
}

const standupsCommand: BotCommand = {
  module: 'standups',
  data: new SlashCommandBuilder()
    .setName('standups')
    .setDescription('Schedule team stand-ups, submit updates, and generate summaries.')
    .addSubcommand((subcommand) => subcommand.setName('submit').setDescription('Submit your stand-up update.'))
    .addSubcommand((subcommand) =>
      subcommand.setName('schedule').setDescription('Schedule automatic stand-up prompts.')
        .addChannelOption((option) => option.setName('channel').setDescription('Prompt destination.').setRequired(true).addChannelTypes(ChannelType.GuildText))
        .addStringOption((option) => option.setName('frequency').setDescription('Prompt frequency.').setRequired(true).addChoices({ name: 'Every day', value: 'daily' }, { name: 'Weekdays', value: 'weekdays' }, { name: 'Every Monday', value: 'weekly' }))
        .addIntegerOption((option) => option.setName('hour_utc').setDescription('UTC hour, 0–23.').setRequired(true).setMinValue(0).setMaxValue(23))
        .addRoleOption((option) => option.setName('team_role').setDescription('Optional team role to mention.')),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('summary').setDescription('Summarize recent team updates.')
        .addIntegerOption((option) => option.setName('days').setDescription('1–14 days.').setMinValue(1).setMaxValue(14)),
    )
    .addSubcommand((subcommand) => subcommand.setName('streak').setDescription('View your stand-up streak.'))
    .addSubcommand((subcommand) => subcommand.setName('disable').setDescription('Disable automatic prompts.')),
  async execute(interaction, context) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'submit') {
      await interaction.showModal(standupModal());
      return;
    }
    if (subcommand === 'streak') {
      const streak = context.v2.streaks(interaction.guildId, interaction.user.id).find((item) => item.kind === 'standup');
      await interaction.reply({ embeds: [embed(context, '☀️ Stand-up streak', streak ? `Current: **${streak.current_count}** • Best: **${streak.best_count}** • Last update: **${streak.last_date}**` : 'Submit your first update with `/standups submit`.')], ephemeral: true });
      return;
    }
    if (subcommand === 'summary') {
      const days = interaction.options.getInteger('days') ?? 7;
      const cutoff = Date.now() - days * 86_400_000;
      const updates = context.v2.listItems({ guildId: interaction.guildId, type: 'standup', limit: 100 }).filter((item) => new Date(item.created_at).getTime() >= cutoff);
      const blockers = updates.filter((item) => !/^none\.?$/i.test(String(item.data['blockers']).trim()));
      const contributors = new Set(updates.map((item) => item.owner_id));
      const recent = updates.slice(0, 12).map((item) => `**<@${item.owner_id}>** • shipped: ${truncate(String(item.data['shipped']), 120)}\nNext: ${truncate(String(item.data['next']), 120)}`).join('\n\n');
      await interaction.reply({ embeds: [embed(context, `☀️ Stand-up summary • ${days} days`).addFields(...fields([
        ['Participation', `${updates.length} updates from ${contributors.size} member(s)`, true],
        ['Blockers needing attention', String(blockers.length), true],
        ['Recent progress', recent || 'No updates in this period.'],
        ['Blocker digest', blockers.slice(0, 8).map((item) => `<@${item.owner_id}> — ${truncate(String(item.data['blockers']), 160)}`).join('\n') || 'No blockers reported.'],
      ]))] });
      return;
    }
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
      await deny(interaction, context, 'You need **Manage Server** to configure stand-up prompts.');
      return;
    }
    if (subcommand === 'disable') {
      const current = context.v2.getSetting(interaction.guildId, 'standups.config', { enabled: false, channelId: '', frequency: 'weekdays', hourUtc: 12, roleId: null, lastPromptDate: null });
      context.v2.setSetting(interaction.guildId, 'standups.config', { ...current, enabled: false });
      await interaction.reply({ embeds: [successEmbed(context, 'Stand-up prompts disabled', 'Manual submissions and summaries remain available.')], ephemeral: true });
      return;
    }
    const channel = interaction.options.getChannel('channel', true);
    const config = {
      enabled: true,
      channelId: channel.id,
      frequency: interaction.options.getString('frequency', true),
      hourUtc: interaction.options.getInteger('hour_utc', true),
      roleId: interaction.options.getRole('team_role')?.id ?? null,
      lastPromptDate: null,
    };
    context.v2.setSetting(interaction.guildId, 'standups.config', config);
    await interaction.reply({ embeds: [successEmbed(context, 'Stand-up schedule saved', `Prompts will post to ${channel} at **${config.hourUtc}:00 UTC** (${config.frequency}).`)], ephemeral: true });
  },
};

const DEBUG_QUESTIONS = [
  'What is the smallest input or reproduction that still fails?',
  'At which exact step does actual state first diverge from expected state?',
  'Which assumption can you verify with a log, assertion, or unit test right now?',
  'What changed immediately before this bug appeared: code, data, dependency, environment, or timing?',
  'Can you name one working case and one failing case, then list only their differences?',
  'State your strongest hypothesis and the smallest experiment that could disprove it.',
] as const;

export const v2CollaborationComponents: ComponentHandler[] = [
  {
    prefix: 'v2:duck:next:',
    async execute(interaction, context) {
      if (!interaction.inCachedGuild()) return;
      const id = interaction.customId.split(':')[3] ?? '';
      const item = context.v2.getItem(id, 'rubberduck_session');
      if (!item || item.guild_id !== interaction.guildId || item.owner_id !== interaction.user.id || item.status !== 'active') {
        await deny(interaction, context, 'This debugging session is not active or does not belong to you.');
        return;
      }
      const current = Number(item.data['step'] ?? 0);
      const question = DEBUG_QUESTIONS[Math.min(current, DEBUG_QUESTIONS.length - 1)]!;
      context.v2.updateItem(item.id, { data: { step: current + 1 } });
      await interaction.reply({ embeds: [embed(context, `🦆 Debugging question ${Math.min(current + 1, DEBUG_QUESTIONS.length)}/${DEBUG_QUESTIONS.length}`, `${question}\n\nWrite the answer in your working notes, then press **Next debugging question**.`).setColor(0xfbbf24)], ephemeral: true });
    },
  },
  {
    prefix: 'v2:duck:solved:',
    async execute(interaction, context) {
      if (!interaction.inCachedGuild()) return;
      const id = interaction.customId.split(':')[3] ?? '';
      const item = context.v2.getItem(id, 'rubberduck_session');
      if (!item || item.guild_id !== interaction.guildId || item.owner_id !== interaction.user.id) {
        await deny(interaction, context, 'This debugging session does not belong to you.');
        return;
      }
      context.v2.updateItem(item.id, { status: 'solved' });
      context.v2.changeCredits(interaction.guildId, interaction.user.id, 5, 'Completed Rubber Duck debugging', item.id);
      context.v2.updateStreak(interaction.guildId, interaction.user.id, 'debugging');
      await interaction.reply({ embeds: [successEmbed(context, 'Bug resolved', 'Session archived. You earned **5 credits** for completing the debugging loop.')], ephemeral: true });
    },
  },
  {
    prefix: 'v2:idea:interest:',
    async execute(interaction, context) {
      if (!interaction.inCachedGuild()) return;
      const id = interaction.customId.split(':')[3] ?? '';
      const item = context.v2.getItem(id, 'idea');
      if (!item || item.guild_id !== interaction.guildId) {
        await deny(interaction, context, 'This idea is no longer available.');
        return;
      }
      const existing = context.v2.getMember(item.id, interaction.user.id);
      if (existing) context.v2.removeMember(item.id, interaction.user.id);
      else context.v2.setMember({ itemId: item.id, userId: interaction.user.id, role: 'interested' });
      const total = context.v2.listMembers(item.id).length;
      await interaction.reply({ embeds: [successEmbed(context, existing ? 'Interest removed' : 'Interest registered', `**${total}** member(s) are interested in this idea.`)], ephemeral: true });
    },
  },
  {
    prefix: 'v2:idea:convert:',
    async execute(interaction, context) {
      if (!interaction.inCachedGuild()) return;
      const id = interaction.customId.split(':')[3] ?? '';
      const item = context.v2.getItem(id, 'idea');
      if (!item || item.guild_id !== interaction.guildId) return;
      if (item.owner_id !== interaction.user.id && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        await deny(interaction, context, 'Only the idea author or a server manager can convert it.');
        return;
      }
      const modal = new ModalBuilder().setCustomId(`v2:idea:convert-submit:${id}`).setTitle('Convert idea to project').addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('stack').setLabel('Tech stack').setPlaceholder('TypeScript, PostgreSQL, Docker').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(200)),
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('repository').setLabel('Repository URL (optional)').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(300)),
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('looking_for').setLabel('Who or what are you looking for?').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(300)),
      );
      await interaction.showModal(modal);
    },
  },
];

export const v2CollaborationModals: ModalHandler[] = [
  {
    prefix: 'v2:idea:convert-submit:',
    async execute(interaction, context) {
      const id = interaction.customId.split(':')[3] ?? '';
      const item = context.v2.getItem(id, 'idea');
      if (!item || item.guild_id !== interaction.guildId) {
        await deny(interaction, context, 'Idea not found.');
        return;
      }
      const repository = interaction.fields.getTextInputValue('repository').trim();
      if (repository && !isHttpUrl(repository)) {
        await deny(interaction, context, 'Repository must be a valid http:// or https:// URL.');
        return;
      }
      const project = context.db.createProject({
        guildId: interaction.guildId,
        ownerId: item.owner_id,
        title: item.title,
        summary: String(item.data['proposal'] || item.data['problem']),
        stack: normalizedCsv(interaction.fields.getTextInputValue('stack')),
        repoUrl: repository || null,
        demoUrl: null,
        lookingFor: interaction.fields.getTextInputValue('looking_for').trim() || null,
      });
      context.v2.updateItem(item.id, { status: 'converted', data: { projectId: project.id } });
      context.v2.createItem({ guildId: interaction.guildId, type: 'project_meta', ownerId: item.owner_id, title: project.id, data: { state: 'planning', sourceIdeaId: item.id }, idPrefix: 'pmeta' });
      await interaction.reply({ embeds: [projectCard(context, project)], components: [projectButtons(project)] });
    },
  },
];

export const v2CollaborationCommands: BotCommand[] = [standupsCommand];

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { evaluateAchievements } from '../services/achievements.js';
import { embed, fields, successEmbed } from '../theme.js';
import type { BotCommand, BotContext, ProjectRow, ReviewRow } from '../types.js';
import { deny, relativeTimestamp, truncate } from '../utils.js';

export function projectCard(context: BotContext, project: ProjectRow): EmbedBuilder {
  const links = [
    project.repo_url ? `[Repository](${project.repo_url})` : null,
    project.demo_url ? `[Live demo](${project.demo_url})` : null,
  ]
    .filter(Boolean)
    .join(' • ');
  return embed(context, `🚀 ${project.title}`, project.summary)
    .setColor(project.status === 'open' ? context.config.accentColor : 0x64748b)
    .addFields(
      ...fields([
        ['Tech stack', project.stack],
        ['Looking for', project.looking_for ?? 'Feedback and community support'],
        ['Links', links || 'No public links', true],
        ['Stars', `⭐ ${project.stars}`, true],
        ['Status', project.status === 'open' ? '🟢 Open to collaboration' : '⚫ Closed', true],
        ['Creator', `<@${project.owner_id}> • ${relativeTimestamp(project.created_at)}`],
        ['Project ID', `\`${project.id}\``],
      ]),
    );
}

export function projectButtons(project: ProjectRow): ActionRowBuilder<ButtonBuilder> {
  const closed = project.status !== 'open';
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`project:star:${project.id}`)
      .setLabel(`${project.stars} ${project.stars === 1 ? 'star' : 'stars'}`)
      .setEmoji('⭐')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`project:apply:${project.id}`)
      .setLabel('Join project')
      .setEmoji('🤝')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(closed),
  );
}

export function reviewCard(context: BotContext, review: ReviewRow): EmbedBuilder {
  const status = {
    open: '🟢 Waiting for a reviewer',
    claimed: `🟡 Claimed by <@${review.reviewer_id}>`,
    completed: '✅ Review completed',
    cancelled: '⚫ Cancelled',
  }[review.status];
  return embed(context, `🔎 ${review.title}`, review.description)
    .setColor(review.status === 'open' ? 0xf59e0b : review.status === 'completed' ? 0x22c55e : context.config.primaryColor)
    .addFields(
      ...fields([
        ['Repository', `[Open repository](${review.repository})`],
        ['Language / stack', review.language, true],
        ['Complexity', review.difficulty, true],
        ['Status', status, true],
        ['Requested by', `<@${review.author_id}> • ${relativeTimestamp(review.created_at)}`],
        ['Review ID', `\`${review.id}\``],
      ]),
    );
}

export function reviewButtons(review: ReviewRow): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`review:claim:${review.id}`)
      .setLabel(review.status === 'open' ? 'Claim review' : 'Claimed')
      .setEmoji('🙋')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(review.status !== 'open'),
    new ButtonBuilder()
      .setCustomId(`review:complete:${review.id}`)
      .setLabel('Mark complete')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success)
      .setDisabled(review.status !== 'claimed'),
  );
}

const projectCommand: BotCommand = {
  module: 'projects',
  data: new SlashCommandBuilder()
    .setName('project')
    .setDescription('Publish projects, discover builders, and find collaborators.')
    .addSubcommand((subcommand) => subcommand.setName('create').setDescription('Publish a project through a guided form.'))
    .addSubcommand((subcommand) =>
      subcommand
        .setName('browse')
        .setDescription('Browse open community projects.')
        .addStringOption((option) => option.setName('stack').setDescription('Filter by language or technology.').setMaxLength(50)),
    )
    .addSubcommand((subcommand) => subcommand.setName('mine').setDescription('View your recent projects.'))
    .addSubcommand((subcommand) =>
      subcommand
        .setName('info')
        .setDescription('View one project by ID.')
        .addStringOption((option) => option.setName('id').setDescription('Project ID.').setRequired(true).setAutocomplete(true)),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('close')
        .setDescription('Close one of your projects to new applications.')
        .addStringOption((option) => option.setName('id').setDescription('Project ID.').setRequired(true).setAutocomplete(true)),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('status').setDescription('Update a project lifecycle state.')
        .addStringOption((option) => option.setName('id').setDescription('Project ID.').setRequired(true).setAutocomplete(true))
        .addStringOption((option) => option.setName('state').setDescription('Lifecycle state.').setRequired(true).addChoices(
          { name: 'Planning', value: 'planning' },
          { name: 'Development', value: 'development' },
          { name: 'Testing', value: 'testing' },
          { name: 'Maintenance', value: 'maintenance' },
          { name: 'Paused', value: 'paused' },
          { name: 'Archived', value: 'archived' },
        )),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('milestone').setDescription('Add a project milestone.')
        .addStringOption((option) => option.setName('id').setDescription('Project ID.').setRequired(true).setAutocomplete(true))
        .addStringOption((option) => option.setName('title').setDescription('Milestone title.').setRequired(true).setMaxLength(100))
        .addStringOption((option) => option.setName('description').setDescription('Scope and success criteria.').setRequired(true).setMaxLength(700))
        .addStringOption((option) => option.setName('deadline').setDescription('Optional ISO date.').setMaxLength(100)),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('changelog').setDescription('Publish a project changelog entry.')
        .addStringOption((option) => option.setName('id').setDescription('Project ID.').setRequired(true).setAutocomplete(true))
        .addStringOption((option) => option.setName('version').setDescription('Version or release name.').setRequired(true).setMaxLength(50))
        .addStringOption((option) => option.setName('changes').setDescription('What changed?').setRequired(true).setMaxLength(1200)),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('vacancy').setDescription('Publish an open role on a project.')
        .addStringOption((option) => option.setName('id').setDescription('Project ID.').setRequired(true).setAutocomplete(true))
        .addStringOption((option) => option.setName('role').setDescription('Role or contribution needed.').setRequired(true).setMaxLength(100))
        .addStringOption((option) => option.setName('skills').setDescription('Required or useful skills.').setRequired(true).setMaxLength(250))
        .addIntegerOption((option) => option.setName('slots').setDescription('Number of openings.').setRequired(true).setMinValue(1).setMaxValue(50)),
    ),
  async execute(interaction, context) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'create') {
      const modal = new ModalBuilder().setCustomId('project:create').setTitle('Publish a developer project');
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('title')
            .setLabel('Project name')
            .setPlaceholder('Open-source API monitor')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(80)
            .setRequired(true),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('summary')
            .setLabel('What does it do?')
            .setPlaceholder('Describe the problem, solution, and current stage.')
            .setStyle(TextInputStyle.Paragraph)
            .setMinLength(30)
            .setMaxLength(800)
            .setRequired(true),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('stack')
            .setLabel('Tech stack (comma-separated)')
            .setPlaceholder('TypeScript, Node.js, PostgreSQL')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(200)
            .setRequired(true),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('links')
            .setLabel('Repository and demo URLs (one per line)')
            .setPlaceholder('https://github.com/owner/repo\nhttps://demo.example.com')
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(500)
            .setRequired(false),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('looking_for')
            .setLabel('Who or what are you looking for?')
            .setPlaceholder('UI contributors, security feedback, beta testers…')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(200)
            .setRequired(false),
        ),
      );
      await interaction.showModal(modal);
      return;
    }

    if (subcommand === 'browse') {
      const stack = interaction.options.getString('stack')?.trim();
      const projects = context.db.listProjects(interaction.guildId, stack);
      const body = projects.length
        ? projects
            .map(
              (project, index) =>
                `**${index + 1}. ${truncate(project.title, 70)}** — ${project.stars} ⭐\n${truncate(project.summary, 150)}\n` +
                `\`${project.id}\` • ${truncate(project.stack, 80)} • <@${project.owner_id}>`,
            )
            .join('\n\n')
        : 'No open projects match that filter yet. Start one with `/project create`.';
      await interaction.reply({
        embeds: [embed(context, stack ? `🚀 Projects using ${stack}` : '🚀 Open Community Projects', body)],
      });
      return;
    }

    if (subcommand === 'mine') {
      const projects = context.db.listProjects(interaction.guildId, undefined, interaction.user.id);
      const body = projects.length
        ? projects
            .map(
              (project) =>
                `\`${project.id}\` **${truncate(project.title, 70)}** — ${project.status === 'open' ? '🟢 open' : '⚫ closed'} • ${project.stars} ⭐`,
            )
            .join('\n')
        : 'You have not published a project yet. Use `/project create` when you are ready to ship.';
      await interaction.reply({ embeds: [embed(context, '🧰 Your Projects', body)], ephemeral: true });
      return;
    }

    const id = interaction.options.getString('id', true);
    const project = context.db.getProject(id);
    if (!project || project.guild_id !== interaction.guildId) {
      await deny(interaction, context, 'That project does not exist in this server.');
      return;
    }
    if (subcommand === 'info') {
      await interaction.reply({ embeds: [projectCard(context, project)], components: [projectButtons(project)] });
      return;
    }

    const canManage = project.owner_id === interaction.user.id || interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild);
    if (!canManage) {
      await deny(interaction, context, 'Only the project creator or a server manager can manage this project.');
      return;
    }

    if (subcommand === 'status') {
      const state = interaction.options.getString('state', true);
      const existing = context.v2.listItems({ guildId: interaction.guildId, type: 'project_meta', ownerId: project.owner_id, limit: 100 })
        .find((item) => item.title === project.id);
      if (existing) context.v2.updateItem(existing.id, { data: { state } });
      else context.v2.createItem({ guildId: interaction.guildId, type: 'project_meta', ownerId: project.owner_id, title: project.id, data: { state }, idPrefix: 'pmeta' });
      context.v2.audit(interaction.guildId, interaction.user.id, 'project.status', state, project.id);
      await interaction.reply({ embeds: [successEmbed(context, 'Project status updated', `**${project.title}** is now **${state}**.`)] });
      return;
    }

    if (subcommand === 'milestone') {
      const deadlineInput = interaction.options.getString('deadline');
      const deadline = deadlineInput ? new Date(deadlineInput) : null;
      if (deadline && Number.isNaN(deadline.getTime())) {
        await deny(interaction, context, 'Use a valid ISO deadline, for example `2026-10-15`.');
        return;
      }
      const milestone = context.v2.createItem({
        guildId: interaction.guildId,
        type: 'project_milestone',
        ownerId: project.owner_id,
        title: interaction.options.getString('title', true),
        status: 'planned',
        dueAt: deadline?.toISOString() ?? null,
        data: { projectId: project.id, description: interaction.options.getString('description', true) },
        idPrefix: 'mile',
      });
      await interaction.reply({ embeds: [embed(context, `🏁 ${project.title} • ${milestone.title}`, String(milestone.data['description'])).addFields(...fields([
        ['Milestone ID', `\`${milestone.id}\``, true],
        ['Deadline', milestone.due_at ? `<t:${Math.floor(new Date(milestone.due_at).getTime() / 1000)}:F>` : 'Not set', true],
      ]))] });
      return;
    }

    if (subcommand === 'changelog') {
      const version = interaction.options.getString('version', true);
      const changes = interaction.options.getString('changes', true);
      const entry = context.v2.createItem({ guildId: interaction.guildId, type: 'project_changelog', ownerId: project.owner_id, title: `${project.id}:${version}`, data: { projectId: project.id, version, changes }, idPrefix: 'change' });
      await interaction.reply({ embeds: [embed(context, `📝 ${project.title} • ${version}`, changes).addFields({ name: 'Changelog ID', value: `\`${entry.id}\`` })] });
      return;
    }

    if (subcommand === 'vacancy') {
      const role = interaction.options.getString('role', true);
      const vacancy = context.v2.createItem({ guildId: interaction.guildId, type: 'project_vacancy', ownerId: project.owner_id, title: role, status: 'open', data: {
        projectId: project.id,
        skills: interaction.options.getString('skills', true),
        slots: interaction.options.getInteger('slots', true),
      }, idPrefix: 'vac' });
      await interaction.reply({ embeds: [embed(context, `📁 ${project.title} is recruiting`, `**${role}**`).addFields(...fields([
        ['Skills', String(vacancy.data['skills'])], ['Openings', String(vacancy.data['slots']), true], ['Vacancy ID', `\`${vacancy.id}\``, true], ['Apply', `Use the **Join project** button on \`/project info id:${project.id}\`.`],
      ]))] });
      return;
    }

    context.db.closeProject(project.id);
    const closed = context.db.getProject(project.id)!;
    if (project.channel_id && project.message_id) {
      try {
        const channel = await context.client.channels.fetch(project.channel_id);
        if (channel?.isTextBased() && !channel.isDMBased()) {
          const message = await channel.messages.fetch(project.message_id);
          await message.edit({ embeds: [projectCard(context, closed)], components: [projectButtons(closed)] });
        }
      } catch (error) {
        context.logger.warn('Could not update the original project message.', { projectId: project.id, error: String(error) });
      }
    }
    await interaction.reply({
      embeds: [successEmbed(context, 'Project closed', `**${closed.title}** is no longer accepting applications.`)],
      ephemeral: true,
    });
  },
  async autocomplete(interaction, context) {
    const query = interaction.options.getFocused().toLowerCase();
    const projects = context.db.listProjects(interaction.guildId, undefined, interaction.user.id, 25);
    await interaction.respond(
      projects
        .filter((project) => project.id.toLowerCase().includes(query) || project.title.toLowerCase().includes(query))
        .slice(0, 25)
        .map((project) => ({ name: `${truncate(project.title, 70)} • ${project.status}`, value: project.id })),
    );
  },
};

const reviewCommand: BotCommand = {
  module: 'reviews',
  data: new SlashCommandBuilder()
    .setName('review')
    .setDescription('Request, claim, and complete structured peer code reviews.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('request')
        .setDescription('Open a code-review request.')
        .addStringOption((option) =>
          option
            .setName('complexity')
            .setDescription('Estimated review complexity.')
            .setRequired(true)
            .addChoices(
              { name: 'Quick look • under 15 minutes', value: 'Quick' },
              { name: 'Focused • 15–45 minutes', value: 'Focused' },
              { name: 'Deep dive • 45+ minutes', value: 'Deep dive' },
            ),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('assign').setDescription('Assign an open review to a reviewer (staff).')
        .addStringOption((option) => option.setName('id').setDescription('Review ID.').setRequired(true))
        .addUserOption((option) => option.setName('reviewer').setDescription('Reviewer.').setRequired(true)),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('priority').setDescription('Set review queue priority.')
        .addStringOption((option) => option.setName('id').setDescription('Review ID.').setRequired(true))
        .addStringOption((option) => option.setName('level').setDescription('Priority.').setRequired(true).addChoices(
          { name: 'Low', value: 'low' }, { name: 'Normal', value: 'normal' }, { name: 'High', value: 'high' }, { name: 'Urgent', value: 'urgent' },
        )),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('comment').setDescription('Add a structured comment to a review request.')
        .addStringOption((option) => option.setName('id').setDescription('Review ID.').setRequired(true))
        .addStringOption((option) => option.setName('comment').setDescription('Constructive review feedback.').setRequired(true).setMinLength(20).setMaxLength(1000)),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('match').setDescription('Automatically match an open request with a skilled reviewer.')
        .addStringOption((option) => option.setName('id').setDescription('Review ID.').setRequired(true)),
    )
    .addSubcommand((subcommand) => subcommand.setName('queue').setDescription('View open and claimed review requests.'))
    .addSubcommand((subcommand) => subcommand.setName('mine').setDescription('View reviews you requested or claimed.')),
  async execute(interaction, context) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'request') {
      const complexity = interaction.options.getString('complexity', true);
      const modal = new ModalBuilder().setCustomId(`review:create:${complexity}`).setTitle('Request a peer code review');
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('title')
            .setLabel('Review title')
            .setPlaceholder('Authentication middleware review')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(100)
            .setRequired(true),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('description')
            .setLabel('What should the reviewer focus on?')
            .setPlaceholder('Security, error handling, API design…')
            .setStyle(TextInputStyle.Paragraph)
            .setMinLength(20)
            .setMaxLength(800)
            .setRequired(true),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('repository')
            .setLabel('Public repository or pull request URL')
            .setPlaceholder('https://github.com/owner/repo/pull/42')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(300)
            .setRequired(true),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('language')
            .setLabel('Primary language / stack')
            .setPlaceholder('Go, PostgreSQL, Docker')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(100)
            .setRequired(true),
        ),
      );
      await interaction.showModal(modal);
      return;
    }

    if (['assign', 'priority', 'comment', 'match'].includes(subcommand)) {
      const id = interaction.options.getString('id', true);
      const review = context.db.getReview(id);
      if (!review || review.guild_id !== interaction.guildId) {
        await deny(interaction, context, 'Review request not found in this server.');
        return;
      }
      if (subcommand === 'assign') {
        if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
          await deny(interaction, context, 'You need **Manage Server** to assign reviewers.');
          return;
        }
        const reviewer = interaction.options.getUser('reviewer', true);
        if (reviewer.bot || !context.db.claimReview(review.id, reviewer.id)) {
          await deny(interaction, context, 'The reviewer is invalid or this review is no longer open.');
          return;
        }
        context.v2.audit(interaction.guildId, interaction.user.id, 'review.assigned', reviewer.id, review.id);
        await interaction.reply({ embeds: [successEmbed(context, 'Reviewer assigned', `${reviewer} is now assigned to **${review.title}**.`)] });
        return;
      }
      if (subcommand === 'match') {
        if (review.author_id !== interaction.user.id && !interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages)) {
          await deny(interaction, context, 'Only the request author or moderators can run automatic matching.');
          return;
        }
        if (review.status !== 'open') {
          await deny(interaction, context, 'Only open review requests can be matched.');
          return;
        }
        const candidates = context.db.searchProfiles(interaction.guildId, review.language, 25)
          .filter((profile) => profile.user_id !== review.author_id)
          .map((profile) => ({ profile, stats: context.db.getStats(interaction.guildId, profile.user_id) }))
          .sort((first, second) => second.stats.reputation - first.stats.reputation || second.stats.level - first.stats.level);
        const candidate = candidates[0];
        if (!candidate || !context.db.claimReview(review.id, candidate.profile.user_id)) {
          await deny(interaction, context, `No available developer profile matches **${review.language}** right now.`);
          return;
        }
        const reviewer = await context.client.users.fetch(candidate.profile.user_id).catch(() => null);
        await reviewer?.send({ embeds: [embed(context, `🔎 Code review matched in ${interaction.guild.name}`, `You were matched to **${review.title}** because your profile includes **${review.language}**. Repository: ${review.repository}`)] }).catch(() => null);
        context.v2.audit(interaction.guildId, context.client.user.id, 'review.auto_matched', candidate.profile.user_id, review.id);
        await interaction.reply({ embeds: [successEmbed(context, 'Reviewer matched', `<@${candidate.profile.user_id}> was selected using skills, reputation, and level.`)] });
        return;
      }
      if (subcommand === 'priority') {
        if (review.author_id !== interaction.user.id && !interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages)) {
          await deny(interaction, context, 'Only the request author or moderators can change priority.');
          return;
        }
        const priority = interaction.options.getString('level', true);
        const existing = context.v2.listItems({ guildId: interaction.guildId, type: 'review_meta', limit: 100 }).find((item) => item.title === review.id);
        if (existing) context.v2.updateItem(existing.id, { data: { priority } });
        else context.v2.createItem({ guildId: interaction.guildId, type: 'review_meta', ownerId: review.author_id, title: review.id, data: { priority }, idPrefix: 'rmeta' });
        await interaction.reply({ embeds: [successEmbed(context, 'Review priority updated', `**${review.title}** is now **${priority}** priority.`)] });
        return;
      }
      const comment = interaction.options.getString('comment', true);
      context.v2.createItem({ guildId: interaction.guildId, type: 'review_comment', ownerId: interaction.user.id, title: review.id, data: { comment }, idPrefix: 'rcmt' });
      context.v2.changeCredits(interaction.guildId, interaction.user.id, 5, 'Constructive code review comment', review.id);
      context.v2.addSkillXp(interaction.guildId, interaction.user.id, 'backend', 10);
      await interaction.reply({ embeds: [embed(context, `🔍 Review comment • ${review.title}`, comment).addFields({ name: 'Reviewer', value: `${interaction.user}` })] });
      return;
    }

    const reviews = context.db.listReviews(
      interaction.guildId,
      subcommand === 'mine' ? interaction.user.id : undefined,
    );
    const body = reviews.length
      ? reviews
          .map(
            (review) =>
              `\`${review.id}\` **${truncate(review.title, 70)}**\n${review.status === 'open' ? '🟢 Open' : review.status === 'claimed' ? `🟡 <@${review.reviewer_id}>` : '✅ Completed'} • ${review.language} • <@${review.author_id}>`,
          )
          .join('\n\n')
      : subcommand === 'mine'
        ? 'You have no review activity yet.'
        : 'The review queue is empty. Nicely done.';
    await interaction.reply({
      embeds: [embed(context, subcommand === 'mine' ? '🔎 Your Review Activity' : '🔎 Code Review Queue', body)],
      ephemeral: subcommand === 'mine',
    });
  },
};

export const projectCommands: BotCommand[] = [projectCommand, reviewCommand];

export function awardProjectAchievement(context: BotContext, guildId: string, userId: string): void {
  evaluateAchievements(context, guildId, userId);
}

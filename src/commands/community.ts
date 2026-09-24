import {
  EmbedBuilder,
  SlashCommandBuilder,
  type User,
} from 'discord.js';
import { achievement, evaluateAchievements } from '../services/achievements.js';
import { embed, fields, icons, successEmbed } from '../theme.js';
import type { BotCommand, BotContext, ProfileRow } from '../types.js';
import {
  deny,
  isHttpUrl,
  normalizeGithub,
  normalizedCsv,
  progressBar,
  relativeTimestamp,
  truncate,
  xpForLevel,
} from '../utils.js';

function profileEmbed(context: BotContext, profile: ProfileRow, user: User): EmbedBuilder {
  const stats = context.db.getStats(profile.guild_id, profile.user_id);
  const levelStart = xpForLevel(stats.level);
  const levelEnd = xpForLevel(stats.level + 1);
  const achievements = context.db.getAchievements(profile.guild_id, profile.user_id);
  const experience = context.v2.getPreference(profile.guild_id, profile.user_id, 'profile.experience', 'Not specified');
  const goals = context.v2.getPreference(profile.guild_id, profile.user_id, 'profile.goals', 'Not specified');
  const skillTree = context.v2.skills(profile.guild_id, profile.user_id).slice(0, 4);
  return embed(context, `⌨️ ${user.displayName}'s Developer Profile`, profile.bio)
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .addFields(
      ...fields([
        ['Skills', profile.skills],
        ['Experience', String(experience), true],
        ['Availability', profile.availability ?? 'Not specified', true],
        ['Timezone', profile.timezone ?? 'Not specified', true],
        ['Reputation', `${icons.reputation} ${stats.reputation}`, true],
        ['Level', `${stats.level} • ${stats.xp} XP`, true],
        [
          'Progress',
          `${progressBar(stats.xp - levelStart, levelEnd - levelStart)} ${stats.xp - levelStart}/${levelEnd - levelStart}`,
          false,
        ],
        ['GitHub', profile.github ? `[Open profile](${profile.github})` : 'Not linked', true],
        ['Portfolio', profile.portfolio ? `[Open website](${profile.portfolio})` : 'Not linked', true],
        ['Current goals', String(goals)],
        ['Skill Tree', skillTree.length ? skillTree.map((item) => `${item.area}: ${item.xp} XP`).join(' • ') : 'No focused XP logged yet.'],
        ['Achievements', achievements.length ? achievements.map((item) => achievement(item.code).icon).join(' ') : 'None yet'],
      ]),
    );
}

const profileCommand: BotCommand = {
  module: 'profiles',
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Create, view, or discover developer profiles.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('set')
        .setDescription('Create or update your developer profile.')
        .addStringOption((option) =>
          option.setName('bio').setDescription('A short introduction.').setRequired(true).setMaxLength(300),
        )
        .addStringOption((option) =>
          option
            .setName('skills')
            .setDescription('Comma-separated skills, for example TypeScript, React, Rust.')
            .setRequired(true)
            .setMaxLength(250),
        )
        .addStringOption((option) =>
          option.setName('github').setDescription('GitHub username or profile URL.').setMaxLength(150),
        )
        .addStringOption((option) =>
          option.setName('portfolio').setDescription('Your portfolio URL.').setMaxLength(250),
        )
        .addStringOption((option) =>
          option.setName('timezone').setDescription('Your timezone, for example UTC-3.').setMaxLength(50),
        )
        .addStringOption((option) =>
          option.setName('availability').setDescription('Open to work, mentoring, collaborating, etc.').setMaxLength(100),
        )
        .addStringOption((option) =>
          option.setName('experience').setDescription('Beginner, intermediate, senior, student, etc.').setMaxLength(60),
        )
        .addStringOption((option) =>
          option.setName('goals').setDescription('What are you learning or building next?').setMaxLength(200),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('view')
        .setDescription('View a developer profile.')
        .addUserOption((option) => option.setName('member').setDescription('The member to view.')),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('discover')
        .setDescription('Find developers by skill.')
        .addStringOption((option) =>
          option.setName('skill').setDescription('A skill or technology.').setRequired(true).setMaxLength(50),
        ),
    )
    .addSubcommand((subcommand) => subcommand.setName('clear').setDescription('Delete your developer profile.')),
  async execute(interaction, context) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'set') {
      const bio = interaction.options.getString('bio', true).trim();
      const skills = normalizedCsv(interaction.options.getString('skills', true));
      const githubInput = interaction.options.getString('github')?.trim() ?? '';
      const portfolioInput = interaction.options.getString('portfolio')?.trim() ?? '';
      const github = githubInput ? normalizeGithub(githubInput) : null;
      if (githubInput && !github) {
        await deny(interaction, context, 'Enter a valid GitHub username or github.com profile URL.');
        return;
      }
      if (portfolioInput && !isHttpUrl(portfolioInput)) {
        await deny(interaction, context, 'Your portfolio must be a valid http:// or https:// URL.');
        return;
      }
      const profile = context.db.upsertProfile({
        guildId: interaction.guildId,
        userId: interaction.user.id,
        bio,
        skills,
        github,
        portfolio: portfolioInput || null,
        timezone: interaction.options.getString('timezone')?.trim() || null,
        availability: interaction.options.getString('availability')?.trim() || null,
      });
      const experience = interaction.options.getString('experience')?.trim();
      const goals = interaction.options.getString('goals')?.trim();
      if (experience) context.v2.setPreference(interaction.guildId, interaction.user.id, 'profile.experience', experience);
      if (goals) context.v2.setPreference(interaction.guildId, interaction.user.id, 'profile.goals', goals);
      await interaction.reply({
        embeds: [profileEmbed(context, profile, interaction.user).setTitle('✅ Developer profile updated')],
        ephemeral: true,
      });
      return;
    }

    if (subcommand === 'view') {
      const user = interaction.options.getUser('member') ?? interaction.user;
      const profile = context.db.getProfile(interaction.guildId, user.id);
      if (!profile) {
        await deny(
          interaction,
          context,
          user.id === interaction.user.id
            ? 'You do not have a profile yet. Use `/profile set` to create one.'
            : 'That member has not created a developer profile yet.',
        );
        return;
      }
      evaluateAchievements(context, interaction.guildId, user.id);
      await interaction.reply({ embeds: [profileEmbed(context, profile, user)] });
      return;
    }

    if (subcommand === 'discover') {
      const skill = interaction.options.getString('skill', true).trim();
      const profiles = context.db.searchProfiles(interaction.guildId, skill);
      if (!profiles.length) {
        await deny(interaction, context, `No developer profiles mention **${truncate(skill, 50)}** yet.`);
        return;
      }
      const lines = profiles.map(
        (profile, index) =>
          `**${index + 1}.** <@${profile.user_id}> — ${truncate(profile.skills, 100)}\n${truncate(profile.bio, 130)}`,
      );
      await interaction.reply({
        embeds: [
          embed(context, `🔭 Developers matching “${truncate(skill, 50)}”`, lines.join('\n\n')).setColor(
            context.config.accentColor,
          ),
        ],
      });
      return;
    }

    const deleted = context.db.deleteProfile(interaction.guildId, interaction.user.id);
    await interaction.reply({
      embeds: [
        successEmbed(
          context,
          deleted ? 'Profile deleted' : 'Nothing to delete',
          deleted ? 'Your developer profile has been removed.' : 'You did not have a developer profile.',
        ),
      ],
      ephemeral: true,
    });
  },
};

const reputationCommand: BotCommand = {
  module: 'reputation',
  data: new SlashCommandBuilder()
    .setName('rep')
    .setDescription('Recognize a helpful community member.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('give')
        .setDescription('Give one reputation point with a meaningful reason.')
        .addUserOption((option) => option.setName('member').setDescription('The helpful member.').setRequired(true))
        .addStringOption((option) =>
          option.setName('reason').setDescription('What did they help with?').setRequired(true).setMinLength(10).setMaxLength(250),
        )
        .addStringOption((option) =>
          option.setName('category').setDescription('Type of contribution.').setRequired(true).addChoices(
            { name: 'Code review', value: 'code_review' },
            { name: 'Mentoring', value: 'mentoring' },
            { name: 'Troubleshooting', value: 'troubleshooting' },
            { name: 'Collaboration', value: 'collaboration' },
            { name: 'Open source', value: 'open_source' },
          ),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('history').setDescription('View categorized reputation history.')
        .addUserOption((option) => option.setName('member').setDescription('Member to inspect.')),
    ),
  async execute(interaction, context) {
    if (interaction.options.getSubcommand() === 'history') {
      const user = interaction.options.getUser('member') ?? interaction.user;
      const events = context.v2.listItems({ guildId: interaction.guildId, type: 'reputation_event', limit: 100 })
        .filter((item) => String(item.data['toUserId']) === user.id)
        .slice(0, 15);
      const body = events.length
        ? events.map((item) => `◆ **${String(item.data['category']).replaceAll('_', ' ')}** • from <@${item.owner_id}> • ${relativeTimestamp(item.created_at)}\n${truncate(String(item.data['reason']), 220)}`).join('\n\n')
        : 'No categorized reputation history yet.';
      await interaction.reply({ embeds: [embed(context, `◆ ${user.displayName}'s reputation history`, body)], ephemeral: user.id === interaction.user.id });
      return;
    }
    const member = interaction.options.getUser('member', true);
    const reason = interaction.options.getString('reason', true).trim();
    const category = interaction.options.getString('category', true);
    if (member.bot || member.id === interaction.user.id) {
      await deny(interaction, context, 'Reputation can only be given to another human member.');
      return;
    }
    const result = context.db.giveReputation(interaction.guildId, interaction.user.id, member.id, reason);
    if (!result.ok) {
      await deny(interaction, context, result.reason);
      return;
    }
    const newAchievements = evaluateAchievements(context, interaction.guildId, member.id);
    context.v2.createItem({
      guildId: interaction.guildId,
      type: 'reputation_event',
      ownerId: interaction.user.id,
      title: category,
      data: { toUserId: member.id, reason, category },
      idPrefix: 'rep2',
    });
    context.v2.changeCredits(interaction.guildId, member.id, 3, `Reputation: ${category}`);
    const achievementText = newAchievements.length
      ? `\n\nNew achievement: ${newAchievements.map((item) => `${item.icon} **${item.name}**`).join(', ')}`
      : '';
    await interaction.reply({
      embeds: [
        successEmbed(
          context,
          'Reputation awarded',
          `${member} now has **${result.stats.reputation} reputation**.\n> ${truncate(reason, 250)}${achievementText}`,
        ),
      ],
    });
  },
};

const leaderboardCommand: BotCommand = {
  module: 'leaderboards',
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the community leaderboard.')
    .addStringOption((option) =>
      option
        .setName('category')
        .setDescription('What should be ranked?')
        .setRequired(true)
        .addChoices(
          { name: 'Experience', value: 'xp' },
          { name: 'Reputation', value: 'reputation' },
          { name: 'Helpful actions', value: 'helpful' },
        ),
    ),
  async execute(interaction, context) {
    const category = interaction.options.getString('category', true) as 'xp' | 'reputation' | 'helpful';
    const ranking = context.db.leaderboard(interaction.guildId, category);
    const medals = ['🥇', '🥈', '🥉'];
    const body = ranking.length
      ? ranking
          .map((entry, index) => {
            const value = category === 'xp' ? `${entry.xp} XP • Level ${entry.level}` : entry[category].toString();
            return `${medals[index] ?? `**${index + 1}.**`} <@${entry.user_id}> — **${value}**`;
          })
          .join('\n')
      : 'No activity has been recorded yet.';
    await interaction.reply({
      embeds: [embed(context, `🏆 ${category[0]!.toUpperCase()}${category.slice(1)} Leaderboard`, body)],
    });
  },
};

const rankCommand: BotCommand = {
  module: 'profiles',
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('View level, XP, reputation, and achievements.')
    .addUserOption((option) => option.setName('member').setDescription('The member to inspect.')),
  async execute(interaction, context) {
    const user = interaction.options.getUser('member') ?? interaction.user;
    evaluateAchievements(context, interaction.guildId, user.id);
    const stats = context.db.getStats(interaction.guildId, user.id);
    const achievements = context.db.getAchievements(interaction.guildId, user.id);
    const start = xpForLevel(stats.level);
    const end = xpForLevel(stats.level + 1);
    await interaction.reply({
      embeds: [
        embed(context, `📈 ${user.displayName}'s Community Rank`)
          .setThumbnail(user.displayAvatarURL({ size: 256 }))
          .addFields(
            ...fields([
              ['Level', stats.level.toString(), true],
              ['XP', stats.xp.toString(), true],
              ['Reputation', stats.reputation.toString(), true],
              ['Messages', stats.messages.toString(), true],
              ['Next level', `${progressBar(stats.xp - start, end - start)} ${stats.xp - start}/${end - start}`],
              [
                'Achievements',
                achievements.length
                  ? achievements.map((item) => {
                      const definition = achievement(item.code);
                      return `${definition.icon} **${definition.name}** — ${definition.description}`;
                    }).join('\n')
                  : 'No achievements unlocked yet.',
              ],
            ]),
          ),
      ],
    });
  },
};

const insightsCommand: BotCommand = {
  module: 'analytics',
  data: new SlashCommandBuilder().setName('insights').setDescription('View a privacy-friendly community activity snapshot.'),
  async execute(interaction, context) {
    const insight = context.db.getInsights(interaction.guildId);
    await interaction.reply({
      embeds: [
        embed(context, '📊 Community Pulse', 'A compact snapshot based on aggregate activity.').addFields(
          ...fields([
            ['Messages • 7 days', insight.messages7d.toLocaleString(), true],
            ['New members • 7 days', insight.joins7d.toLocaleString(), true],
            ['Projects shared', insight.projects.toLocaleString(), true],
            ['Open code reviews', insight.openReviews.toLocaleString(), true],
            ['Public snippets', insight.snippets.toLocaleString(), true],
            ['Pair sessions', insight.pairSessions.toLocaleString(), true],
          ]),
        ),
      ],
    });
  },
};

const helpCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Explore DevForge features and commands.')
    .addStringOption((option) =>
      option
        .setName('category')
        .setDescription('Show one feature group.')
        .addChoices(
          { name: 'Community', value: 'community' },
          { name: 'Build & collaborate', value: 'build' },
          { name: 'Knowledge', value: 'knowledge' },
          { name: 'Moderation', value: 'moderation' },
          { name: 'Administration', value: 'admin' },
        ),
    ),
  async execute(interaction, context) {
    const category = interaction.options.getString('category');
    const groups: Record<string, [string, string]> = {
      community: ['Community', '`/profile` • `/rank` • `/rep` • `/leaderboard` • `/insights`'],
      build: ['Build & collaborate', '`/project` • `/review` • `/pair` • `/mentor` • `/bounty` • `/battle` • `/codejam` • `/hackathon`'],
      knowledge: ['Knowledge tools', '`/snippet` • `/rubberduck` • `/docs` • `/github` • `/tools` • `/playground`'],
      moderation: ['Moderation', '`/ban` • `/kick` • `/timeout` • `/warn` • `/purge` • `/ticket` • `/security`'],
      admin: ['Administration', '`/config bootstrap` • `/modules` • `/permissions` • `/analytics` • `/audit` • `/dashboard`'],
    };
    const selected = category ? [groups[category]!] : Object.values(groups);
    const result = embed(
      context,
      '🧠 DevForge Command Center',
      'A collaboration system for developer communities. Every command uses Discord’s native slash-command interface.',
    ).setColor(context.config.accentColor);
    for (const [name, value] of selected) result.addFields({ name, value });
    result.addFields({
      name: 'Quick start',
      value: 'Create a developer identity with `/profile set`, publish work with `/project create`, or join the pair queue with `/pair join`.',
    });
    await interaction.reply({ embeds: [result], ephemeral: Boolean(category) });
  },
};

const pingCommand: BotCommand = {
  data: new SlashCommandBuilder().setName('ping').setDescription('Check bot and Discord API latency.'),
  async execute(interaction, context) {
    const started = Date.now();
    await interaction.reply({ content: 'Measuring…', ephemeral: true });
    await interaction.editReply({
      embeds: [
        successEmbed(
          context,
          'Systems operational',
          `Interaction: **${Date.now() - started} ms**\nWebSocket: **${context.client.ws.ping} ms**\nUptime: **${Math.floor(process.uptime() / 60)} minutes**`,
        ),
      ],
      content: null,
    });
  },
};

export const communityCommands: BotCommand[] = [
  profileCommand,
  reputationCommand,
  leaderboardCommand,
  rankCommand,
  insightsCommand,
  helpCommand,
  pingCommand,
];

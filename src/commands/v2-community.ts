import {
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { ACHIEVEMENTS, achievement } from '../services/achievements.js';
import { embed, fields, successEmbed } from '../theme.js';
import type { BotCommand } from '../types.js';
import { deny, isHttpUrl, relativeTimestamp, truncate } from '../utils.js';
import type { FeatureItem, JsonObject } from '../v2/store.js';

const SKILL_AREAS = [
  ['Frontend', 'frontend'],
  ['Backend', 'backend'],
  ['DevOps', 'devops'],
  ['Security', 'security'],
  ['Database', 'database'],
  ['Mobile', 'mobile'],
  ['Game Dev', 'gamedev'],
] as const;

function futureDate(input: string): string | null {
  const match = /^(\d+)(m|h|d|w)$/i.exec(input.trim());
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = match[2]?.toLowerCase();
  const multiplier = unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : unit === 'd' ? 86_400_000 : 604_800_000;
  const milliseconds = amount * multiplier;
  if (milliseconds < 60_000 || milliseconds > 365 * 86_400_000) return null;
  return new Date(Date.now() + milliseconds).toISOString();
}

function itemList(items: FeatureItem[], empty: string): string {
  return items.length
    ? items.map((item) => `**${item.id} • ${truncate(item.title, 80)}**\n${item.status} • ${relativeTimestamp(item.created_at)}${item.due_at ? ` • deadline <t:${Math.floor(new Date(item.due_at).getTime() / 1000)}:R>` : ''}`).join('\n\n')
    : empty;
}

const analyticsCommand: BotCommand = {
  module: 'analytics',
  data: new SlashCommandBuilder()
    .setName('analytics')
    .setDescription('View server growth, activity, retention, and peak hours.')
    .addIntegerOption((option) => option.setName('days').setDescription('Analysis window.').addChoices(
      { name: '7 days', value: 7 }, { name: '14 days', value: 14 }, { name: '30 days', value: 30 },
    )),
  async execute(interaction, context) {
    const days = interaction.options.getInteger('days') ?? 7;
    const detailed = context.v2.analytics(interaction.guildId, days);
    const base = context.db.getInsights(interaction.guildId);
    const topChannels = detailed.channels.length
      ? detailed.channels.map((item, index) => `${index + 1}. <#${item.channel_id}> — **${item.messages}**`).join('\n')
      : 'No message activity recorded in this window.';
    const retention = interaction.guild.memberCount > 0
      ? `${Math.round((detailed.activeMembers / interaction.guild.memberCount) * 100)}%`
      : '0%';
    await interaction.reply({ embeds: [embed(context, `📊 Server analytics • ${days} days`).addFields(...fields([
      ['Members', interaction.guild.memberCount.toLocaleString(), true],
      ['Active members', detailed.activeMembers.toLocaleString(), true],
      ['Active-member ratio', retention, true],
      ['Messages', detailed.messages.toLocaleString(), true],
      ['Peak hour (UTC)', detailed.peakHour === null ? '—' : `${String(detailed.peakHour).padStart(2, '0')}:00`, true],
      ['7-day joins', base.joins7d.toLocaleString(), true],
      ['Projects / reviews', `${base.projects} / ${base.openReviews}`, true],
      ['Pair sessions', String(base.pairSessions), true],
      ['Top channels', topChannels],
      ['Privacy', 'Only aggregate counts are stored. Message content is not retained for analytics.'],
    ]))] });
  },
};

const skillsCommand: BotCommand = {
  module: 'skills',
  data: new SlashCommandBuilder()
    .setName('skills')
    .setDescription('Build an XP-based developer skill tree.')
    .addSubcommand((subcommand) =>
      subcommand.setName('log').setDescription('Log a meaningful practice session (3 per day).')
        .addStringOption((option) => option.setName('area').setDescription('Skill area.').setRequired(true).addChoices(
          ...SKILL_AREAS.map(([name, value]) => ({ name, value })),
        ))
        .addStringOption((option) => option.setName('activity').setDescription('What did you build, learn, or review?').setRequired(true).setMinLength(15).setMaxLength(300)),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('view').setDescription('View a developer skill tree.')
        .addUserOption((option) => option.setName('member').setDescription('Developer to inspect.')),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('leaderboard').setDescription('Rank a skill area.')
        .addStringOption((option) => option.setName('area').setDescription('Skill area.').setRequired(true).addChoices(
          ...SKILL_AREAS.map(([name, value]) => ({ name, value })),
        )),
    ),
  async execute(interaction, context) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'log') {
      const limit = context.v2.consumeRateLimit({ guildId: interaction.guildId, userId: interaction.user.id, action: 'skill_log', limit: 3, windowMs: 86_400_000 });
      if (!limit.allowed) {
        await deny(interaction, context, `Daily skill-log limit reached. It resets ${relativeTimestamp(limit.resetAt)}.`);
        return;
      }
      const area = interaction.options.getString('area', true);
      const activity = interaction.options.getString('activity', true);
      const xp = context.v2.addSkillXp(interaction.guildId, interaction.user.id, area, 20);
      context.v2.createItem({ guildId: interaction.guildId, type: 'skill_log', ownerId: interaction.user.id, title: activity, data: { area, xp: 20 } });
      context.v2.changeCredits(interaction.guildId, interaction.user.id, 5, 'Meaningful skill practice');
      context.v2.updateStreak(interaction.guildId, interaction.user.id, 'learning');
      await interaction.reply({ embeds: [successEmbed(context, 'Practice logged', `**+20 ${area} XP** and **+5 credits**. Total: **${xp} XP**.`)], ephemeral: true });
      return;
    }
    if (subcommand === 'view') {
      const user = interaction.options.getUser('member') ?? interaction.user;
      const skills = context.v2.skills(interaction.guildId, user.id);
      const body = SKILL_AREAS.map(([name, key]) => {
        const xp = skills.find((item) => item.area === key)?.xp ?? 0;
        const level = Math.floor(Math.sqrt(xp / 100));
        return `${name.padEnd(10, ' ')} • Level **${level}** • ${xp} XP`;
      }).join('\n');
      await interaction.reply({ embeds: [embed(context, `🌳 ${user.displayName}'s skill tree`, body).setThumbnail(user.displayAvatarURL())] });
      return;
    }
    const area = interaction.options.getString('area', true);
    const rows = context.v2.skillLeaderboard(interaction.guildId, area);
    await interaction.reply({ embeds: [embed(context, `🌳 ${area} leaderboard`, rows.length
      ? rows.map((item, index) => `**${index + 1}.** <@${item.user_id}> — ${item.xp} XP`).join('\n')
      : 'No XP has been logged in this area yet.')] });
  },
};

const achievementsCommand: BotCommand = {
  module: 'achievements',
  data: new SlashCommandBuilder()
    .setName('achievements')
    .setDescription('View unlocked and available community achievements.')
    .addSubcommand((subcommand) => subcommand.setName('view').setDescription('View unlocked badges.').addUserOption((option) => option.setName('member').setDescription('Member to inspect.')))
    .addSubcommand((subcommand) => subcommand.setName('catalog').setDescription('Browse achievement goals.')),
  async execute(interaction, context) {
    if (interaction.options.getSubcommand() === 'catalog') {
      const catalog = Object.values(ACHIEVEMENTS).map((item) => `${item.icon} **${item.name}** — ${item.description}`).join('\n');
      await interaction.reply({ embeds: [embed(context, '🏆 Achievement catalog', catalog)] });
      return;
    }
    const user = interaction.options.getUser('member') ?? interaction.user;
    const unlocked = context.db.getAchievements(interaction.guildId, user.id);
    const body = unlocked.length
      ? unlocked.map((item) => {
          const definition = achievement(item.code);
          return `${definition.icon} **${definition.name}** — ${relativeTimestamp(item.awarded_at)}`;
        }).join('\n')
      : 'No achievements unlocked yet. Ship a project, review code, help a member, or join a challenge.';
    await interaction.reply({ embeds: [embed(context, `🏆 ${user.displayName}'s achievements`, body).setThumbnail(user.displayAvatarURL())] });
  },
};

interface MentorData extends JsonObject {
  languages: string;
  areas: string;
  level: string;
  availability: string;
  timezone: string;
}

const mentorCommand: BotCommand = {
  module: 'mentoring',
  data: new SlashCommandBuilder()
    .setName('mentor')
    .setDescription('Match learners with experienced community mentors.')
    .addSubcommand((subcommand) =>
      subcommand.setName('register').setDescription('Register or update your mentor profile.')
        .addStringOption((option) => option.setName('languages').setDescription('Comma-separated languages.').setRequired(true).setMaxLength(150))
        .addStringOption((option) => option.setName('areas').setDescription('Frontend, backend, DevOps, security...').setRequired(true).setMaxLength(150))
        .addStringOption((option) => option.setName('level').setDescription('Your experience level.').setRequired(true).setMaxLength(50))
        .addStringOption((option) => option.setName('timezone').setDescription('Your timezone.').setRequired(true).setMaxLength(50))
        .addStringOption((option) => option.setName('availability').setDescription('When and how you can help.').setRequired(true).setMaxLength(150)),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('find').setDescription('Find mentors by language or area.')
        .addStringOption((option) => option.setName('query').setDescription('Language or area.').setRequired(true).setMaxLength(50)),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('request').setDescription('Request a mentorship connection.')
        .addUserOption((option) => option.setName('mentor').setDescription('Mentor to contact.').setRequired(true))
        .addStringOption((option) => option.setName('goal').setDescription('What would you like help with?').setRequired(true).setMinLength(15).setMaxLength(500)),
    )
    .addSubcommand((subcommand) => subcommand.setName('accept').setDescription('Accept a mentorship request sent to you.').addStringOption((option) => option.setName('id').setDescription('Request ID.').setRequired(true)))
    .addSubcommand((subcommand) => subcommand.setName('complete').setDescription('Complete a mentorship connection.').addStringOption((option) => option.setName('id').setDescription('Request ID.').setRequired(true)))
    .addSubcommand((subcommand) => subcommand.setName('requests').setDescription('View your recent mentor connections.')),
  async execute(interaction, context) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'register') {
      const existing = context.v2.listItems<MentorData>({ guildId: interaction.guildId, type: 'mentor_profile', ownerId: interaction.user.id, limit: 1 })[0];
      const data: MentorData = {
        languages: interaction.options.getString('languages', true),
        areas: interaction.options.getString('areas', true),
        level: interaction.options.getString('level', true),
        timezone: interaction.options.getString('timezone', true),
        availability: interaction.options.getString('availability', true),
      };
      if (existing) context.v2.updateItem<MentorData>(existing.id, { status: 'active', data });
      else context.v2.createItem<MentorData>({ guildId: interaction.guildId, type: 'mentor_profile', ownerId: interaction.user.id, title: `${interaction.user.displayName} • Mentor`, data, idPrefix: 'mentor' });
      await interaction.reply({ embeds: [successEmbed(context, 'Mentor profile active', 'Learners can now discover you with `/mentor find`.')], ephemeral: true });
      return;
    }
    if (subcommand === 'find') {
      const query = interaction.options.getString('query', true).toLowerCase();
      const mentors = context.v2.listItems<MentorData>({ guildId: interaction.guildId, type: 'mentor_profile', status: 'active', limit: 50 })
        .filter((item) => `${item.data.languages} ${item.data.areas}`.toLowerCase().includes(query));
      const body = mentors.length
        ? mentors.slice(0, 10).map((item) => `<@${item.owner_id}> • **${item.data.level}**\n${item.data.languages} • ${item.data.areas}\n${item.data.timezone} • ${item.data.availability}`).join('\n\n')
        : 'No matching mentors found. Try a broader language or area.';
      await interaction.reply({ embeds: [embed(context, `🤝 Mentors for “${query}”`, body)] });
      return;
    }
    if (subcommand === 'request') {
      const mentor = interaction.options.getUser('mentor', true);
      if (mentor.id === interaction.user.id || mentor.bot) {
        await deny(interaction, context, 'Choose another human member as mentor.');
        return;
      }
      const registered = context.v2.listItems({ guildId: interaction.guildId, type: 'mentor_profile', ownerId: mentor.id, status: 'active', limit: 1 })[0];
      if (!registered) {
        await deny(interaction, context, 'That member does not have an active mentor profile.');
        return;
      }
      const goal = interaction.options.getString('goal', true);
      const request = context.v2.createItem({ guildId: interaction.guildId, type: 'mentor_request', ownerId: interaction.user.id, title: goal, status: 'pending', data: { mentorId: mentor.id }, idPrefix: 'match' });
      context.v2.setMember({ itemId: request.id, userId: mentor.id, role: 'mentor', status: 'pending' });
      await mentor.send({ embeds: [embed(context, `🤝 Mentorship request from ${interaction.user.tag}`, `${goal}\n\nRequest: **${request.id}** • Server: **${interaction.guild.name}**`)] }).catch(() => null);
      await interaction.reply({ embeds: [successEmbed(context, 'Mentor contacted', `Request **${request.id}** was sent to ${mentor}.`)], ephemeral: true });
      return;
    }
    if (subcommand === 'accept' || subcommand === 'complete') {
      const id = interaction.options.getString('id', true);
      const request = context.v2.getItem(id, 'mentor_request');
      const membership = request ? context.v2.getMember(request.id, interaction.user.id) : undefined;
      if (!request || request.guild_id !== interaction.guildId || (!membership && request.owner_id !== interaction.user.id)) {
        await deny(interaction, context, 'Mentorship request not found or you are not a participant.');
        return;
      }
      if (subcommand === 'accept') {
        if (membership?.role !== 'mentor') {
          await deny(interaction, context, 'Only the requested mentor can accept this connection.');
          return;
        }
        context.v2.updateItem(request.id, { status: 'active' });
        context.v2.setMember({ itemId: request.id, userId: interaction.user.id, role: 'mentor', status: 'active' });
        await interaction.reply({ embeds: [successEmbed(context, 'Mentorship accepted', `<@${request.owner_id}> and ${interaction.user} are now connected.`)] });
        return;
      }
      if (request.status !== 'active') {
        await deny(interaction, context, 'Only active mentorships can be completed.');
        return;
      }
      context.v2.updateItem(request.id, { status: 'completed' });
      const mentor = context.v2.listMembers(request.id).find((member) => member.role === 'mentor');
      if (mentor) {
        context.db.awardAchievement(interaction.guildId, mentor.user_id, 'MENTOR');
        context.v2.changeCredits(interaction.guildId, mentor.user_id, 20, 'Completed mentorship', request.id);
        context.v2.addSkillXp(interaction.guildId, mentor.user_id, 'backend', 15);
      }
      await interaction.reply({ embeds: [successEmbed(context, 'Mentorship completed', 'The mentor earned **20 credits** and the Mentor achievement.')], ephemeral: true });
      return;
    }
    const owned = context.v2.listItems({ guildId: interaction.guildId, type: 'mentor_request', ownerId: interaction.user.id, limit: 10 });
    const participating = context.v2.listItems({ guildId: interaction.guildId, type: 'mentor_request', limit: 50 })
      .filter((item) => context.v2.getMember(item.id, interaction.user.id));
    const items = [...owned, ...participating].filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index);
    await interaction.reply({ embeds: [embed(context, '🤝 Mentor connections', itemList(items, 'No mentorship requests found.'))], ephemeral: true });
  },
};

interface BountyData extends JsonObject {
  description: string;
  reward: number;
  winnerId: string | null;
}

const bountyCommand: BotCommand = {
  module: 'bounties',
  data: new SlashCommandBuilder()
    .setName('bounty')
    .setDescription('Create developer bounties using internal community credits.')
    .addSubcommand((subcommand) =>
      subcommand.setName('create').setDescription('Post a new bounty and escrow its reward.')
        .addStringOption((option) => option.setName('title').setDescription('Short challenge title.').setRequired(true).setMaxLength(100))
        .addStringOption((option) => option.setName('description').setDescription('Problem and acceptance criteria.').setRequired(true).setMinLength(20).setMaxLength(1000))
        .addIntegerOption((option) => option.setName('reward').setDescription('Internal credits.').setRequired(true).setMinValue(10).setMaxValue(100000))
        .addStringOption((option) => option.setName('deadline').setDescription('Examples: 3d, 2w.').setRequired(true).setMaxLength(10)),
    )
    .addSubcommand((subcommand) => subcommand.setName('list').setDescription('Browse open bounties.'))
    .addSubcommand((subcommand) =>
      subcommand.setName('submit').setDescription('Submit a solution.')
        .addStringOption((option) => option.setName('id').setDescription('Bounty ID.').setRequired(true))
        .addStringOption((option) => option.setName('url').setDescription('Repository, PR, or demo URL.').setRequired(true).setMaxLength(300))
        .addStringOption((option) => option.setName('summary').setDescription('Explain the solution.').setRequired(true).setMaxLength(500)),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('award').setDescription('Select the winning solution.')
        .addStringOption((option) => option.setName('id').setDescription('Bounty ID.').setRequired(true))
        .addUserOption((option) => option.setName('winner').setDescription('Winning participant.').setRequired(true)),
    ),
  async execute(interaction, context) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'create') {
      const deadline = futureDate(interaction.options.getString('deadline', true));
      if (!deadline) {
        await deny(interaction, context, 'Use a deadline such as `3d`, `2w`, or `12h` (maximum 365 days).');
        return;
      }
      const reward = interaction.options.getInteger('reward', true);
      try {
        context.v2.changeCredits(interaction.guildId, interaction.user.id, -reward, 'Bounty escrow');
      } catch {
        await deny(interaction, context, `You need **${reward} credits** to fund this bounty.`);
        return;
      }
      const title = interaction.options.getString('title', true);
      const description = interaction.options.getString('description', true);
      const bounty = context.v2.createItem<BountyData>({ guildId: interaction.guildId, type: 'bounty', ownerId: interaction.user.id, title, status: 'open', dueAt: deadline, data: { description, reward, winnerId: null }, idPrefix: 'bty' });
      await interaction.reply({ embeds: [embed(context, `💰 Bounty • ${title}`, description).addFields(...fields([
        ['ID', `\`${bounty.id}\``, true], ['Reward', `${reward} credits`, true], ['Deadline', `<t:${Math.floor(new Date(deadline).getTime() / 1000)}:F>`, true], ['Author', `${interaction.user}`, true],
      ]))] });
      return;
    }
    if (subcommand === 'list') {
      const items = context.v2.listItems({ guildId: interaction.guildId, type: 'bounty', status: 'open', limit: 20 });
      await interaction.reply({ embeds: [embed(context, '💰 Open developer bounties', itemList(items, 'No open bounties right now.'))] });
      return;
    }
    const id = interaction.options.getString('id', true);
    const bounty = context.v2.getItem<BountyData>(id, 'bounty');
    if (!bounty || bounty.guild_id !== interaction.guildId || bounty.status !== 'open') {
      await deny(interaction, context, 'Open bounty not found in this server.');
      return;
    }
    if (subcommand === 'submit') {
      const url = interaction.options.getString('url', true);
      if (!isHttpUrl(url)) {
        await deny(interaction, context, 'Provide a valid http:// or https:// solution URL.');
        return;
      }
      const summary = interaction.options.getString('summary', true);
      context.v2.setMember({ itemId: bounty.id, userId: interaction.user.id, role: 'solver', status: 'submitted', data: { url, summary } });
      await interaction.reply({ embeds: [successEmbed(context, 'Solution submitted', `Your solution is attached to bounty **${bounty.id}**.`)], ephemeral: true });
      return;
    }
    if (bounty.owner_id !== interaction.user.id) {
      await deny(interaction, context, 'Only the bounty author can select a winner.');
      return;
    }
    const winner = interaction.options.getUser('winner', true);
    const submission = context.v2.getMember(bounty.id, winner.id);
    if (!submission || submission.status !== 'submitted') {
      await deny(interaction, context, 'That member has not submitted a solution to this bounty.');
      return;
    }
    context.v2.changeCredits(interaction.guildId, winner.id, bounty.data.reward, `Won bounty: ${bounty.title}`, bounty.id);
    context.v2.updateItem<BountyData>(bounty.id, { status: 'awarded', data: { winnerId: winner.id } });
    context.db.awardAchievement(interaction.guildId, winner.id, 'BUG_HUNTER');
    await interaction.reply({ embeds: [successEmbed(context, 'Bounty awarded', `${winner} received **${bounty.data.reward} credits** for the winning solution.`)] });
  },
};

interface CompetitionData extends JsonObject {
  theme: string;
  rules: string;
  teamSize: number;
}

function competitionCommand(name: 'battle' | 'codejam' | 'hackathon', title: string, module: string): BotCommand {
  return {
    module,
    data: new SlashCommandBuilder()
      .setName(name)
      .setDescription(`Create and participate in community ${title.toLowerCase()}s.`)
      .addSubcommand((subcommand) =>
        subcommand.setName('create').setDescription(`Create a ${title.toLowerCase()}.`)
          .addStringOption((option) => option.setName('title').setDescription('Event title.').setRequired(true).setMaxLength(100))
          .addStringOption((option) => option.setName('theme').setDescription('Theme or surprise brief.').setRequired(true).setMaxLength(300))
          .addStringOption((option) => option.setName('rules').setDescription('Rules and judging criteria.').setRequired(true).setMaxLength(800))
          .addStringOption((option) => option.setName('duration').setDescription('Examples: 3h, 2d, 1w.').setRequired(true).setMaxLength(10))
          .addIntegerOption((option) => option.setName('team_size').setDescription('Maximum team size.').setMinValue(1).setMaxValue(20)),
      )
      .addSubcommand((subcommand) => subcommand.setName('list').setDescription(`List active ${title.toLowerCase()}s.`))
      .addSubcommand((subcommand) => subcommand.setName('join').setDescription('Join an event.').addStringOption((option) => option.setName('id').setDescription('Event ID.').setRequired(true)))
      .addSubcommand((subcommand) =>
        subcommand.setName('team').setDescription('Create or join a named team for this event.')
          .addStringOption((option) => option.setName('id').setDescription('Event ID.').setRequired(true))
          .addStringOption((option) => option.setName('name').setDescription('Team name.').setRequired(true).setMaxLength(50)),
      )
      .addSubcommand((subcommand) =>
        subcommand.setName('submit').setDescription('Submit your entry.')
          .addStringOption((option) => option.setName('id').setDescription('Event ID.').setRequired(true))
          .addStringOption((option) => option.setName('url').setDescription('Repository or demo.').setRequired(true).setMaxLength(300))
          .addStringOption((option) => option.setName('notes').setDescription('Highlights and tradeoffs.').setRequired(true).setMaxLength(500)),
      )
      .addSubcommand((subcommand) =>
        subcommand.setName('vote').setDescription('Vote for a submitted participant or team lead.')
          .addStringOption((option) => option.setName('id').setDescription('Event ID.').setRequired(true))
          .addUserOption((option) => option.setName('participant').setDescription('Submission owner.').setRequired(true)),
      )
      .addSubcommand((subcommand) =>
        subcommand.setName('judge').setDescription('Score a submission as an event judge.')
          .addStringOption((option) => option.setName('id').setDescription('Event ID.').setRequired(true))
          .addUserOption((option) => option.setName('participant').setDescription('Submission owner.').setRequired(true))
          .addIntegerOption((option) => option.setName('score').setDescription('Score from 1 to 10.').setRequired(true).setMinValue(1).setMaxValue(10))
          .addStringOption((option) => option.setName('note').setDescription('Short judging note.').setRequired(true).setMaxLength(300)),
      )
      .addSubcommand((subcommand) => subcommand.setName('results').setDescription('View current results.').addStringOption((option) => option.setName('id').setDescription('Event ID.').setRequired(true))),
    async execute(interaction, context) {
      const subcommand = interaction.options.getSubcommand();
      const type = `competition_${name}`;
      if (subcommand === 'create') {
        if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageEvents) && name !== 'battle') {
          await deny(interaction, context, 'You need **Manage Events** to create this event type.');
          return;
        }
        const dueAt = futureDate(interaction.options.getString('duration', true));
        if (!dueAt) {
          await deny(interaction, context, 'Use a duration such as `3h`, `2d`, or `1w`.');
          return;
        }
        const item = context.v2.createItem<CompetitionData>({
          guildId: interaction.guildId,
          type,
          ownerId: interaction.user.id,
          title: interaction.options.getString('title', true),
          status: 'registration',
          dueAt,
          data: {
            theme: interaction.options.getString('theme', true),
            rules: interaction.options.getString('rules', true),
            teamSize: interaction.options.getInteger('team_size') ?? (name === 'battle' ? 1 : 5),
          },
          idPrefix: name === 'hackathon' ? 'hack' : name,
        });
        await interaction.reply({ embeds: [embed(context, `⚔️ ${item.title}`, item.data.theme).addFields(...fields([
          ['ID', `\`${item.id}\``, true], ['Deadline', `<t:${Math.floor(new Date(dueAt).getTime() / 1000)}:F>`, true], ['Team size', String(item.data.teamSize), true], ['Rules', item.data.rules],
        ]))] });
        return;
      }
      if (subcommand === 'list') {
        const items = context.v2.listItems({ guildId: interaction.guildId, type, limit: 20 }).filter((item) => !['closed', 'cancelled'].includes(item.status));
        await interaction.reply({ embeds: [embed(context, `⚔️ Active ${title}s`, itemList(items, `No active ${title.toLowerCase()}s.`))] });
        return;
      }
      const id = interaction.options.getString('id', true);
      const item = context.v2.getItem<CompetitionData>(id, type);
      if (!item || item.guild_id !== interaction.guildId) {
        await deny(interaction, context, `${title} not found in this server.`);
        return;
      }
      if (subcommand === 'join') {
        context.v2.setMember({ itemId: item.id, userId: interaction.user.id, role: 'participant' });
        await interaction.reply({ embeds: [successEmbed(context, `${title} joined`, `You are registered for **${item.title}**.`)], ephemeral: true });
        return;
      }
      if (subcommand === 'team') {
        const team = interaction.options.getString('name', true);
        const members = context.v2.listMembers(item.id).filter((member) => String(member.data['team'] ?? '').toLowerCase() === team.toLowerCase());
        if (members.length >= item.data.teamSize) {
          await deny(interaction, context, `Team **${team}** already reached the ${item.data.teamSize}-member limit.`);
          return;
        }
        context.v2.setMember({ itemId: item.id, userId: interaction.user.id, role: 'participant', data: { team } });
        await interaction.reply({ embeds: [successEmbed(context, 'Team updated', `You are now on team **${team}** for **${item.title}**.`)], ephemeral: true });
        return;
      }
      if (subcommand === 'submit') {
        const url = interaction.options.getString('url', true);
        if (!isHttpUrl(url)) {
          await deny(interaction, context, 'Provide a valid repository or demo URL.');
          return;
        }
        context.v2.setMember({ itemId: item.id, userId: interaction.user.id, role: 'participant', status: 'submitted', data: { url, notes: interaction.options.getString('notes', true) } });
        await interaction.reply({ embeds: [successEmbed(context, 'Entry submitted', `Your submission for **${item.title}** is ready for voting.`)], ephemeral: true });
        return;
      }
      if (subcommand === 'vote') {
        const participant = interaction.options.getUser('participant', true);
        const entry = context.v2.getMember(item.id, participant.id);
        if (!entry || entry.status !== 'submitted') {
          await deny(interaction, context, 'That participant has not submitted an entry.');
          return;
        }
        const result = context.v2.vote(item.id, interaction.user.id, participant.id);
        await interaction.reply({ embeds: [successEmbed(context, result.created ? 'Vote recorded' : 'Vote removed', `${participant} now has **${result.total}** vote(s).`)], ephemeral: true });
        return;
      }
      if (subcommand === 'judge') {
        if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageEvents)) {
          await deny(interaction, context, 'You need **Manage Events** to judge submissions.');
          return;
        }
        const participant = interaction.options.getUser('participant', true);
        const entry = context.v2.getMember(item.id, participant.id);
        if (!entry || entry.status !== 'submitted') {
          await deny(interaction, context, 'That participant has not submitted an entry.');
          return;
        }
        const score = interaction.options.getInteger('score', true);
        const note = interaction.options.getString('note', true);
        const key = `${item.id}:${participant.id}:${interaction.user.id}`;
        const existing = context.v2.listItems({ guildId: interaction.guildId, type: 'competition_judging', limit: 100 }).find((judging) => judging.title === key);
        if (existing) context.v2.updateItem(existing.id, { data: { score, note } });
        else context.v2.createItem({ guildId: interaction.guildId, type: 'competition_judging', ownerId: interaction.user.id, title: key, data: { competitionId: item.id, participantId: participant.id, score, note }, idPrefix: 'judge' });
        await interaction.reply({ embeds: [successEmbed(context, 'Judge score saved', `${participant} received **${score}/10**.`)], ephemeral: true });
        return;
      }
      const votes = context.v2.voteCounts(item.id);
      const judging = context.v2.listItems({ guildId: interaction.guildId, type: 'competition_judging', limit: 100 })
        .filter((score) => score.data['competitionId'] === item.id);
      const judgeScores = new Map<string, number[]>();
      for (const score of judging) {
        const participantId = String(score.data['participantId']);
        judgeScores.set(participantId, [...(judgeScores.get(participantId) ?? []), Number(score.data['score'])]);
      }
      const participants = new Set([...votes.map((vote) => vote.value), ...judgeScores.keys()]);
      const lines = [...participants].map((participantId) => {
        const community = votes.find((vote) => vote.value === participantId)?.total ?? 0;
        const scores = judgeScores.get(participantId) ?? [];
        const average = scores.length ? (scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1) : '—';
        return { participantId, community, average, rank: community + (average === '—' ? 0 : Number(average) * 2) };
      }).sort((a, b) => b.rank - a.rank);
      await interaction.reply({ embeds: [embed(context, `🏆 ${item.title} results`, lines.length
        ? lines.map((result, index) => `**${index + 1}.** <@${result.participantId}> — ${result.community} community vote(s) • judge ${result.average}/10`).join('\n')
        : 'No submitted scores or community votes yet.')] });
    },
  };
}

const BUGS = [
  { title: 'Off-by-one loop', code: 'const items = ["a", "b", "c"];\nfor (let i = 0; i <= items.length; i++) {\n  console.log(items[i].toUpperCase());\n}', hint: 'array bounds', answer: ['<', 'length', 'off-by-one'] },
  { title: 'Async map surprise', code: 'const values = await ids.map(async (id) => fetchValue(id));\nconsole.log(values);', hint: 'promises', answer: ['promise.all', 'promises'] },
  { title: 'Falsy cache miss', code: 'function get(key) {\n  if (!cache[key]) cache[key] = compute(key);\n  return cache[key];\n}', hint: 'valid falsy values', answer: ['hasown', 'undefined', 'falsy', 'in cache'] },
] as const;

function dailyBug(guildId: string): (typeof BUGS)[number] {
  const seed = `${guildId}:${new Date().toISOString().slice(0, 10)}`;
  let hash = 0;
  for (const character of seed) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return BUGS[hash % BUGS.length]!;
}

const bughuntCommand: BotCommand = {
  module: 'bug_hunt',
  data: new SlashCommandBuilder()
    .setName('bughunt')
    .setDescription('Find bugs in short daily code samples.')
    .addSubcommand((subcommand) => subcommand.setName('current').setDescription("View today's bug."))
    .addSubcommand((subcommand) => subcommand.setName('submit').setDescription('Explain the bug and fix.').addStringOption((option) => option.setName('answer').setDescription('Your diagnosis and correction.').setRequired(true).setMinLength(10).setMaxLength(600)))
    .addSubcommand((subcommand) => subcommand.setName('leaderboard').setDescription('View Bug Hunt leaders.')),
  async execute(interaction, context) {
    const subcommand = interaction.options.getSubcommand();
    const bug = dailyBug(interaction.guildId);
    const date = new Date().toISOString().slice(0, 10);
    if (subcommand === 'current') {
      await interaction.reply({ embeds: [embed(context, `🐛 ${bug.title}`, `\`\`\`js\n${bug.code}\n\`\`\`\n**Hint:** ${bug.hint}\nSubmit with \`/bughunt submit\`.`)] });
      return;
    }
    if (subcommand === 'submit') {
      const existing = context.v2.listItems({ guildId: interaction.guildId, type: 'bughunt_solution', ownerId: interaction.user.id, limit: 50 }).find((item) => item.title === date);
      if (existing) {
        await deny(interaction, context, 'You already submitted today’s Bug Hunt.');
        return;
      }
      const answer = interaction.options.getString('answer', true);
      const normalized = answer.toLowerCase().replaceAll(/[^a-z0-9<. -]/g, '');
      const correct = bug.answer.some((keyword) => normalized.includes(keyword));
      context.v2.createItem({ guildId: interaction.guildId, type: 'bughunt_solution', ownerId: interaction.user.id, title: date, status: correct ? 'correct' : 'attempted', data: { answer, bug: bug.title } });
      if (correct) {
        context.v2.changeCredits(interaction.guildId, interaction.user.id, 25, 'Daily Bug Hunt');
        context.v2.addSkillXp(interaction.guildId, interaction.user.id, 'backend', 15);
        context.db.awardAchievement(interaction.guildId, interaction.user.id, 'BUG_HUNTER');
      }
      await interaction.reply({ embeds: [embed(context, correct ? '✅ Bug found' : '🧪 Attempt recorded', correct
        ? 'Good diagnosis. You earned **25 credits** and **15 Backend XP**.'
        : 'That does not match the key failure yet. Re-read the hint and compare each assumption to the runtime behavior.')], ephemeral: true });
      return;
    }
    const solutions = context.v2.listItems({ guildId: interaction.guildId, type: 'bughunt_solution', status: 'correct', limit: 100 });
    const counts = new Map<string, number>();
    for (const item of solutions) counts.set(item.owner_id, (counts.get(item.owner_id) ?? 0) + 1);
    const leaders = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    await interaction.reply({ embeds: [embed(context, '🐛 Bug Hunt leaderboard', leaders.length
      ? leaders.map(([userId, total], index) => `**${index + 1}.** <@${userId}> — ${total} correct`).join('\n')
      : 'No correct solutions recorded yet.')] });
  },
};

const rfcCommand: BotCommand = {
  module: 'rfc',
  data: new SlashCommandBuilder()
    .setName('rfc')
    .setDescription('Manage technical proposals from draft to implementation.')
    .addSubcommand((subcommand) =>
      subcommand.setName('create').setDescription('Create a technical proposal.')
        .addStringOption((option) => option.setName('title').setDescription('Proposal title.').setRequired(true).setMaxLength(100))
        .addStringOption((option) => option.setName('problem').setDescription('Problem being solved.').setRequired(true).setMaxLength(700))
        .addStringOption((option) => option.setName('proposal').setDescription('Proposed approach.').setRequired(true).setMaxLength(1200))
        .addStringOption((option) => option.setName('tradeoffs').setDescription('Tradeoffs and alternatives.').setMaxLength(700)),
    )
    .addSubcommand((subcommand) => subcommand.setName('list').setDescription('Browse recent RFCs.'))
    .addSubcommand((subcommand) =>
      subcommand.setName('vote').setDescription('Vote on an RFC.')
        .addStringOption((option) => option.setName('id').setDescription('RFC ID.').setRequired(true))
        .addStringOption((option) => option.setName('vote').setDescription('Your position.').setRequired(true).addChoices(
          { name: 'Support', value: 'support' }, { name: 'Needs changes', value: 'changes' }, { name: 'Oppose', value: 'oppose' },
        )),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('status').setDescription('Move an RFC through its lifecycle.')
        .addStringOption((option) => option.setName('id').setDescription('RFC ID.').setRequired(true))
        .addStringOption((option) => option.setName('state').setDescription('New state.').setRequired(true).addChoices(
          { name: 'Draft', value: 'draft' }, { name: 'Review', value: 'review' }, { name: 'Accepted', value: 'accepted' }, { name: 'Rejected', value: 'rejected' }, { name: 'Implemented', value: 'implemented' },
        )),
    ),
  async execute(interaction, context) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'create') {
      const item = context.v2.createItem({ guildId: interaction.guildId, type: 'rfc', ownerId: interaction.user.id, title: interaction.options.getString('title', true), status: 'draft', data: {
        problem: interaction.options.getString('problem', true), proposal: interaction.options.getString('proposal', true), tradeoffs: interaction.options.getString('tradeoffs') ?? 'Not provided',
      }, idPrefix: 'rfc' });
      await interaction.reply({ embeds: [embed(context, `📜 RFC • ${item.title}`, String(item.data['problem'])).addFields(...fields([
        ['ID / state', `\`${item.id}\` • Draft`, true], ['Author', `${interaction.user}`, true], ['Proposal', String(item.data['proposal'])], ['Tradeoffs', String(item.data['tradeoffs'])],
      ]))] });
      return;
    }
    if (subcommand === 'list') {
      await interaction.reply({ embeds: [embed(context, '📜 Recent RFCs', itemList(context.v2.listItems({ guildId: interaction.guildId, type: 'rfc', limit: 20 }), 'No RFCs yet.'))] });
      return;
    }
    const id = interaction.options.getString('id', true);
    const item = context.v2.getItem(id, 'rfc');
    if (!item || item.guild_id !== interaction.guildId) {
      await deny(interaction, context, 'RFC not found in this server.');
      return;
    }
    if (subcommand === 'vote') {
      const value = interaction.options.getString('vote', true);
      const result = context.v2.vote(item.id, interaction.user.id, value);
      await interaction.reply({ embeds: [successEmbed(context, result.created ? 'RFC vote recorded' : 'RFC vote removed', `Current **${value}** votes: ${result.total}.`)], ephemeral: true });
      return;
    }
    if (item.owner_id !== interaction.user.id && !interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
      await deny(interaction, context, 'Only the RFC author or a server manager can change its state.');
      return;
    }
    const state = interaction.options.getString('state', true);
    context.v2.updateItem(item.id, { status: state });
    await interaction.reply({ embeds: [successEmbed(context, 'RFC state updated', `**${item.title}** is now **${state}**.`)] });
  },
};

const devlogCommand: BotCommand = {
  module: 'dev_logs',
  data: new SlashCommandBuilder()
    .setName('devlog')
    .setDescription('Publish and browse project progress logs.')
    .addSubcommand((subcommand) =>
      subcommand.setName('add').setDescription('Add a progress entry.')
        .addStringOption((option) => option.setName('project').setDescription('Project name or ID.').setRequired(true).setMaxLength(100))
        .addStringOption((option) => option.setName('progress').setDescription('What changed?').setRequired(true).setMaxLength(1000))
        .addStringOption((option) => option.setName('next').setDescription('Next step.').setMaxLength(300)),
    )
    .addSubcommand((subcommand) => subcommand.setName('list').setDescription('Browse recent development logs.').addStringOption((option) => option.setName('project').setDescription('Optional project filter.').setMaxLength(100))),
  async execute(interaction, context) {
    if (interaction.options.getSubcommand() === 'add') {
      const project = interaction.options.getString('project', true);
      const progress = interaction.options.getString('progress', true);
      const next = interaction.options.getString('next') ?? 'Not specified';
      const item = context.v2.createItem({ guildId: interaction.guildId, type: 'devlog', ownerId: interaction.user.id, title: project, data: { progress, next }, idPrefix: 'log' });
      context.v2.updateStreak(interaction.guildId, interaction.user.id, 'shipping');
      await interaction.reply({ embeds: [embed(context, `📝 Dev log • ${project}`, progress).addFields(...fields([['Next', next], ['Author', `${interaction.user}`, true], ['Entry', `\`${item.id}\``, true]]))] });
      return;
    }
    const query = interaction.options.getString('project')?.toLowerCase();
    const items = context.v2.listItems({ guildId: interaction.guildId, type: 'devlog', limit: 50 })
      .filter((item) => !query || item.title.toLowerCase().includes(query));
    const body = items.length ? items.slice(0, 15).map((item) => `**${item.title}** • <@${item.owner_id}> • ${relativeTimestamp(item.created_at)}\n${truncate(String(item.data['progress']), 220)}`).join('\n\n') : 'No matching development logs.';
    await interaction.reply({ embeds: [embed(context, '📝 Development logs', body)] });
  },
};

const docsCommand: BotCommand = {
  module: 'knowledge',
  data: new SlashCommandBuilder()
    .setName('docs')
    .setDescription('Search staff-maintained community documentation.')
    .addSubcommand((subcommand) =>
      subcommand.setName('search').setDescription('Search FAQs and tutorials.')
        .addStringOption((option) => option.setName('query').setDescription('What do you need?').setRequired(true).setMaxLength(100)),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('add').setDescription('Add a knowledge-base entry (staff).')
        .addStringOption((option) => option.setName('title').setDescription('Entry title.').setRequired(true).setMaxLength(100))
        .addStringOption((option) => option.setName('content').setDescription('Answer or tutorial.').setRequired(true).setMaxLength(1800))
        .addStringOption((option) => option.setName('tags').setDescription('Comma-separated tags.').setMaxLength(150)),
    )
    .addSubcommand((subcommand) => subcommand.setName('remove').setDescription('Remove an entry (staff).').addStringOption((option) => option.setName('id').setDescription('Entry ID.').setRequired(true))),
  async execute(interaction, context) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'search') {
      const query = interaction.options.getString('query', true).toLowerCase();
      const results = context.v2.listItems({ guildId: interaction.guildId, type: 'doc', status: 'published', limit: 100 })
        .filter((item) => `${item.title} ${String(item.data['content'])} ${String(item.data['tags'])}`.toLowerCase().includes(query))
        .slice(0, 8);
      const body = results.length ? results.map((item) => `**${item.title}** • \`${item.id}\`\n${truncate(String(item.data['content']), 500)}`).join('\n\n') : 'No matching documentation. Try fewer or broader keywords.';
      await interaction.reply({ embeds: [embed(context, `📚 Documentation • “${query}”`, body)] });
      return;
    }
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages)) {
      await deny(interaction, context, 'You need **Manage Messages** to edit the knowledge base.');
      return;
    }
    if (subcommand === 'add') {
      const item = context.v2.createItem({ guildId: interaction.guildId, type: 'doc', ownerId: interaction.user.id, title: interaction.options.getString('title', true), status: 'published', data: {
        content: interaction.options.getString('content', true), tags: interaction.options.getString('tags') ?? '',
      }, idPrefix: 'doc' });
      await interaction.reply({ embeds: [successEmbed(context, 'Documentation published', `Entry **${item.id}** is now searchable.`)], ephemeral: true });
      return;
    }
    const id = interaction.options.getString('id', true);
    const item = context.v2.getItem(id, 'doc');
    if (!item || item.guild_id !== interaction.guildId) {
      await deny(interaction, context, 'Documentation entry not found.');
      return;
    }
    context.v2.updateItem(item.id, { status: 'archived' });
    await interaction.reply({ embeds: [successEmbed(context, 'Documentation archived', `Entry **${item.id}** is no longer searchable.`)], ephemeral: true });
  },
};

export const v2CommunityCommands: BotCommand[] = [
  analyticsCommand,
  skillsCommand,
  achievementsCommand,
  mentorCommand,
  bountyCommand,
  competitionCommand('battle', 'Code Battle', 'battles'),
  competitionCommand('codejam', 'Code Jam', 'code_jams'),
  competitionCommand('hackathon', 'Hackathon', 'hackathons'),
  bughuntCommand,
  rfcCommand,
  devlogCommand,
  docsCommand,
];

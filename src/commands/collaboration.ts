import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type TextChannel,
} from 'discord.js';
import { challengeFor } from '../challenges.js';
import { achievement } from '../services/achievements.js';
import { embed, fields, successEmbed } from '../theme.js';
import type {
  BotCommand,
  BotContext,
  ChallengeRow,
  ChallengeSubmissionRow,
  PairQueueRow,
  PairSessionRow,
} from '../types.js';
import { deny, isHttpUrl, normalizedCsv, relativeTimestamp, todayUtc, truncate } from '../utils.js';

export function challengeCard(context: BotContext, challenge: ChallengeRow) {
  return embed(context, `🧩 Daily Challenge: ${challenge.title}`, challenge.description)
    .setColor(context.config.accentColor)
    .addFields(
      ...fields([
        ['Difficulty', challenge.difficulty, true],
        ['Date', challenge.challenge_date, true],
        ['Requirements', challenge.requirements.split('\n').map((item) => `• ${item}`).join('\n')],
        ['Bonus objective', challenge.bonus],
        ['Submit', 'Use `/challenge submit` with a public repository or demo URL.'],
      ]),
    );
}

export function submissionCard(context: BotContext, submission: ChallengeSubmissionRow, challenge: ChallengeRow) {
  return embed(
    context,
    `🧩 Challenge submission • ${challenge.title}`,
    submission.notes ?? 'No additional notes were provided.',
  ).addFields(
    ...fields([
      ['Builder', `<@${submission.user_id}>`, true],
      ['Community votes', `🔥 ${submission.votes}`, true],
      ['Repository / demo', `[Open submission](${submission.repository})`],
      ['Submitted', relativeTimestamp(submission.created_at), true],
    ]),
  );
}

export function submissionButtons(submission: ChallengeSubmissionRow): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`challenge:vote:${submission.id}`)
      .setLabel(`${submission.votes} ${submission.votes === 1 ? 'vote' : 'votes'}`)
      .setEmoji('🔥')
      .setStyle(ButtonStyle.Secondary),
  );
}

function ensureChallenge(context: BotContext, guildId: string, offset = 0): ChallengeRow {
  if (offset === 0) {
    const current = context.db.getChallenge(guildId);
    if (current) return current;
  }
  const date = todayUtc();
  const selected = challengeFor(`${guildId}:${date}`, offset);
  return context.db.saveChallenge({
    guildId,
    date,
    key: selected.key,
    title: selected.title,
    difficulty: selected.difficulty,
    description: selected.description,
    requirements: selected.requirements.join('\n'),
    bonus: selected.bonus,
  });
}

async function createPairThread(
  context: BotContext,
  session: PairSessionRow,
  first: PairQueueRow,
  second: PairQueueRow,
): Promise<string | null> {
  const settings = context.db.getSettings(session.guild_id);
  if (!settings.pairing_channel_id) return null;
  const channel = await context.client.channels.fetch(settings.pairing_channel_id).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText) return null;
  try {
    const thread = await channel.threads.create({
      name: `pair-${session.id.slice(-8)}`,
      type: ChannelType.PrivateThread,
      invitable: false,
      autoArchiveDuration: 1440,
      reason: 'DevForge pair-programming match',
    });
    await Promise.all([thread.members.add(first.user_id), thread.members.add(second.user_id)]);
    const controls = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`pair:complete:${session.id}`)
        .setLabel('Complete session')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success),
    );
    await thread.send({
      content: `<@${first.user_id}> <@${second.user_id}>`,
      embeds: [
        embed(
          context,
          '🤝 Pair-programming match',
          `You were matched around **${truncate(session.topic, 150)}**. Decide on one clear outcome, share context, and switch driver/navigator roles regularly.`,
        ).addFields(
          ...fields([
            ['Shared skills', normalizedCsv(`${first.skills}, ${second.skills}`)],
            ['Suggested flow', '5 min context • 40 min pairing • 10 min recap'],
            ['Safety', 'Never share passwords, private keys, tokens, or customer data.'],
          ]),
        ),
      ],
      components: [controls],
    });
    context.db.setPairThread(session.id, thread.id);
    return thread.id;
  } catch (error) {
    context.logger.warn('Could not create a private pair-programming thread.', {
      sessionId: session.id,
      error: String(error),
    });
    return null;
  }
}

const pairCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('pair')
    .setDescription('Find a compatible pair-programming partner.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('join')
        .setDescription('Join the smart matchmaking queue.')
        .addStringOption((option) =>
          option
            .setName('skills')
            .setDescription('Comma-separated languages and tools.')
            .setRequired(true)
            .setMaxLength(200),
        )
        .addStringOption((option) =>
          option
            .setName('level')
            .setDescription('Your current experience level.')
            .setRequired(true)
            .addChoices(
              { name: 'Learning', value: 'learning' },
              { name: 'Comfortable', value: 'comfortable' },
              { name: 'Experienced', value: 'experienced' },
              { name: 'Mentor', value: 'mentor' },
            ),
        )
        .addStringOption((option) =>
          option.setName('timezone').setDescription('For example UTC-3 or Europe/London.').setRequired(true).setMaxLength(60),
        )
        .addStringOption((option) =>
          option.setName('topic').setDescription('What do you want to build or learn?').setRequired(true).setMaxLength(200),
        ),
    )
    .addSubcommand((subcommand) => subcommand.setName('status').setDescription('View your queue or active-session status.'))
    .addSubcommand((subcommand) => subcommand.setName('leave').setDescription('Leave the matchmaking queue.')),
  async execute(interaction, context) {
    const subcommand = interaction.options.getSubcommand();
    const active = context.db.getActivePairSession(interaction.guildId, interaction.user.id);
    if (subcommand === 'status') {
      if (active) {
        const partner = active.user_one_id === interaction.user.id ? active.user_two_id : active.user_one_id;
        await interaction.reply({
          embeds: [
            embed(
              context,
              '🤝 Active pair session',
              `Partner: <@${partner}>\nTopic: **${active.topic}**\nStarted: ${relativeTimestamp(active.started_at)}${active.thread_id ? `\nSpace: <#${active.thread_id}>` : ''}`,
            ),
          ],
          ephemeral: true,
        });
        return;
      }
      const queued = context.db.getPairQueueEntry(interaction.guildId, interaction.user.id);
      await interaction.reply({
        embeds: [
          queued
            ? embed(
                context,
                '⏳ Matchmaking active',
                `Topic: **${queued.topic}**\nSkills: ${queued.skills}\nJoined: ${relativeTimestamp(queued.joined_at)}`,
              )
            : embed(context, 'Pair status', 'You are not in the queue. Use `/pair join` when you want a collaborator.'),
        ],
        ephemeral: true,
      });
      return;
    }

    if (subcommand === 'leave') {
      if (active) {
        await deny(interaction, context, 'You already have an active session. Use its **Complete session** button instead.');
        return;
      }
      const removed = context.db.removePairQueue(interaction.guildId, interaction.user.id);
      await interaction.reply({
        embeds: [
          successEmbed(
            context,
            removed ? 'Queue left' : 'Not queued',
            removed ? 'You have left pair matchmaking.' : 'You were not in the matchmaking queue.',
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    if (active) {
      await deny(interaction, context, 'Complete your current pair-programming session before joining again.');
      return;
    }
    await interaction.deferReply({ ephemeral: true });
    const entry = context.db.upsertPairQueue({
      guild_id: interaction.guildId,
      user_id: interaction.user.id,
      skills: normalizedCsv(interaction.options.getString('skills', true)),
      level: interaction.options.getString('level', true),
      timezone: interaction.options.getString('timezone', true).trim(),
      topic: interaction.options.getString('topic', true).trim(),
    });
    const partner = context.db.findBestPair(interaction.guildId, interaction.user.id);
    if (!partner) {
      await interaction.editReply({
        embeds: [
          successEmbed(
            context,
            'Added to matchmaking',
            'No compatible partner is waiting right now. Your entry is active and the next matching developer can be paired with you.',
          ),
        ],
      });
      return;
    }
    const session = context.db.createPairSession(interaction.guildId, entry, partner);
    const threadId = await createPairThread(context, session, entry, partner);
    if (!threadId) {
      await Promise.allSettled([
        interaction.user.send(`DevForge matched you with <@${partner.user_id}> for: ${session.topic}`),
        context.client.users.send(partner.user_id, `DevForge matched you with <@${entry.user_id}> for: ${session.topic}`),
      ]);
    }
    await interaction.editReply({
      embeds: [
        successEmbed(
          context,
          'Pair found',
          `You were matched with <@${partner.user_id}>.${threadId ? ` Open your private space: <#${threadId}>` : ' I could not create a private thread, so both participants received a DM.'}`,
        ),
      ],
    });
  },
};

const challengeCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('challenge')
    .setDescription('Practice together through rotating daily coding challenges.')
    .addSubcommand((subcommand) => subcommand.setName('current').setDescription("View today's coding challenge."))
    .addSubcommand((subcommand) =>
      subcommand
        .setName('submit')
        .setDescription("Submit your solution to today's challenge.")
        .addStringOption((option) =>
          option.setName('repository').setDescription('Public repository or demo URL.').setRequired(true).setMaxLength(300),
        )
        .addStringOption((option) =>
          option.setName('notes').setDescription('Tradeoffs, highlights, or what you learned.').setMaxLength(500),
        ),
    )
    .addSubcommand((subcommand) => subcommand.setName('leaderboard').setDescription('View top challenge builders.'))
    .addSubcommand((subcommand) => subcommand.setName('rotate').setDescription('Rotate today’s prompt (server managers only).')),
  async execute(interaction, context) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'current') {
      const challenge = ensureChallenge(context, interaction.guildId);
      await interaction.reply({ embeds: [challengeCard(context, challenge)] });
      return;
    }

    if (subcommand === 'leaderboard') {
      const ranking = context.db.challengeLeaderboard(interaction.guildId);
      const medals = ['🥇', '🥈', '🥉'];
      const body = ranking.length
        ? ranking
            .map(
              (entry, index) =>
                `${medals[index] ?? `**${index + 1}.**`} <@${entry.user_id}> — **${entry.votes} votes** across ${entry.entries} ${entry.entries === 1 ? 'entry' : 'entries'}`,
            )
            .join('\n')
        : 'No challenge submissions yet.';
      await interaction.reply({ embeds: [embed(context, '🏆 Challenge Leaderboard', body)] });
      return;
    }

    if (subcommand === 'rotate') {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
        await deny(interaction, context, 'You need **Manage Server** to rotate a challenge.');
        return;
      }
      const challenge = ensureChallenge(context, interaction.guildId, Date.now() % 10_000);
      await interaction.reply({ embeds: [challengeCard(context, challenge)] });
      return;
    }

    const repository = interaction.options.getString('repository', true).trim();
    if (!isHttpUrl(repository)) {
      await deny(interaction, context, 'The submission must be a valid public http:// or https:// URL.');
      return;
    }
    const challenge = ensureChallenge(context, interaction.guildId);
    const submission = context.db.submitChallenge({
      challengeId: challenge.id,
      guildId: interaction.guildId,
      userId: interaction.user.id,
      repository,
      notes: interaction.options.getString('notes')?.trim() || null,
    });
    const settings = context.db.getSettings(interaction.guildId);
    let postedChannel: TextChannel | null = null;
    if (settings.challenge_channel_id) {
      const channel = await context.client.channels.fetch(settings.challenge_channel_id).catch(() => null);
      if (channel?.type === ChannelType.GuildText) postedChannel = channel;
    }
    const payload = { embeds: [submissionCard(context, submission, challenge)], components: [submissionButtons(submission)] };
    if (postedChannel) {
      const message = await postedChannel.send(payload);
      context.db.setChallengeSubmissionMessage(submission.id, message.id);
      await interaction.reply({
        embeds: [successEmbed(context, 'Challenge submitted', `Your solution is live in ${postedChannel}.`)],
        ephemeral: true,
      });
    } else {
      await interaction.reply(payload);
      const message = await interaction.fetchReply();
      context.db.setChallengeSubmissionMessage(submission.id, message.id);
    }
    if (context.db.awardAchievement(interaction.guildId, interaction.user.id, 'CHALLENGE_ACCEPTED')) {
      const unlocked = achievement('CHALLENGE_ACCEPTED');
      await interaction.followUp({
        content: `${unlocked.icon} Achievement unlocked: **${unlocked.name}**`,
        ephemeral: true,
      });
    }
  },
};

export const collaborationCommands: BotCommand[] = [pairCommand, challengeCommand];

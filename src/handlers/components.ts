import {
  ActionRowBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { submissionButtons, submissionCard } from '../commands/collaboration.js';
import { projectButtons, projectCard, reviewButtons, reviewCard } from '../commands/projects.js';
import { pluginComponents } from '../modules/plugins.js';
import { achievement, evaluateAchievements } from '../services/achievements.js';
import { successEmbed } from '../theme.js';
import type { ComponentHandler } from '../types.js';
import { deny } from '../utils.js';

const projectStar: ComponentHandler = {
  prefix: 'project:star:',
  async execute(interaction, context) {
    const id = interaction.customId.split(':')[2]!;
    const project = context.db.getProject(id);
    if (!project) {
      await deny(interaction, context, 'That project no longer exists.');
      return;
    }
    context.db.toggleProjectStar(id, interaction.user.id);
    const updated = context.db.getProject(id)!;
    await interaction.update({ embeds: [projectCard(context, updated)], components: [projectButtons(updated)] });
  },
};

const projectApply: ComponentHandler = {
  prefix: 'project:apply:',
  async execute(interaction, context) {
    const id = interaction.customId.split(':')[2]!;
    const project = context.db.getProject(id);
    if (!project || project.status !== 'open') {
      await deny(interaction, context, 'This project is no longer accepting applications.');
      return;
    }
    if (project.owner_id === interaction.user.id) {
      await deny(interaction, context, 'You already own this project.');
      return;
    }
    const modal = new ModalBuilder().setCustomId(`project:apply:${project.id}`).setTitle('Join a developer project');
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('pitch')
          .setLabel('How would you like to contribute?')
          .setPlaceholder('Mention relevant skills, ideas, and realistic availability.')
          .setStyle(TextInputStyle.Paragraph)
          .setMinLength(20)
          .setMaxLength(900)
          .setRequired(true),
      ),
    );
    await interaction.showModal(modal);
  },
};

const projectApplication: ComponentHandler = {
  prefix: 'application:',
  async execute(interaction, context) {
    const [, action, id] = interaction.customId.split(':');
    if (!id || (action !== 'accept' && action !== 'decline')) return;
    const application = context.db.getProjectApplication(id);
    if (!application || application.status !== 'pending') {
      await deny(interaction, context, 'This application has already been resolved or no longer exists.');
      return;
    }
    const project = context.db.getProject(application.project_id);
    if (!project || project.owner_id !== interaction.user.id) {
      await deny(interaction, context, 'Only the project creator can resolve this application.');
      return;
    }
    const status = action === 'accept' ? 'accepted' : 'declined';
    context.db.resolveProjectApplication(id, status);
    await interaction.update({ components: [] });
    await interaction.followUp({
      embeds: [
        successEmbed(
          context,
          status === 'accepted' ? 'Collaborator accepted' : 'Application declined',
          status === 'accepted'
            ? `<@${application.applicant_id}> has been added to **${project.title}**.`
            : `The application from <@${application.applicant_id}> was declined.`,
        ),
      ],
    });
    const applicant = await context.client.users.fetch(application.applicant_id).catch(() => null);
    await applicant
      ?.send({
        embeds: [
          successEmbed(
            context,
            status === 'accepted' ? 'You joined a project' : 'Application update',
            status === 'accepted'
              ? `Your application to **${project.title}** was accepted. Contact <@${project.owner_id}> to coordinate next steps.`
              : `The creator of **${project.title}** did not accept this application. Keep building and try another collaboration.`,
          ),
        ],
      })
      .catch(() => null);
  },
};

const reviewClaim: ComponentHandler = {
  prefix: 'review:claim:',
  async execute(interaction, context) {
    const id = interaction.customId.split(':')[2]!;
    const review = context.db.getReview(id);
    if (!review) {
      await deny(interaction, context, 'That review request no longer exists.');
      return;
    }
    if (review.author_id === interaction.user.id) {
      await deny(interaction, context, 'You cannot claim your own review request.');
      return;
    }
    if (!context.db.claimReview(id, interaction.user.id)) {
      await deny(interaction, context, 'Another reviewer claimed this request first.');
      return;
    }
    const updated = context.db.getReview(id)!;
    await interaction.update({ embeds: [reviewCard(context, updated)], components: [reviewButtons(updated)] });
    const author = await context.client.users.fetch(updated.author_id).catch(() => null);
    await author
      ?.send({
        embeds: [
          successEmbed(
            context,
            'Your review was claimed',
            `<@${interaction.user.id}> is reviewing **${updated.title}**. Coordinate details in the server if needed.`,
          ),
        ],
      })
      .catch(() => null);
  },
};

const reviewComplete: ComponentHandler = {
  prefix: 'review:complete:',
  async execute(interaction, context) {
    const id = interaction.customId.split(':')[2]!;
    const review = context.db.getReview(id);
    if (!review || review.status !== 'claimed') {
      await deny(interaction, context, 'This review is not currently active.');
      return;
    }
    const canComplete =
      interaction.user.id === review.author_id ||
      interaction.user.id === review.reviewer_id ||
      (interaction.inCachedGuild() && interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages));
    if (!canComplete) {
      await deny(interaction, context, 'Only the author, reviewer, or a moderator can complete this review.');
      return;
    }
    const updated = context.db.completeReview(id)!;
    await interaction.update({ embeds: [reviewCard(context, updated)], components: [reviewButtons(updated)] });
    if (updated.reviewer_id) {
      context.db.awardSystemReputation(updated.guild_id, updated.reviewer_id, 1);
      context.v2.changeCredits(updated.guild_id, updated.reviewer_id, 15, 'Completed code review', updated.id);
      context.v2.addSkillXp(updated.guild_id, updated.reviewer_id, 'backend', 20);
      context.v2.updateStreak(updated.guild_id, updated.reviewer_id, 'reviews');
      const unlocked = evaluateAchievements(context, updated.guild_id, updated.reviewer_id);
      const reviewer = await context.client.users.fetch(updated.reviewer_id).catch(() => null);
      await reviewer
        ?.send({
          embeds: [
            successEmbed(
              context,
              'Code review completed',
              `Your review of **${updated.title}** was marked complete.${unlocked.length ? `\n${unlocked.map((item) => `${item.icon} Achievement: **${item.name}**`).join('\n')}` : ''}`,
            ),
          ],
        })
        .catch(() => null);
    }
  },
};

const challengeVote: ComponentHandler = {
  prefix: 'challenge:vote:',
  async execute(interaction, context) {
    const id = interaction.customId.split(':')[2]!;
    const submission = context.db.getChallengeSubmission(id);
    if (!submission) {
      await deny(interaction, context, 'That challenge submission no longer exists.');
      return;
    }
    if (submission.user_id === interaction.user.id) {
      await deny(interaction, context, 'You cannot vote for your own submission.');
      return;
    }
    context.db.toggleChallengeVote(id, interaction.user.id);
    const updated = context.db.getChallengeSubmission(id)!;
    const challenge = context.db.getChallengeById(updated.challenge_id);
    if (!challenge) {
      await deny(interaction, context, 'The challenge attached to this submission no longer exists.');
      return;
    }
    await interaction.update({
      embeds: [submissionCard(context, updated, challenge)],
      components: [submissionButtons(updated)],
    });
  },
};

const pairComplete: ComponentHandler = {
  prefix: 'pair:complete:',
  async execute(interaction, context) {
    const id = interaction.customId.split(':')[2]!;
    const session = context.db.getPairSession(id);
    if (!session || session.status !== 'active') {
      await deny(interaction, context, 'This pair-programming session is already closed.');
      return;
    }
    if (![session.user_one_id, session.user_two_id].includes(interaction.user.id)) {
      await deny(interaction, context, 'Only participants can complete this session.');
      return;
    }
    context.db.completePairSession(id);
    for (const userId of [session.user_one_id, session.user_two_id]) {
      context.db.awardAchievement(session.guild_id, userId, 'PAIR_PROGRAMMER');
      context.v2.changeCredits(session.guild_id, userId, 10, 'Completed pair-programming session', session.id);
      context.v2.addSkillXp(session.guild_id, userId, 'backend', 15);
      context.v2.updateStreak(session.guild_id, userId, 'pairing');
    }
    const unlocked = achievement('PAIR_PROGRAMMER');
    await interaction.update({ components: [] });
    await interaction.followUp({
      embeds: [
        successEmbed(
          context,
          'Pair session completed',
          `${unlocked.icon} Both participants unlocked **${unlocked.name}**. Share one takeaway before this thread is archived.`,
        ),
      ],
    });
    const thread = interaction.channel?.isThread() ? interaction.channel : null;
    if (thread) {
      setTimeout(() => {
        void thread.setArchived(true, 'Pair session completed').catch(() => null);
      }, 60_000);
    }
  },
};

export const componentHandlers: ComponentHandler[] = [
  projectStar,
  projectApply,
  projectApplication,
  reviewClaim,
  reviewComplete,
  challengeVote,
  pairComplete,
  ...pluginComponents,
];

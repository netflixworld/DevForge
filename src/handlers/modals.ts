import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  type ModalSubmitInteraction,
  type TextChannel,
} from 'discord.js';
import { awardProjectAchievement, projectButtons, projectCard, reviewButtons, reviewCard } from '../commands/projects.js';
import { snippetPayload } from '../commands/snippets.js';
import { pluginModals } from '../modules/plugins.js';
import { embed, fields, successEmbed } from '../theme.js';
import type { ModalHandler } from '../types.js';
import { deny, isHttpUrl, normalizedCsv, truncate } from '../utils.js';

function values(interaction: ModalSubmitInteraction<'cached'>, names: string[]): Record<string, string> {
  return Object.fromEntries(names.map((name) => [name, interaction.fields.getTextInputValue(name).trim()]));
}

const createProject: ModalHandler = {
  prefix: 'project:create',
  async execute(interaction, context) {
    const input = values(interaction, ['title', 'summary', 'stack', 'links', 'looking_for']);
    const links = input['links']!.split(/\s+/).filter(Boolean);
    if (links.some((link) => !isHttpUrl(link))) {
      await deny(interaction, context, 'Every project link must start with http:// or https://.');
      return;
    }
    const project = context.db.createProject({
      guildId: interaction.guildId,
      ownerId: interaction.user.id,
      title: input['title']!,
      summary: input['summary']!,
      stack: normalizedCsv(input['stack']!),
      repoUrl: links[0] ?? null,
      demoUrl: links[1] ?? null,
      lookingFor: input['looking_for'] || null,
    });
    context.v2.createItem({
      guildId: interaction.guildId,
      type: 'project_meta',
      ownerId: interaction.user.id,
      title: project.id,
      data: { state: 'planning' },
      idPrefix: 'pmeta',
    });
    const settings = context.db.getSettings(interaction.guildId);
    let destination: TextChannel | null = null;
    if (settings.showcase_channel_id) {
      const channel = await context.client.channels.fetch(settings.showcase_channel_id).catch(() => null);
      if (channel?.type === ChannelType.GuildText) destination = channel;
    }
    const payload = { embeds: [projectCard(context, project)], components: [projectButtons(project)] };
    if (destination) {
      const message = await destination.send(payload);
      context.db.setProjectMessage(project.id, destination.id, message.id);
      await interaction.reply({
        embeds: [successEmbed(context, 'Project published', `**${project.title}** is now live in ${destination}.`)],
        ephemeral: true,
      });
    } else {
      await interaction.reply(payload);
      const message = await interaction.fetchReply();
      context.db.setProjectMessage(project.id, message.channelId, message.id);
    }
    awardProjectAchievement(context, interaction.guildId, interaction.user.id);
  },
};

const applyProject: ModalHandler = {
  prefix: 'project:apply:',
  async execute(interaction, context) {
    const projectId = interaction.customId.split(':')[2]!;
    const project = context.db.getProject(projectId);
    if (!project || project.guild_id !== interaction.guildId || project.status !== 'open') {
      await deny(interaction, context, 'This project is no longer accepting applications.');
      return;
    }
    if (project.owner_id === interaction.user.id) {
      await deny(interaction, context, 'You already own this project.');
      return;
    }
    const pitch = interaction.fields.getTextInputValue('pitch').trim();
    const applicationId = context.db.createProjectApplication(project.id, interaction.user.id, pitch);
    const controls = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`application:accept:${applicationId}`)
        .setLabel('Accept collaborator')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`application:decline:${applicationId}`)
        .setLabel('Decline')
        .setStyle(ButtonStyle.Secondary),
    );
    const owner = await context.client.users.fetch(project.owner_id);
    const delivered = await owner
      .send({
        embeds: [
          embed(
            context,
            `🤝 Collaboration request • ${project.title}`,
            `<@${interaction.user.id}> would like to join your project.\n\n> ${truncate(pitch, 900)}`,
          ).addFields({ name: 'Project ID', value: `\`${project.id}\`` }),
        ],
        components: [controls],
      })
      .then(() => true)
      .catch(() => false);
    if (!delivered && project.channel_id) {
      const channel = await context.client.channels.fetch(project.channel_id).catch(() => null);
      if (channel?.isTextBased() && !channel.isDMBased()) {
        await channel.send({
          content: `<@${project.owner_id}>`,
          embeds: [embed(context, 'New collaboration request', `<@${interaction.user.id}> applied to **${project.title}**. Your DMs are closed; contact them directly.`)],
        });
      }
    }
    await interaction.reply({
      embeds: [
        successEmbed(
          context,
          'Application sent',
          delivered
            ? `The creator of **${project.title}** received your collaboration pitch.`
            : `Your request was recorded, but the creator’s DMs are closed. They were notified in the project channel when possible.`,
        ),
      ],
      ephemeral: true,
    });
  },
};

const createReview: ModalHandler = {
  prefix: 'review:create:',
  async execute(interaction, context) {
    const difficulty = interaction.customId.split(':')[2] ?? 'Focused';
    const priority = interaction.customId.split(':')[3] ?? 'normal';
    const input = values(interaction, ['title', 'description', 'repository', 'language']);
    if (!isHttpUrl(input['repository']!)) {
      await deny(interaction, context, 'The repository or pull request must be a valid http:// or https:// URL.');
      return;
    }
    const review = context.db.createReview({
      guildId: interaction.guildId,
      authorId: interaction.user.id,
      title: input['title']!,
      description: input['description']!,
      repository: input['repository']!,
      language: input['language']!,
      difficulty,
    });
    context.v2.createItem({
      guildId: interaction.guildId,
      type: 'review_meta',
      ownerId: interaction.user.id,
      title: review.id,
      data: { priority },
      idPrefix: 'rmeta',
    });
    const settings = context.db.getSettings(interaction.guildId);
    let destination: TextChannel | null = null;
    if (settings.review_channel_id) {
      const channel = await context.client.channels.fetch(settings.review_channel_id).catch(() => null);
      if (channel?.type === ChannelType.GuildText) destination = channel;
    }
    const payload = { embeds: [reviewCard(context, review)], components: [reviewButtons(review)] };
    if (destination) {
      const message = await destination.send(payload);
      context.db.setReviewMessage(review.id, destination.id, message.id);
      await interaction.reply({
        embeds: [successEmbed(context, 'Review requested', `Your request is now in ${destination}.`)],
        ephemeral: true,
      });
    } else {
      await interaction.reply(payload);
      const message = await interaction.fetchReply();
      context.db.setReviewMessage(review.id, message.channelId, message.id);
    }
  },
};

const createSnippet: ModalHandler = {
  prefix: 'snippet:create:',
  async execute(interaction, context) {
    const visibility = interaction.customId.split(':')[2] === 'private' ? 'private' : 'public';
    const input = values(interaction, ['name', 'language', 'description', 'tags', 'code']);
    if (!/^[a-z0-9][a-z0-9_-]{1,59}$/i.test(input['name']!)) {
      await deny(interaction, context, 'Snippet names may only contain letters, numbers, hyphens, and underscores.');
      return;
    }
    const snippet = context.db.saveSnippet({
      guildId: interaction.guildId,
      ownerId: interaction.user.id,
      name: input['name']!,
      language: input['language']!,
      description: input['description']!,
      code: input['code']!,
      tags: normalizedCsv(input['tags']!),
      visibility,
    });
    context.v2.createItem({
      guildId: interaction.guildId,
      type: 'snippet_version',
      ownerId: interaction.user.id,
      title: snippet.id,
      data: {
        language: snippet.language,
        description: snippet.description,
        code: snippet.code,
        tags: snippet.tags,
        visibility: snippet.visibility,
      },
      idPrefix: 'sver',
    });
    await interaction.reply({ ...snippetPayload(context, snippet), ephemeral: true });
  },
};

const rubberduck: ModalHandler = {
  prefix: 'rubberduck:create',
  async execute(interaction, context) {
    const input = values(interaction, ['problem', 'expected', 'actual', 'tried', 'environment']);
    const session = context.v2.createItem({
      guildId: interaction.guildId,
      type: 'rubberduck_session',
      ownerId: interaction.user.id,
      title: truncate(input['problem']!, 100),
      status: 'active',
      data: { ...input, step: 0 },
      idPrefix: 'duck',
    });
    await interaction.reply({
      embeds: [
        embed(context, `🦆 Debugging brief • ${interaction.user.displayName}`)
          .setColor(0xfbbf24)
          .addFields(
            ...fields([
              ['Goal', input['problem']!],
              ['Expected behavior', input['expected']!],
              ['Actual behavior', input['actual']!],
              ['Already tried', input['tried']!],
              ['Environment / reproduction', input['environment'] || 'Not provided'],
              [
                'Duck checklist',
                '1. Reduce it to the smallest failing input.\n2. Verify every assumption at the boundary.\n3. Read the first relevant error, not the last cascade.\n4. Compare one working and one failing case.\n5. Never post tokens or private data.',
              ],
            ]),
          ),
      ],
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`v2:duck:next:${session.id}`).setLabel('Next debugging question').setEmoji('🧠').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`v2:duck:solved:${session.id}`).setLabel('Solved').setEmoji('✅').setStyle(ButtonStyle.Success),
      )],
    });
  },
};

const standup: ModalHandler = {
  prefix: 'standup:create',
  async execute(interaction, context) {
    const input = values(interaction, ['shipped', 'next', 'blockers', 'mood']);
    context.v2.createItem({
      guildId: interaction.guildId,
      type: 'standup',
      ownerId: interaction.user.id,
      title: new Date().toISOString().slice(0, 10),
      data: input,
      idPrefix: 'stand',
    });
    context.v2.updateStreak(interaction.guildId, interaction.user.id, 'standup');
    await interaction.reply({
      embeds: [
        embed(context, `☀️ Stand-up • ${interaction.user.displayName}`)
          .setThumbnail(interaction.user.displayAvatarURL({ size: 128 }))
          .addFields(
            ...fields([
              ['Shipped / learned', input['shipped']!],
              ['Next meaningful step', input['next']!],
              ['Blockers / help wanted', input['blockers']!],
              ['Energy / focus', input['mood'] || 'Not specified'],
            ]),
          ),
      ],
    });
  },
};

const idea: ModalHandler = {
  prefix: 'idea:create',
  async execute(interaction, context) {
    const input = values(interaction, ['title', 'problem', 'proposal', 'tradeoffs']);
    const ideaItem = context.v2.createItem({
      guildId: interaction.guildId,
      type: 'idea',
      ownerId: interaction.user.id,
      title: input['title']!,
      status: 'voting',
      data: { problem: input['problem']!, proposal: input['proposal']!, tradeoffs: input['tradeoffs'] || '' },
      idPrefix: 'idea',
    });
    await interaction.reply({
      embeds: [
        embed(context, `💡 RFC: ${input['title']}`, input['problem']!)
          .setColor(context.config.accentColor)
          .addFields(
            ...fields([
              ['Proposed approach', input['proposal']!],
              ['Tradeoffs / alternatives', input['tradeoffs'] || 'Not provided — explore these in the discussion thread.'],
              ['Author', `${interaction.user} • ${interaction.user.tag}`],
              ['Idea ID', `\`${ideaItem.id}\``],
              ['Feedback guide', '🟢 Support • 🟡 Questions / changes • 🔴 Fundamental concern'],
            ]),
          ),
      ],
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`v2:idea:interest:${ideaItem.id}`).setLabel('I’m interested').setEmoji('🙋').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`v2:idea:convert:${ideaItem.id}`).setLabel('Convert to project').setEmoji('🚀').setStyle(ButtonStyle.Success),
      )],
    });
    const message = await interaction.fetchReply();
    await Promise.allSettled([message.react('🟢'), message.react('🟡'), message.react('🔴')]);
    if ('startThread' in message) {
      await message
        .startThread({ name: `RFC • ${truncate(input['title']!, 70)}`, autoArchiveDuration: 1440 })
        .then((thread) => thread.send('Discuss evidence, constraints, alternatives, and implementation risks here.'))
        .catch(() => null);
    }
  },
};

export const modalHandlers: ModalHandler[] = [
  createProject,
  applyProject,
  createReview,
  createSnippet,
  rubberduck,
  standup,
  idea,
  ...pluginModals,
];

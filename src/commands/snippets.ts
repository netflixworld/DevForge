import {
  ActionRowBuilder,
  AttachmentBuilder,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { embed, fields, successEmbed } from '../theme.js';
import type { BotCommand, BotContext, SnippetRow } from '../types.js';
import { deny, relativeTimestamp, safeCodeBlock, truncate } from '../utils.js';

export function snippetPayload(context: BotContext, snippet: SnippetRow): {
  embeds: ReturnType<typeof embed>[];
  files?: AttachmentBuilder[];
} {
  const details = embed(context, `📚 ${snippet.name}`, snippet.description).addFields(
    ...fields([
      ['Language', snippet.language, true],
      ['Tags', snippet.tags || 'None', true],
      ['Saved by', `<@${snippet.owner_id}>`, true],
      ['Visibility', snippet.visibility, true],
      ['Uses', snippet.uses.toString(), true],
      ['Snippet ID', `\`${snippet.id}\``, true],
    ]),
  );
  if (snippet.code.length <= 2_800) {
    details.addFields({ name: 'Code', value: safeCodeBlock(snippet.code, snippet.language) });
    return { embeds: [details] };
  }
  const extension = snippet.language.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10) || 'txt';
  const attachment = new AttachmentBuilder(Buffer.from(snippet.code, 'utf8'), {
    name: `${snippet.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}.${extension}`,
    description: snippet.description,
  });
  details.addFields({ name: 'Code', value: 'The complete snippet is attached because it is too long for an embed.' });
  return { embeds: [details], files: [attachment] };
}

const snippetCommand: BotCommand = {
  module: 'snippets',
  data: new SlashCommandBuilder()
    .setName('snippet')
    .setDescription('Save, search, and reuse a community code-snippet library.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('save')
        .setDescription('Save or update a named code snippet.')
        .addStringOption((option) =>
          option
            .setName('visibility')
            .setDescription('Who can find this snippet?')
            .setRequired(true)
            .addChoices(
              { name: 'Public • visible to the server', value: 'public' },
              { name: 'Private • only visible to you', value: 'private' },
            ),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('get')
        .setDescription('Open a saved snippet.')
        .addStringOption((option) =>
          option.setName('snippet').setDescription('Search by snippet name.').setRequired(true).setAutocomplete(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('search')
        .setDescription('Search names, descriptions, languages, and tags.')
        .addStringOption((option) =>
          option.setName('query').setDescription('What are you looking for?').setRequired(true).setMaxLength(100),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('delete')
        .setDescription('Delete one of your snippets.')
        .addStringOption((option) =>
          option.setName('snippet').setDescription('Your snippet.').setRequired(true).setAutocomplete(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('favorite').setDescription('Add or remove a snippet from your favorites.')
        .addStringOption((option) => option.setName('snippet').setDescription('Snippet to favorite.').setRequired(true).setAutocomplete(true)),
    )
    .addSubcommand((subcommand) => subcommand.setName('favorites').setDescription('List your favorite snippets.'))
    .addSubcommand((subcommand) =>
      subcommand.setName('vote').setDescription('Vote on a public snippet.')
        .addStringOption((option) => option.setName('snippet').setDescription('Snippet to vote on.').setRequired(true).setAutocomplete(true))
        .addStringOption((option) => option.setName('vote').setDescription('Your vote.').setRequired(true).addChoices(
          { name: 'Useful', value: 'up' }, { name: 'Needs improvement', value: 'down' },
        )),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('versions').setDescription('View saved versions of a snippet.')
        .addStringOption((option) => option.setName('snippet').setDescription('Snippet to inspect.').setRequired(true).setAutocomplete(true)),
    ),
  async execute(interaction, context) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'save') {
      const visibility = interaction.options.getString('visibility', true);
      const modal = new ModalBuilder().setCustomId(`snippet:create:${visibility}`).setTitle('Save a reusable code snippet');
      modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('name')
            .setLabel('Unique snippet name')
            .setPlaceholder('retry-with-backoff')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(60)
            .setRequired(true),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('language')
            .setLabel('Language')
            .setPlaceholder('typescript')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(30)
            .setRequired(true),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('description')
            .setLabel('What does this snippet do?')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(200)
            .setRequired(true),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('tags')
            .setLabel('Tags (comma-separated)')
            .setPlaceholder('http, retry, resilience')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(150)
            .setRequired(false),
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('code')
            .setLabel('Code')
            .setStyle(TextInputStyle.Paragraph)
            .setMinLength(3)
            .setMaxLength(4000)
            .setRequired(true),
        ),
      );
      await interaction.showModal(modal);
      return;
    }

    if (subcommand === 'search') {
      const query = interaction.options.getString('query', true).trim();
      const results = context.db.searchSnippets(interaction.guildId, query, interaction.user.id);
      const body = results.length
        ? results
            .map(
              (snippet) =>
                `\`${snippet.id}\` **${truncate(snippet.name, 60)}** • ${snippet.language}\n${truncate(snippet.description, 140)}\nTags: ${truncate(snippet.tags || 'none', 100)} • ${snippet.uses} uses`,
            )
            .join('\n\n')
        : `No snippets match **${truncate(query, 100)}**.`;
      await interaction.reply({ embeds: [embed(context, `📚 Snippet results for “${truncate(query, 60)}”`, body)] });
      return;
    }

    if (subcommand === 'favorites') {
      const favorites = context.v2.listItems({ guildId: interaction.guildId, type: 'snippet_favorite', ownerId: interaction.user.id, status: 'active', limit: 50 });
      const snippets = favorites.map((favorite) => context.db.getSnippetById(favorite.title)).filter((item) => Boolean(item));
      const body = snippets.length
        ? snippets.map((item) => `\`${item!.id}\` **${item!.name}** • ${item!.language}\n${truncate(item!.description, 150)}`).join('\n\n')
        : 'You have no favorite snippets yet.';
      await interaction.reply({ embeds: [embed(context, '⭐ Favorite snippets', body)], ephemeral: true });
      return;
    }

    const id = interaction.options.getString('snippet', true);
    const snippet = context.db.getSnippetById(id);
    if (!snippet || snippet.guild_id !== interaction.guildId) {
      await deny(interaction, context, 'That snippet does not exist in this server.');
      return;
    }

    if (subcommand === 'get') {
      if (snippet.visibility === 'private' && snippet.owner_id !== interaction.user.id) {
        await deny(interaction, context, 'That snippet is private.');
        return;
      }
      context.db.incrementSnippetUses(snippet.id);
      const updated = context.db.getSnippetById(snippet.id)!;
      await interaction.reply({ ...snippetPayload(context, updated), ephemeral: snippet.visibility === 'private' });
      return;
    }

    if (subcommand === 'favorite') {
      if (snippet.visibility === 'private' && snippet.owner_id !== interaction.user.id) {
        await deny(interaction, context, 'That snippet is private.');
        return;
      }
      const existing = context.v2.listItems({ guildId: interaction.guildId, type: 'snippet_favorite', ownerId: interaction.user.id, limit: 100 })
        .find((item) => item.title === snippet.id && item.status === 'active');
      if (existing) context.v2.updateItem(existing.id, { status: 'removed' });
      else context.v2.createItem({ guildId: interaction.guildId, type: 'snippet_favorite', ownerId: interaction.user.id, title: snippet.id, status: 'active', data: {}, idPrefix: 'fav' });
      await interaction.reply({ embeds: [successEmbed(context, existing ? 'Favorite removed' : 'Favorite saved', `**${snippet.name}** ${existing ? 'was removed from' : 'was added to'} your favorites.`)], ephemeral: true });
      return;
    }

    if (subcommand === 'vote') {
      if (snippet.visibility !== 'public') {
        await deny(interaction, context, 'Only public snippets can receive community votes.');
        return;
      }
      const value = interaction.options.getString('vote', true);
      let target = context.v2.listItems({ guildId: interaction.guildId, type: 'snippet_vote_target', limit: 100 })
        .find((item) => item.title === snippet.id);
      target ??= context.v2.createItem({ guildId: interaction.guildId, type: 'snippet_vote_target', ownerId: snippet.owner_id, title: snippet.id, data: {}, idPrefix: 'svote' });
      const result = context.v2.vote(target.id, interaction.user.id, value);
      await interaction.reply({ embeds: [successEmbed(context, result.created ? 'Vote recorded' : 'Vote removed', `**${snippet.name}** now has **${result.total} ${value}** vote(s).`)], ephemeral: true });
      return;
    }

    if (subcommand === 'versions') {
      if (snippet.visibility === 'private' && snippet.owner_id !== interaction.user.id) {
        await deny(interaction, context, 'That snippet is private.');
        return;
      }
      const versions = context.v2.listItems({ guildId: interaction.guildId, type: 'snippet_version', limit: 100 })
        .filter((item) => item.title === snippet.id);
      const body = versions.length
        ? versions.slice(0, 20).map((version, index) => `**v${versions.length - index}** • ${relativeTimestamp(version.created_at)} • <@${version.owner_id}>`).join('\n')
        : 'No version history has been recorded yet. The next save will create one.';
      await interaction.reply({ embeds: [embed(context, `📦 ${snippet.name} versions`, body)], ephemeral: true });
      return;
    }

    if (snippet.owner_id !== interaction.user.id) {
      await deny(interaction, context, 'You can only delete snippets that you created.');
      return;
    }
    context.db.deleteSnippet(snippet.id, interaction.user.id);
    await interaction.reply({
      embeds: [successEmbed(context, 'Snippet deleted', `**${snippet.name}** was removed from the library.`)],
      ephemeral: true,
    });
  },
  async autocomplete(interaction, context) {
    const query = interaction.options.getFocused().toLowerCase();
    const subcommand = interaction.options.getSubcommand();
    const results = context.db
      .autocompleteSnippets(interaction.guildId, query, interaction.user.id)
      .filter((snippet) => subcommand !== 'delete' || snippet.owner_id === interaction.user.id);
    await interaction.respond(
      results.slice(0, 25).map((snippet) => ({
        name: `${truncate(snippet.name, 65)} • ${snippet.language}${snippet.visibility === 'private' ? ' • private' : ''}`,
        value: snippet.id,
      })),
    );
  },
};

export const snippetCommands: BotCommand[] = [snippetCommand];

import {
  ActionRowBuilder,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  PermissionFlagsBits,
} from 'discord.js';
import { projectButtons, projectCard } from './projects.js';
import { embed, fields } from '../theme.js';
import type { BotCommand } from '../types.js';
import { deny } from '../utils.js';

interface GithubRepository {
  full_name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  language: string | null;
  license: { spdx_id: string } | null;
  default_branch: string;
  pushed_at: string;
  owner: { login: string; avatar_url: string };
  archived: boolean;
}

interface GithubUser {
  login: string;
  html_url: string;
  avatar_url: string;
  name: string | null;
  bio: string | null;
  public_repos: number;
  followers: number;
  following: number;
  created_at: string;
  location: string | null;
  company: string | null;
}

const rubberduckCommand: BotCommand = {
  module: 'rubber_duck',
  data: new SlashCommandBuilder()
    .setName('rubberduck')
    .setDescription('Turn a vague bug into a structured debugging brief.'),
  async execute(interaction) {
    const modal = new ModalBuilder().setCustomId('rubberduck:create').setTitle('Explain the bug to the duck');
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('problem')
          .setLabel('What are you trying to accomplish?')
          .setStyle(TextInputStyle.Paragraph)
          .setMinLength(15)
          .setMaxLength(700)
          .setRequired(true),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('expected')
          .setLabel('What did you expect to happen?')
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(500)
          .setRequired(true),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('actual')
          .setLabel('What happened instead?')
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(700)
          .setRequired(true),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('tried')
          .setLabel('What have you already tried?')
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(700)
          .setRequired(true),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('environment')
          .setLabel('Environment and smallest reproduction')
          .setPlaceholder('Node 24, Windows 11, repository or code pointer…')
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(700)
          .setRequired(false),
      ),
    );
    await interaction.showModal(modal);
  },
};

const standupCommand: BotCommand = {
  module: 'standups',
  data: new SlashCommandBuilder().setName('standup').setDescription('Post a concise asynchronous developer stand-up.'),
  async execute(interaction) {
    const modal = new ModalBuilder().setCustomId('standup:create').setTitle('Async developer stand-up');
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('shipped')
          .setLabel('What did you ship or learn?')
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(700)
          .setRequired(true),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('next')
          .setLabel('What is your next meaningful step?')
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(700)
          .setRequired(true),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('blockers')
          .setLabel('Blockers or help wanted')
          .setPlaceholder('Write “None” if you are unblocked.')
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(500)
          .setRequired(true),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('mood')
          .setLabel('Energy / focus in one line')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(100)
          .setRequired(false),
      ),
    );
    await interaction.showModal(modal);
  },
};

const ideaCommand: BotCommand = {
  module: 'ideas',
  data: new SlashCommandBuilder()
    .setName('idea')
    .setDescription('Incubate ideas, gather interest, and convert them into projects.')
    .addSubcommand((subcommand) => subcommand.setName('create').setDescription('Open an idea for community discussion.'))
    .addSubcommand((subcommand) => subcommand.setName('list').setDescription('Browse recent community ideas.'))
    .addSubcommand((subcommand) =>
      subcommand.setName('status').setDescription('Update one of your idea states.')
        .addStringOption((option) => option.setName('id').setDescription('Idea ID.').setRequired(true))
        .addStringOption((option) => option.setName('state').setDescription('New state.').setRequired(true).addChoices(
          { name: 'Voting', value: 'voting' }, { name: 'Exploring', value: 'exploring' }, { name: 'Approved', value: 'approved' }, { name: 'Rejected', value: 'rejected' }, { name: 'Converted', value: 'converted' },
        )),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('convert').setDescription('Convert an idea directly into a project.')
        .addStringOption((option) => option.setName('id').setDescription('Idea ID.').setRequired(true))
        .addStringOption((option) => option.setName('stack').setDescription('Comma-separated technologies.').setRequired(true).setMaxLength(200))
        .addStringOption((option) => option.setName('repository').setDescription('Optional repository URL.').setMaxLength(300))
        .addStringOption((option) => option.setName('looking_for').setDescription('Contributors or feedback needed.').setMaxLength(200)),
    ),
  async execute(interaction, context) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'list') {
      const ideas = context.v2.listItems({ guildId: interaction.guildId, type: 'idea', limit: 20 });
      const body = ideas.length
        ? ideas.map((idea) => `**${idea.id} • ${idea.title}** — ${idea.status}\n${String(idea.data['problem']).slice(0, 180)}${String(idea.data['problem']).length > 180 ? '…' : ''}`).join('\n\n')
        : 'No ideas have been submitted yet.';
      await interaction.reply({ embeds: [embed(context, '💡 Idea incubator', body)] });
      return;
    }
    if (subcommand === 'status') {
      const id = interaction.options.getString('id', true);
      const item = context.v2.getItem(id, 'idea');
      if (!item || item.guild_id !== interaction.guildId) {
        await deny(interaction, context, 'Idea not found in this server.');
        return;
      }
      if (item.owner_id !== interaction.user.id && !interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
        await deny(interaction, context, 'Only the idea author or a server manager can update its state.');
        return;
      }
      const state = interaction.options.getString('state', true);
      context.v2.updateItem(item.id, { status: state });
      await interaction.reply({ embeds: [embed(context, '✅ Idea state updated', `**${item.title}** is now **${state}**.`)] });
      return;
    }
    if (subcommand === 'convert') {
      const id = interaction.options.getString('id', true);
      const item = context.v2.getItem(id, 'idea');
      if (!item || item.guild_id !== interaction.guildId) {
        await deny(interaction, context, 'Idea not found in this server.');
        return;
      }
      if (item.owner_id !== interaction.user.id && !interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
        await deny(interaction, context, 'Only the idea author or a server manager can convert it.');
        return;
      }
      const repository = interaction.options.getString('repository');
      if (repository && !/^https?:\/\//i.test(repository)) {
        await deny(interaction, context, 'The repository must be a valid http:// or https:// URL.');
        return;
      }
      const project = context.db.createProject({
        guildId: interaction.guildId,
        ownerId: item.owner_id,
        title: item.title,
        summary: String(item.data['proposal'] || item.data['problem']),
        stack: interaction.options.getString('stack', true),
        repoUrl: repository,
        demoUrl: null,
        lookingFor: interaction.options.getString('looking_for'),
      });
      context.v2.updateItem(item.id, { status: 'converted', data: { projectId: project.id } });
      context.v2.createItem({ guildId: interaction.guildId, type: 'project_meta', ownerId: item.owner_id, title: project.id, data: { state: 'planning', sourceIdeaId: item.id }, idPrefix: 'pmeta' });
      await interaction.reply({ embeds: [projectCard(context, project)], components: [projectButtons(project)] });
      return;
    }
    const modal = new ModalBuilder().setCustomId('idea:create').setTitle('Open a community RFC');
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('title')
          .setLabel('Proposal title')
          .setStyle(TextInputStyle.Short)
          .setMaxLength(100)
          .setRequired(true),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('problem')
          .setLabel('Problem / opportunity')
          .setStyle(TextInputStyle.Paragraph)
          .setMinLength(20)
          .setMaxLength(900)
          .setRequired(true),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('proposal')
          .setLabel('Proposed approach')
          .setStyle(TextInputStyle.Paragraph)
          .setMinLength(20)
          .setMaxLength(1200)
          .setRequired(true),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('tradeoffs')
          .setLabel('Tradeoffs and alternatives')
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(800)
          .setRequired(false),
      ),
    );
    await interaction.showModal(modal);
  },
};

const githubCommand: BotCommand = {
  module: 'github',
  data: new SlashCommandBuilder()
    .setName('github')
    .setDescription('Inspect repositories and check the GitHub event bridge.')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('repo')
        .setDescription('Inspect a public GitHub repository.')
        .addStringOption((option) =>
          option.setName('repository').setDescription('owner/repository').setRequired(true).setMaxLength(150),
        ),
    )
    .addSubcommand((subcommand) => subcommand.setName('webhook').setDescription('View GitHub webhook setup status.'))
    .addSubcommand((subcommand) =>
      subcommand.setName('user').setDescription('Inspect a public GitHub developer profile.')
        .addStringOption((option) => option.setName('username').setDescription('GitHub username.').setRequired(true).setMaxLength(39)),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('subscribe').setDescription('Route repository events to a channel.')
        .addStringOption((option) => option.setName('repository').setDescription('owner/repository').setRequired(true).setMaxLength(150))
        .addChannelOption((option) => option.setName('channel').setDescription('Destination channel.').setRequired(true).addChannelTypes(ChannelType.GuildText))
        .addStringOption((option) => option.setName('events').setDescription('Events to receive.').setRequired(true).addChoices(
          { name: 'All supported events', value: 'all' }, { name: 'Pushes', value: 'push' }, { name: 'Pull requests', value: 'pull_request' }, { name: 'Issues', value: 'issues' }, { name: 'Releases', value: 'release' },
        )),
    )
    .addSubcommand((subcommand) => subcommand.setName('subscriptions').setDescription('List repository event subscriptions.')),
  async execute(interaction, context) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'webhook') {
      const settings = context.db.getSettings(interaction.guildId);
      const enabled = Boolean(context.config.githubWebhookSecret && settings.github_channel_id);
      await interaction.reply({
        embeds: [
          embed(
            context,
            '🔗 GitHub Event Bridge',
            enabled
              ? `Ready. Verified GitHub events are delivered to <#${settings.github_channel_id}>.`
              : 'Not fully configured yet. Set `GITHUB_WEBHOOK_SECRET`, configure a GitHub channel with `/config channel`, and send webhooks to `/webhooks/github` on this bot’s public address.',
          ).addFields(
            ...fields([
              ['Signature verification', context.config.githubWebhookSecret ? '✅ Enabled' : '❌ Missing secret', true],
              ['Destination channel', settings.github_channel_id ? `<#${settings.github_channel_id}>` : 'Not configured', true],
              ['Supported events', 'Pushes, pull requests, issues, and releases'],
            ]),
          ),
        ],
        ephemeral: true,
      });
      return;
    }

    if (subcommand === 'subscriptions') {
      const items = context.v2.listItems({ guildId: interaction.guildId, type: 'github_subscription', status: 'active', limit: 50 });
      const body = items.length ? items.map((item) => `**${item.id}** • ${String(item.data['repository'])} • ${String(item.data['events'])} → <#${String(item.data['channelId'])}>`).join('\n') : 'No repository-specific subscriptions. The legacy global GitHub channel may still receive events.';
      await interaction.reply({ embeds: [embed(context, '🔗 GitHub subscriptions', body)], ephemeral: true });
      return;
    }

    if (subcommand === 'subscribe') {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
        await deny(interaction, context, 'You need **Manage Server** to configure GitHub subscriptions.');
        return;
      }
      const repository = interaction.options.getString('repository', true).trim().toLowerCase();
      if (!/^[a-z\d_.-]+\/[a-z\d_.-]+$/i.test(repository)) {
        await deny(interaction, context, 'Use the `owner/repository` format.');
        return;
      }
      const channel = interaction.options.getChannel('channel', true);
      const events = interaction.options.getString('events', true);
      const item = context.v2.createItem({ guildId: interaction.guildId, type: 'github_subscription', ownerId: interaction.user.id, title: repository, data: { repository, channelId: channel.id, events }, idPrefix: 'ghsub' });
      await interaction.reply({ embeds: [embed(context, '✅ GitHub subscription created', `**${repository}** • ${events} → ${channel}\nID: \`${item.id}\``)], ephemeral: true });
      return;
    }

    if (subcommand === 'user') {
      const username = interaction.options.getString('username', true).trim();
      if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(username)) {
        await deny(interaction, context, 'Enter a valid GitHub username.');
        return;
      }
      await interaction.deferReply();
      const headers: Record<string, string> = { Accept: 'application/vnd.github+json', 'User-Agent': 'DevForge-Discord-Bot', 'X-GitHub-Api-Version': '2022-11-28' };
      if (context.config.githubToken) headers.Authorization = `Bearer ${context.config.githubToken}`;
      try {
        const response = await fetch(`https://api.github.com/users/${username}`, { headers, signal: AbortSignal.timeout(10_000) });
        if (!response.ok) {
          await interaction.editReply({ embeds: [embed(context, 'GitHub user unavailable', response.status === 404 ? 'That user was not found.' : `GitHub returned HTTP ${response.status}.`).setColor(0xef4444)] });
          return;
        }
        const data = await response.json() as GithubUser;
        await interaction.editReply({ embeds: [embed(context, `◉ ${data.name ?? data.login}`, data.bio ?? 'No public bio.').setURL(data.html_url).setThumbnail(data.avatar_url).addFields(...fields([
          ['Username', data.login, true], ['Public repositories', String(data.public_repos), true], ['Followers', String(data.followers), true], ['Following', String(data.following), true], ['Company', data.company ?? 'Not listed', true], ['Location', data.location ?? 'Not listed', true], ['Joined GitHub', `<t:${Math.floor(new Date(data.created_at).getTime() / 1000)}:D>`, true],
        ]))] });
      } catch {
        await interaction.editReply({ embeds: [embed(context, 'GitHub request failed', 'The request timed out or GitHub could not be reached.').setColor(0xef4444)] });
      }
      return;
    }

    const repository = interaction.options.getString('repository', true).trim().toLowerCase();
    if (!/^[a-z\d_.-]+\/[a-z\d_.-]+$/i.test(repository)) {
      await deny(interaction, context, 'Use the `owner/repository` format, for example `discordjs/discord.js`.');
      return;
    }
    await interaction.deferReply();
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'DevForge-Discord-Bot',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (context.config.githubToken) headers.Authorization = `Bearer ${context.config.githubToken}`;
    try {
      const response = await fetch(`https://api.github.com/repos/${repository}`, {
        headers,
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        await interaction.editReply({
          embeds: [
            embed(
              context,
              'GitHub repository unavailable',
              response.status === 404
                ? 'The repository was not found or is private.'
                : `GitHub returned HTTP ${response.status}. Try again later.`,
            ).setColor(0xef4444),
          ],
        });
        return;
      }
      const data = (await response.json()) as GithubRepository;
      await interaction.editReply({
        embeds: [
          embed(context, `◉ ${data.full_name}`, data.description ?? 'No repository description.')
            .setURL(data.html_url)
            .setThumbnail(data.owner.avatar_url)
            .addFields(
              ...fields([
                ['Stars', data.stargazers_count.toLocaleString(), true],
                ['Forks', data.forks_count.toLocaleString(), true],
                ['Open issues', data.open_issues_count.toLocaleString(), true],
                ['Primary language', data.language ?? 'Not detected', true],
                ['License', data.license?.spdx_id ?? 'Not declared', true],
                ['Default branch', `\`${data.default_branch}\``, true],
                ['Last push', `<t:${Math.floor(new Date(data.pushed_at).getTime() / 1000)}:R>`, true],
                ['State', data.archived ? 'Archived' : 'Active', true],
              ]),
            ),
        ],
      });
    } catch (error) {
      context.logger.warn('GitHub repository lookup failed.', { repository, error: String(error) });
      await interaction.editReply({
        embeds: [embed(context, 'GitHub request failed', 'The request timed out or GitHub could not be reached.').setColor(0xef4444)],
      });
    }
  },
};

export const toolCommands: BotCommand[] = [rubberduckCommand, standupCommand, ideaCommand, githubCommand];

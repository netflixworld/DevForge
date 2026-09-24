import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ModalBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type GuildMember,
  type ModalSubmitInteraction,
  type Role,
  type TextChannel,
} from 'discord.js';
import { embed, fields, successEmbed } from '../theme.js';
import type { BotCommand, BotContext, ComponentHandler, ModalHandler, SelectHandler } from '../types.js';
import { deny, relativeTimestamp, truncate } from '../utils.js';
import type { FeatureItem, JsonObject } from '../v2/store.js';

interface TicketData extends JsonObject {
  channelId: string;
  category: string;
  subject: string;
  details: string;
  priority: string;
  claimedBy: string | null;
  closedBy: string | null;
  rating: number | null;
  lastActivityAt: string;
}

function ticketButtons(id: string, closed = false): ActionRowBuilder<ButtonBuilder> {
  if (closed) {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`v2:ticket:rate:${id}:5`).setLabel('Rate 5★').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`v2:ticket:rate:${id}:4`).setLabel('Rate 4★').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`v2:ticket:rate:${id}:3`).setLabel('Rate 3★').setStyle(ButtonStyle.Secondary),
    );
  }
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`v2:ticket:claim:${id}`).setLabel('Claim').setEmoji('🙋').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`v2:ticket:priority:${id}`).setLabel('Raise priority').setEmoji('⬆️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`v2:ticket:close:${id}`).setLabel('Close').setEmoji('🔒').setStyle(ButtonStyle.Danger),
  );
}

function ticketModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId('v2:ticket:create')
    .setTitle('Open a support ticket')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('category').setLabel('Category').setPlaceholder('Technical, community, report, partnership...').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(50),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('subject').setLabel('Subject').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('details').setLabel('Describe what you need').setStyle(TextInputStyle.Paragraph).setRequired(true).setMinLength(20).setMaxLength(1500),
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder().setCustomId('priority').setLabel('Priority').setPlaceholder('Low, normal, high, urgent').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(20),
      ),
    );
}

function ticketForChannel(context: BotContext, guildId: string, channelId: string): FeatureItem<TicketData> | undefined {
  return context.v2
    .listItems<TicketData>({ guildId, type: 'ticket', limit: 100 })
    .find((item) => item.data.channelId === channelId);
}

function isTicketStaff(member: GuildMember, context: BotContext): boolean {
  const settings = context.db.getSettings(member.guild.id);
  const supportRole = context.v2.getSetting(member.guild.id, 'ticket.supportRoleId', '');
  return member.permissions.has(PermissionFlagsBits.ManageChannels)
    || Boolean(settings.moderator_role_id && member.roles.cache.has(settings.moderator_role_id))
    || Boolean(supportRole && member.roles.cache.has(supportRole));
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function transcript(channel: TextChannel, ticket: FeatureItem<TicketData>): Promise<AttachmentBuilder> {
  const fetched = await channel.messages.fetch({ limit: 100 });
  const messages = [...fetched.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);
  const entries = messages.map((message) => {
    const attachments = [...message.attachments.values()]
      .map((attachment) => `<a href="${escapeHtml(attachment.url)}">${escapeHtml(attachment.name)}</a>`)
      .join(' ');
    return `<article><header><strong>${escapeHtml(message.author.tag)}</strong><time>${message.createdAt.toISOString()}</time></header><p>${escapeHtml(message.cleanContent).replaceAll('\n', '<br>')}</p>${attachments}</article>`;
  }).join('\n');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(ticket.title)}</title><style>body{font:15px system-ui;background:#111827;color:#e5e7eb;max-width:900px;margin:auto;padding:32px}h1{color:#67e8f9}article{padding:16px;border-bottom:1px solid #374151}header{display:flex;gap:12px;justify-content:space-between}time{color:#9ca3af;font-size:12px}p{line-height:1.5}a{color:#93c5fd}</style></head><body><h1>${escapeHtml(ticket.title)}</h1><p>Ticket ${ticket.id} • ${escapeHtml(ticket.status)} • opened ${escapeHtml(ticket.created_at)}</p>${entries}</body></html>`;
  return new AttachmentBuilder(Buffer.from(html, 'utf8'), { name: `${ticket.id}-transcript.html` });
}

async function closeTicket(
  interaction: ChatInputCommandInteraction<'cached'> | ButtonInteraction<'cached'>,
  context: BotContext,
  ticket: FeatureItem<TicketData>,
): Promise<void> {
  const member = interaction.member as GuildMember;
  if (interaction.user.id !== ticket.owner_id && !isTicketStaff(member, context)) {
    await deny(interaction, context, 'Only the ticket owner or support staff can close this ticket.');
    return;
  }
  const channel = interaction.guild.channels.cache.get(ticket.data.channelId);
  if (channel?.type !== ChannelType.GuildText) {
    await deny(interaction, context, 'The ticket channel no longer exists.');
    return;
  }
  await interaction.deferReply({ ephemeral: true });
  const file = await transcript(channel, ticket);
  context.v2.updateItem<TicketData>(ticket.id, {
    status: 'closed',
    data: { closedBy: interaction.user.id, lastActivityAt: new Date().toISOString() },
  });
  await channel.permissionOverwrites.edit(ticket.owner_id, { SendMessages: false });
  await channel.setName(truncate(`closed-${ticket.id}`, 100)).catch(() => null);
  await channel.send({
    embeds: [embed(context, '🔒 Ticket closed', `Closed by ${interaction.user}. The transcript is attached below.`)],
    components: [ticketButtons(ticket.id, true)],
    files: [file],
  });
  const logId = context.v2.getSetting(interaction.guildId, 'ticket.logChannelId', '');
  if (logId && logId !== channel.id) {
    const log = await context.client.channels.fetch(logId).catch(() => null);
    if (log?.type === ChannelType.GuildText) {
      const logFile = await transcript(channel, ticket);
      await log.send({ content: `Ticket **${ticket.id}** closed by ${interaction.user}.`, files: [logFile] });
    }
  }
  context.v2.audit(interaction.guildId, interaction.user.id, 'ticket.closed', ticket.title, ticket.id);
  await interaction.editReply({ embeds: [successEmbed(context, 'Ticket closed', 'The channel is archived and an HTML transcript was generated.')] });
}

const ticketCommand: BotCommand = {
  module: 'tickets',
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Open and manage private support tickets.')
    .addSubcommand((subcommand) => subcommand.setName('open').setDescription('Open a guided support ticket.'))
    .addSubcommand((subcommand) =>
      subcommand.setName('panel').setDescription('Post the ticket panel (server managers).')
        .addChannelOption((option) => option.setName('category').setDescription('Category for ticket channels.').addChannelTypes(ChannelType.GuildCategory))
        .addRoleOption((option) => option.setName('support_role').setDescription('Role that can access tickets.'))
        .addChannelOption((option) => option.setName('log_channel').setDescription('Transcript and stats log.').addChannelTypes(ChannelType.GuildText))
        .addIntegerOption((option) => option.setName('auto_close_hours').setDescription('Close inactive tickets after this many hours (0 disables).').setMinValue(0).setMaxValue(720)),
    )
    .addSubcommand((subcommand) => subcommand.setName('claim').setDescription('Claim the ticket in this channel.'))
    .addSubcommand((subcommand) => subcommand.setName('close').setDescription('Close this ticket and generate a transcript.'))
    .addSubcommand((subcommand) =>
      subcommand.setName('add').setDescription('Add a member to this ticket.')
        .addUserOption((option) => option.setName('member').setDescription('Member to add.').setRequired(true)),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('remove').setDescription('Remove a member from this ticket.')
        .addUserOption((option) => option.setName('member').setDescription('Member to remove.').setRequired(true)),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('priority').setDescription('Change ticket priority.')
        .addStringOption((option) => option.setName('level').setDescription('Priority.').setRequired(true).addChoices(
          { name: 'Low', value: 'low' }, { name: 'Normal', value: 'normal' }, { name: 'High', value: 'high' }, { name: 'Urgent', value: 'urgent' },
        )),
    )
    .addSubcommand((subcommand) => subcommand.setName('stats').setDescription('View ticket support statistics.')),
  async execute(interaction, context) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'open') {
      await interaction.showModal(ticketModal());
      return;
    }
    if (subcommand === 'panel') {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
        await deny(interaction, context, 'You need **Manage Server** to create a ticket panel.');
        return;
      }
      const category = interaction.options.getChannel('category');
      const supportRole = interaction.options.getRole('support_role');
      const logChannel = interaction.options.getChannel('log_channel');
      const autoClose = interaction.options.getInteger('auto_close_hours');
      if (category) context.v2.setSetting(interaction.guildId, 'ticket.categoryId', category.id);
      if (supportRole) context.v2.setSetting(interaction.guildId, 'ticket.supportRoleId', supportRole.id);
      if (logChannel) context.v2.setSetting(interaction.guildId, 'ticket.logChannelId', logChannel.id);
      if (autoClose !== null) context.v2.setSetting(interaction.guildId, 'ticket.autoCloseHours', autoClose);
      await interaction.channel?.send({
        embeds: [embed(context, '🎫 Developer Support', 'Open a private ticket for technical help, community issues, reports, partnerships, or project support. A short form helps the team route it correctly.')
          .setColor(context.config.accentColor)
          .addFields(...fields([
            ['Before opening', 'Include the goal, relevant error, expected behavior, and what you already tried. Never post tokens or secrets.'],
            ['Workflow', 'Open → staff claim → resolution → HTML transcript → rating'],
          ]))],
        components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId('v2:ticket:open').setLabel('Open ticket').setEmoji('🎫').setStyle(ButtonStyle.Primary),
        )],
      });
      context.v2.audit(interaction.guildId, interaction.user.id, 'ticket.panel_created', `Channel ${interaction.channelId}`);
      await interaction.reply({ embeds: [successEmbed(context, 'Ticket panel posted', 'Members can now open guided private tickets.')], ephemeral: true });
      return;
    }
    if (subcommand === 'stats') {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
        await deny(interaction, context, 'You need **Manage Server** to view support statistics.');
        return;
      }
      const all = context.v2.listItems<TicketData>({ guildId: interaction.guildId, type: 'ticket', limit: 100 });
      const closed = all.filter((item) => item.status === 'closed');
      const ratings = closed.map((item) => Number(item.data.rating ?? 0)).filter((value) => value > 0);
      const average = ratings.length ? (ratings.reduce((sum, value) => sum + value, 0) / ratings.length).toFixed(1) : '—';
      await interaction.reply({ embeds: [embed(context, '🎫 Ticket statistics').addFields(...fields([
        ['Open', String(all.filter((item) => item.status === 'open').length), true],
        ['Closed', String(closed.length), true],
        ['Average rating', `${average}${average === '—' ? '' : '/5'}`, true],
        ['Claimed', String(all.filter((item) => Boolean(item.data.claimedBy)).length), true],
      ]))], ephemeral: true });
      return;
    }
    const ticket = ticketForChannel(context, interaction.guildId, interaction.channelId);
    if (!ticket) {
      await deny(interaction, context, 'This channel is not a DevForge ticket.');
      return;
    }
    if (subcommand === 'close') {
      await closeTicket(interaction, context, ticket);
      return;
    }
    const member = interaction.member as GuildMember;
    if (!isTicketStaff(member, context)) {
      await deny(interaction, context, 'Only configured support staff can perform this action.');
      return;
    }
    const channel = interaction.guild.channels.cache.get(ticket.data.channelId);
    if (channel?.type !== ChannelType.GuildText) {
      await deny(interaction, context, 'The ticket channel no longer exists.');
      return;
    }
    if (subcommand === 'claim') {
      context.v2.updateItem<TicketData>(ticket.id, { data: { claimedBy: interaction.user.id } });
      context.v2.setMember({ itemId: ticket.id, userId: interaction.user.id, role: 'agent' });
      await interaction.reply({ embeds: [successEmbed(context, 'Ticket claimed', `${interaction.user} is now handling this ticket.`)] });
      return;
    }
    if (subcommand === 'priority') {
      const priority = interaction.options.getString('level', true);
      context.v2.updateItem<TicketData>(ticket.id, { data: { priority } });
      await interaction.reply({ embeds: [successEmbed(context, 'Priority updated', `Ticket priority is now **${priority}**.`)] });
      return;
    }
    const target = interaction.options.getUser('member', true);
    if (subcommand === 'add') {
      await channel.permissionOverwrites.edit(target.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
      context.v2.setMember({ itemId: ticket.id, userId: target.id, role: 'guest' });
      await interaction.reply({ embeds: [successEmbed(context, 'Member added', `${target} can now access this ticket.`)] });
    } else {
      await channel.permissionOverwrites.delete(target.id);
      context.v2.removeMember(ticket.id, target.id);
      await interaction.reply({ embeds: [successEmbed(context, 'Member removed', `${target} can no longer access this ticket.`)] });
    }
  },
};

async function createTechRoles(interaction: ChatInputCommandInteraction<'cached'>, context: BotContext): Promise<Role[]> {
  const names = ['JavaScript', 'TypeScript', 'Python', 'Java', 'C#', 'C++', 'Rust', 'Go', 'PHP', 'Mobile Dev', 'DevOps', 'Cybersecurity'];
  const roles: Role[] = [];
  for (const name of names) {
    let role = interaction.guild.roles.cache.find((candidate) => candidate.name.toLowerCase() === name.toLowerCase());
    if (!role) {
      role = await interaction.guild.roles.create({ name, reason: 'DevForge onboarding technology role', mentionable: false });
    }
    roles.push(role);
  }
  context.v2.setSetting(interaction.guildId, 'onboarding.techRoles', roles.map((role) => ({ id: role.id, name: role.name })));
  return roles;
}

const onboardingCommand: BotCommand = {
  module: 'onboarding',
  data: new SlashCommandBuilder()
    .setName('onboarding')
    .setDescription('Interactive developer onboarding and verification.')
    .addSubcommand((subcommand) => subcommand.setName('setup').setDescription('Create onboarding roles and post the interactive panel.'))
    .addSubcommand((subcommand) => subcommand.setName('start').setDescription('Start or resume your onboarding.'))
    .addSubcommand((subcommand) => subcommand.setName('status').setDescription('View your onboarding progress.')),
  async execute(interaction, context) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'setup') {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
        await deny(interaction, context, 'You need **Manage Server** to configure onboarding.');
        return;
      }
      await interaction.deferReply({ ephemeral: true });
      try {
        const roles = await createTechRoles(interaction, context);
        await interaction.channel?.send({
          embeds: [embed(context, '👋 Start your DevForge journey', 'Accept the community rules, choose your technology stack, and answer a few questions to create your initial developer identity.')
            .setColor(context.config.accentColor)
            .addFields(...fields([
              ['1 • Rules', 'Be constructive, protect private data, credit authors, and critique code—not people.'],
              ['2 • Stack', `${roles.length} technology roles are available.`],
              ['3 • Profile', 'Tell the community your experience, goals, timezone, and collaboration interests.'],
            ]))],
          components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('v2:onboard:verify').setLabel('Accept rules').setEmoji('✅').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('v2:onboard:stack').setLabel('Choose stack').setEmoji('🧑‍💻').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('v2:onboard:profile').setLabel('Initial profile').setEmoji('📝').setStyle(ButtonStyle.Secondary),
          )],
        });
        await interaction.editReply({ embeds: [successEmbed(context, 'Onboarding ready', 'The interactive onboarding panel and technology roles were created.')] });
      } catch {
        await interaction.editReply({ embeds: [embed(context, 'Onboarding setup failed', 'Give the bot **Manage Roles**, keep its role above the technology roles, and try again.').setColor(0xef4444)] });
      }
      return;
    }
    if (subcommand === 'start') {
      await interaction.reply({
        embeds: [embed(context, '👋 Your onboarding', 'Complete the three steps below. Responses are private except for roles added to your profile.')],
        components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId('v2:onboard:verify').setLabel('Accept rules').setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId('v2:onboard:stack').setLabel('Choose stack').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('v2:onboard:profile').setLabel('Initial profile').setStyle(ButtonStyle.Secondary),
        )],
        ephemeral: true,
      });
      return;
    }
    const verified = context.v2.getPreference(interaction.guildId, interaction.user.id, 'onboarding.verified', false);
    const stack = context.v2.getPreference<string[]>(interaction.guildId, interaction.user.id, 'onboarding.stack', []);
    const profile = context.v2.getPreference(interaction.guildId, interaction.user.id, 'onboarding.profileComplete', false);
    await interaction.reply({ embeds: [embed(context, '👋 Onboarding status').addFields(...fields([
      ['Rules accepted', verified ? '✅ Complete' : '❌ Pending', true],
      ['Technology stack', stack.length ? `✅ ${stack.join(', ')}` : '❌ Pending', true],
      ['Initial profile', profile ? '✅ Complete' : '❌ Pending', true],
    ]))], ephemeral: true });
  },
};

const roleMenuCommand: BotCommand = {
  module: 'roles',
  data: new SlashCommandBuilder()
    .setName('rolemenu')
    .setDescription('Create self-service role menus.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand((subcommand) =>
      subcommand.setName('create').setDescription('Create a selectable role menu with up to five roles.')
        .addStringOption((option) => option.setName('title').setDescription('Panel title.').setRequired(true).setMaxLength(100))
        .addRoleOption((option) => option.setName('role1').setDescription('First role.').setRequired(true))
        .addRoleOption((option) => option.setName('role2').setDescription('Second role.'))
        .addRoleOption((option) => option.setName('role3').setDescription('Third role.'))
        .addRoleOption((option) => option.setName('role4').setDescription('Fourth role.'))
        .addRoleOption((option) => option.setName('role5').setDescription('Fifth role.')),
    )
    .addSubcommand((subcommand) => subcommand.setName('list').setDescription('List role panels configured in this server.')),
  async execute(interaction, context) {
    if (interaction.options.getSubcommand() === 'list') {
      const panels = context.v2.listItems({ guildId: interaction.guildId, type: 'role_panel', status: 'active', limit: 20 });
      await interaction.reply({ embeds: [embed(context, '🎭 Role menus', panels.length
        ? panels.map((panel) => `**${panel.id}** • ${panel.title} • ${relativeTimestamp(panel.created_at)}`).join('\n')
        : 'No role menus have been created.')], ephemeral: true });
      return;
    }
    const title = interaction.options.getString('title', true);
    const roles = ['role1', 'role2', 'role3', 'role4', 'role5']
      .map((name) => interaction.options.getRole(name))
      .filter((role): role is Role => Boolean(role));
    const botMember = interaction.guild.members.me;
    if (!botMember || roles.some((role) => role.managed || role.position >= botMember.roles.highest.position)) {
      await deny(interaction, context, 'Every selected role must be below the bot role and must not be integration-managed.');
      return;
    }
    const panel = context.v2.createItem({
      guildId: interaction.guildId,
      type: 'role_panel',
      ownerId: interaction.user.id,
      title,
      data: { roles: roles.map((role) => ({ id: role.id, name: role.name })) },
      idPrefix: 'roles',
    });
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`v2:roles:${panel.id}`)
      .setPlaceholder('Choose your roles')
      .setMinValues(0)
      .setMaxValues(roles.length)
      .addOptions(roles.map((role) => new StringSelectMenuOptionBuilder().setLabel(role.name).setValue(role.id)));
    await interaction.channel?.send({
      embeds: [embed(context, `🎭 ${title}`, 'Select every role you want. Reopen the menu at any time to update your choices.')],
      components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)],
    });
    await interaction.reply({ embeds: [successEmbed(context, 'Role menu created', `Panel **${panel.id}** is ready.`)], ephemeral: true });
  },
};

export const v2WorkspaceComponents: ComponentHandler[] = [
  {
    prefix: 'v2:ticket:open',
    async execute(interaction) {
      await interaction.showModal(ticketModal());
    },
  },
  {
    prefix: 'v2:ticket:claim:',
    async execute(interaction, context) {
      if (!interaction.inCachedGuild()) return;
      const ticket = context.v2.getItem<TicketData>(interaction.customId.split(':')[3] ?? '', 'ticket');
      if (!ticket || ticket.guild_id !== interaction.guildId) return;
      const member = interaction.member as GuildMember;
      if (!isTicketStaff(member, context)) {
        await deny(interaction, context, 'Only support staff can claim tickets.');
        return;
      }
      context.v2.updateItem<TicketData>(ticket.id, { data: { claimedBy: interaction.user.id } });
      context.v2.setMember({ itemId: ticket.id, userId: interaction.user.id, role: 'agent' });
      await interaction.reply({ embeds: [successEmbed(context, 'Ticket claimed', `${interaction.user} is handling this ticket.`)] });
    },
  },
  {
    prefix: 'v2:ticket:priority:',
    async execute(interaction, context) {
      if (!interaction.inCachedGuild()) return;
      const ticket = context.v2.getItem<TicketData>(interaction.customId.split(':')[3] ?? '', 'ticket');
      if (!ticket || ticket.guild_id !== interaction.guildId) return;
      const levels = ['low', 'normal', 'high', 'urgent'];
      const current = Math.max(0, levels.indexOf(ticket.data.priority));
      const priority = levels[Math.min(levels.length - 1, current + 1)]!;
      context.v2.updateItem<TicketData>(ticket.id, { data: { priority } });
      await interaction.reply({ embeds: [successEmbed(context, 'Priority raised', `Ticket priority is now **${priority}**.`)] });
    },
  },
  {
    prefix: 'v2:ticket:close:',
    async execute(interaction, context) {
      if (!interaction.inCachedGuild()) return;
      const ticket = context.v2.getItem<TicketData>(interaction.customId.split(':')[3] ?? '', 'ticket');
      if (!ticket || ticket.guild_id !== interaction.guildId) return;
      await closeTicket(interaction, context, ticket);
    },
  },
  {
    prefix: 'v2:ticket:rate:',
    async execute(interaction, context) {
      if (!interaction.inCachedGuild()) return;
      const [, , , id, ratingText] = interaction.customId.split(':');
      const ticket = context.v2.getItem<TicketData>(id ?? '', 'ticket');
      if (!ticket || ticket.guild_id !== interaction.guildId || ticket.owner_id !== interaction.user.id) {
        await deny(interaction, context, 'Only the ticket owner can submit this rating.');
        return;
      }
      const rating = Number(ratingText);
      context.v2.updateItem<TicketData>(ticket.id, { data: { rating } });
      await interaction.reply({ embeds: [successEmbed(context, 'Thank you', `Your **${rating}/5** rating was saved.`)], ephemeral: true });
    },
  },
  {
    prefix: 'v2:onboard:verify',
    async execute(interaction, context) {
      if (!interaction.inCachedGuild()) return;
      const settings = context.db.getSettings(interaction.guildId);
      const member = interaction.member as GuildMember;
      if (settings.verified_role_id) await member.roles.add(settings.verified_role_id, 'DevForge onboarding verification').catch(() => null);
      context.v2.setPreference(interaction.guildId, interaction.user.id, 'onboarding.verified', true);
      context.v2.updateStreak(interaction.guildId, interaction.user.id, 'community');
      await interaction.reply({ embeds: [successEmbed(context, 'Rules accepted', 'Verification is complete. Next, choose your technology stack.')], ephemeral: true });
    },
  },
  {
    prefix: 'v2:onboard:stack',
    async execute(interaction, context) {
      if (!interaction.inCachedGuild()) return;
      const stored = context.v2.getSetting<Array<{ id: string; name: string }>>(interaction.guildId, 'onboarding.techRoles', []);
      const roles = stored.filter((item) => interaction.guild.roles.cache.has(item.id)).slice(0, 25);
      if (!roles.length) {
        await deny(interaction, context, 'Technology roles are not configured yet. Ask a manager to run `/onboarding setup`.');
        return;
      }
      const menu = new StringSelectMenuBuilder()
        .setCustomId('v2:onboard:stack-select')
        .setPlaceholder('Select your technologies')
        .setMinValues(1)
        .setMaxValues(Math.min(roles.length, 10))
        .addOptions(roles.map((role) => new StringSelectMenuOptionBuilder().setLabel(role.name).setValue(role.id)));
      await interaction.reply({ content: 'Choose up to ten technologies:', components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)], ephemeral: true });
    },
  },
  {
    prefix: 'v2:onboard:profile',
    async execute(interaction) {
      const modal = new ModalBuilder().setCustomId('v2:onboard:profile-submit').setTitle('Your developer starting point').addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('experience').setLabel('Experience level').setPlaceholder('Beginner, intermediate, senior...').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(50)),
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('goals').setLabel('What do you want to build or learn?').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500)),
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('timezone').setLabel('Timezone').setPlaceholder('UTC-3').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(50)),
        new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('availability').setLabel('Availability').setPlaceholder('Evenings, weekends, open to mentoring...').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)),
      );
      await interaction.showModal(modal);
    },
  },
];

export const v2WorkspaceModals: ModalHandler[] = [
  {
    prefix: 'v2:ticket:create',
    async execute(interaction: ModalSubmitInteraction<'cached'>, context) {
      const open = context.v2.listItems<TicketData>({ guildId: interaction.guildId, type: 'ticket', status: 'open', ownerId: interaction.user.id, limit: 5 });
      if (open.length >= 3) {
        await deny(interaction, context, 'You already have three open tickets. Close one before opening another.');
        return;
      }
      await interaction.deferReply({ ephemeral: true });
      const category = interaction.fields.getTextInputValue('category').trim();
      const subject = interaction.fields.getTextInputValue('subject').trim();
      const details = interaction.fields.getTextInputValue('details').trim();
      const priorityInput = interaction.fields.getTextInputValue('priority').trim().toLowerCase();
      const priority = ['low', 'normal', 'high', 'urgent'].includes(priorityInput) ? priorityInput : 'normal';
      const parentId = context.v2.getSetting(interaction.guildId, 'ticket.categoryId', '');
      const supportRoleId = context.v2.getSetting(interaction.guildId, 'ticket.supportRoleId', '');
      const permissionOverwrites = [
        { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
        { id: interaction.guild.members.me!.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] },
      ];
      if (supportRoleId && interaction.guild.roles.cache.has(supportRoleId)) {
        permissionOverwrites.push({ id: supportRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
      }
      const channel = await interaction.guild.channels.create({
        name: truncate(`ticket-${interaction.user.username}`, 100),
        type: ChannelType.GuildText,
        ...(parentId && interaction.guild.channels.cache.has(parentId) ? { parent: parentId } : {}),
        topic: `DevForge ticket opened by ${interaction.user.tag}`,
        permissionOverwrites,
        reason: 'DevForge support ticket',
      });
      const now = new Date().toISOString();
      const ticket = context.v2.createItem<TicketData>({
        guildId: interaction.guildId,
        type: 'ticket',
        ownerId: interaction.user.id,
        title: subject,
        status: 'open',
        data: { channelId: channel.id, category, subject, details, priority, claimedBy: null, closedBy: null, rating: null, lastActivityAt: now },
        idPrefix: 'tkt',
      });
      context.v2.setMember({ itemId: ticket.id, userId: interaction.user.id, role: 'requester' });
      await channel.send({
        content: `${interaction.user}${supportRoleId ? ` <@&${supportRoleId}>` : ''}`,
        embeds: [embed(context, `🎫 ${subject}`, details).addFields(...fields([
          ['Ticket', `\`${ticket.id}\``, true], ['Category', category, true], ['Priority', priority, true], ['Requester', `${interaction.user}`, true],
        ]))],
        components: [ticketButtons(ticket.id)],
        allowedMentions: { users: [interaction.user.id], roles: supportRoleId ? [supportRoleId] : [] },
      });
      context.v2.audit(interaction.guildId, interaction.user.id, 'ticket.opened', subject, ticket.id);
      await interaction.editReply({ embeds: [successEmbed(context, 'Ticket opened', `Your private ticket is ready: ${channel}`)] });
    },
  },
  {
    prefix: 'v2:onboard:profile-submit',
    async execute(interaction, context) {
      const experience = interaction.fields.getTextInputValue('experience').trim();
      const goals = interaction.fields.getTextInputValue('goals').trim();
      const timezone = interaction.fields.getTextInputValue('timezone').trim();
      const availability = interaction.fields.getTextInputValue('availability').trim();
      context.v2.setPreference(interaction.guildId, interaction.user.id, 'profile.experience', experience);
      context.v2.setPreference(interaction.guildId, interaction.user.id, 'profile.goals', goals);
      context.v2.setPreference(interaction.guildId, interaction.user.id, 'profile.timezone', timezone);
      context.v2.setPreference(interaction.guildId, interaction.user.id, 'profile.availability', availability);
      context.v2.setPreference(interaction.guildId, interaction.user.id, 'onboarding.profileComplete', true);
      await interaction.reply({ embeds: [successEmbed(context, 'Initial profile saved', 'Your onboarding profile is ready. Use `/profile set` for the complete public profile.')], ephemeral: true });
    },
  },
];

export const v2WorkspaceSelects: SelectHandler[] = [
  {
    prefix: 'v2:onboard:stack-select',
    async execute(interaction, context) {
      const stored = context.v2.getSetting<Array<{ id: string; name: string }>>(interaction.guildId, 'onboarding.techRoles', []);
      const allowedIds = new Set(stored.map((item) => item.id));
      const selected = interaction.values.filter((id) => allowedIds.has(id));
      const member = interaction.member as GuildMember;
      const managedRoles = stored.map((item) => item.id).filter((id) => member.roles.cache.has(id));
      if (managedRoles.length) await member.roles.remove(managedRoles, 'Updated DevForge onboarding stack').catch(() => null);
      if (selected.length) await member.roles.add(selected, 'Updated DevForge onboarding stack');
      const names = stored.filter((item) => selected.includes(item.id)).map((item) => item.name);
      context.v2.setPreference(interaction.guildId, interaction.user.id, 'onboarding.stack', names);
      await interaction.update({ content: `Stack updated: **${names.join(', ')}**`, components: [] });
    },
  },
  {
    prefix: 'v2:roles:',
    async execute(interaction, context) {
      const panel = context.v2.getItem(interaction.customId.split(':')[2] ?? '', 'role_panel');
      if (!panel || panel.guild_id !== interaction.guildId) {
        await interaction.reply({ content: 'This role panel is no longer available.', ephemeral: true });
        return;
      }
      const definitions = Array.isArray(panel.data['roles'])
        ? panel.data['roles'].filter((item): item is { id: string; name: string } => Boolean(item && typeof item === 'object' && !Array.isArray(item) && typeof item['id'] === 'string' && typeof item['name'] === 'string'))
        : [];
      const roleIds = definitions.map((item) => item.id);
      const member = interaction.member as GuildMember;
      const remove = roleIds.filter((id) => member.roles.cache.has(id) && !interaction.values.includes(id));
      const add = interaction.values.filter((id) => roleIds.includes(id) && !member.roles.cache.has(id));
      if (remove.length) await member.roles.remove(remove, 'DevForge self-role menu');
      if (add.length) await member.roles.add(add, 'DevForge self-role menu');
      const names = definitions.filter((item) => interaction.values.includes(item.id)).map((item) => item.name);
      await interaction.reply({ embeds: [successEmbed(context, 'Roles updated', names.length ? `Selected: **${names.join(', ')}**` : 'All roles from this panel were removed.')], ephemeral: true });
    },
  },
];

export const v2WorkspaceCommands: BotCommand[] = [ticketCommand, onboardingCommand, roleMenuCommand];

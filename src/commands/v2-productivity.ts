import { createHash, randomUUID } from 'node:crypto';
import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type GuildMember,
  type Role,
} from 'discord.js';
import { embed, fields, successEmbed } from '../theme.js';
import type { BotCommand } from '../types.js';
import { deny, relativeTimestamp, safeCodeBlock, truncate } from '../utils.js';
import { MODULES } from '../modules/registry.js';
import type { JsonObject } from '../v2/store.js';

const creditsCommand: BotCommand = {
  module: 'credits',
  data: new SlashCommandBuilder()
    .setName('credits')
    .setDescription('View internal community credits and activity.')
    .addSubcommand((subcommand) => subcommand.setName('balance').setDescription('View a member balance.').addUserOption((option) => option.setName('member').setDescription('Member to inspect.')))
    .addSubcommand((subcommand) => subcommand.setName('history').setDescription('View your recent credit transactions.'))
    .addSubcommand((subcommand) => subcommand.setName('leaderboard').setDescription('View the richest community wallets.'))
    .addSubcommand((subcommand) =>
      subcommand.setName('grant').setDescription('Grant or remove credits (server managers).')
        .addUserOption((option) => option.setName('member').setDescription('Target member.').setRequired(true))
        .addIntegerOption((option) => option.setName('amount').setDescription('Positive to grant, negative to remove.').setRequired(true).setMinValue(-100000).setMaxValue(100000))
        .addStringOption((option) => option.setName('reason').setDescription('Audit reason.').setRequired(true).setMaxLength(200)),
    ),
  async execute(interaction, context) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'balance') {
      const user = interaction.options.getUser('member') ?? interaction.user;
      const wallet = context.v2.wallet(interaction.guildId, user.id);
      await interaction.reply({ embeds: [embed(context, `💳 ${user.displayName}'s wallet`).addFields(...fields([
        ['Balance', `${wallet.credits} credits`, true], ['Lifetime earned', String(wallet.earned), true], ['Lifetime spent', String(wallet.spent), true],
      ]))], ephemeral: user.id === interaction.user.id });
      return;
    }
    if (subcommand === 'history') {
      const entries = context.v2.ledger(interaction.guildId, interaction.user.id, 15);
      const body = entries.length ? entries.map((entry) => `${entry.amount >= 0 ? '➕' : '➖'} **${Math.abs(entry.amount)}** • ${entry.reason} • ${relativeTimestamp(entry.created_at)}`).join('\n') : 'No transactions yet.';
      await interaction.reply({ embeds: [embed(context, '💳 Credit history', body)], ephemeral: true });
      return;
    }
    if (subcommand === 'leaderboard') {
      const rows = context.v2.creditLeaderboard(interaction.guildId);
      await interaction.reply({ embeds: [embed(context, '💳 Credit leaderboard', rows.length ? rows.map((row, index) => `**${index + 1}.** <@${row.user_id}> — ${row.credits}`).join('\n') : 'No wallets have credits yet.')] });
      return;
    }
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
      await deny(interaction, context, 'You need **Manage Server** to adjust credits.');
      return;
    }
    const user = interaction.options.getUser('member', true);
    const amount = interaction.options.getInteger('amount', true);
    const reason = interaction.options.getString('reason', true);
    try {
      const balance = context.v2.changeCredits(interaction.guildId, user.id, amount, reason, `staff:${interaction.user.id}`);
      context.v2.audit(interaction.guildId, interaction.user.id, 'credits.adjusted', `${amount}: ${reason}`, user.id);
      await interaction.reply({ embeds: [successEmbed(context, 'Credits adjusted', `${user} now has **${balance} credits**.`)], ephemeral: true });
    } catch {
      await deny(interaction, context, 'That adjustment would make the balance negative.');
    }
  },
};

interface RewardData extends JsonObject {
  description: string;
  roleId: string;
  cost: number;
  stock: number;
  sold: number;
}

const shopCommand: BotCommand = {
  module: 'shop',
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Exchange internal credits for community roles and cosmetics.')
    .addSubcommand((subcommand) => subcommand.setName('list').setDescription('Browse available rewards.'))
    .addSubcommand((subcommand) => subcommand.setName('buy').setDescription('Purchase a reward.').addStringOption((option) => option.setName('id').setDescription('Reward ID.').setRequired(true)))
    .addSubcommand((subcommand) =>
      subcommand.setName('add').setDescription('Add a reward (server managers).')
        .addStringOption((option) => option.setName('name').setDescription('Reward name.').setRequired(true).setMaxLength(100))
        .addStringOption((option) => option.setName('description').setDescription('What it grants.').setRequired(true).setMaxLength(300))
        .addRoleOption((option) => option.setName('role').setDescription('Role granted by purchase.').setRequired(true))
        .addIntegerOption((option) => option.setName('cost').setDescription('Credit cost.').setRequired(true).setMinValue(1).setMaxValue(100000))
        .addIntegerOption((option) => option.setName('stock').setDescription('0 means unlimited.').setRequired(true).setMinValue(0).setMaxValue(100000)),
    )
    .addSubcommand((subcommand) => subcommand.setName('remove').setDescription('Remove a reward (server managers).').addStringOption((option) => option.setName('id').setDescription('Reward ID.').setRequired(true))),
  async execute(interaction, context) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'list') {
      const items = context.v2.listItems<RewardData>({ guildId: interaction.guildId, type: 'shop_reward', status: 'active', limit: 50 });
      const body = items.length ? items.map((item) => `**${item.id} • ${item.title}** — ${item.data.cost} credits\n${item.data.description} • stock: ${item.data.stock === 0 ? 'unlimited' : Math.max(0, item.data.stock - item.data.sold)}`).join('\n\n') : 'The reward shop is empty.';
      await interaction.reply({ embeds: [embed(context, '🛒 Reward shop', body)] });
      return;
    }
    if (subcommand === 'buy') {
      const id = interaction.options.getString('id', true);
      const item = context.v2.getItem<RewardData>(id, 'shop_reward');
      if (!item || item.guild_id !== interaction.guildId || item.status !== 'active') {
        await deny(interaction, context, 'Reward not found or unavailable.');
        return;
      }
      if (item.data.stock > 0 && item.data.sold >= item.data.stock) {
        await deny(interaction, context, 'This reward is out of stock.');
        return;
      }
      const role = interaction.guild.roles.cache.get(item.data.roleId);
      const member = interaction.member as GuildMember;
      if (!role || role.managed || !role.editable) {
        await deny(interaction, context, 'The reward role is unavailable or above the bot role. Ask a manager to repair the item.');
        return;
      }
      if (member.roles.cache.has(role.id)) {
        await deny(interaction, context, 'You already own this reward role.');
        return;
      }
      try {
        context.v2.changeCredits(interaction.guildId, interaction.user.id, -item.data.cost, `Shop: ${item.title}`, item.id);
      } catch {
        await deny(interaction, context, `You need **${item.data.cost} credits** to buy this reward.`);
        return;
      }
      try {
        await member.roles.add(role, `Purchased DevForge reward ${item.id}`);
      } catch (error) {
        context.v2.changeCredits(interaction.guildId, interaction.user.id, item.data.cost, `Refund: ${item.title}`, item.id);
        throw error;
      }
      context.v2.updateItem<RewardData>(item.id, { data: { sold: item.data.sold + 1 } });
      await interaction.reply({ embeds: [successEmbed(context, 'Reward purchased', `You received ${role} for **${item.data.cost} credits**.`)], ephemeral: true });
      return;
    }
    if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild)) {
      await deny(interaction, context, 'You need **Manage Server** to edit rewards.');
      return;
    }
    if (subcommand === 'add') {
      const role = interaction.options.getRole('role', true) as Role;
      if (role.managed || !role.editable) {
        await deny(interaction, context, 'The reward role must be editable and below the bot role.');
        return;
      }
      const item = context.v2.createItem<RewardData>({ guildId: interaction.guildId, type: 'shop_reward', ownerId: interaction.user.id, title: interaction.options.getString('name', true), data: {
        description: interaction.options.getString('description', true), roleId: role.id, cost: interaction.options.getInteger('cost', true), stock: interaction.options.getInteger('stock', true), sold: 0,
      }, idPrefix: 'shop' });
      await interaction.reply({ embeds: [successEmbed(context, 'Reward added', `**${item.title}** is available as \`${item.id}\`.`)], ephemeral: true });
      return;
    }
    const id = interaction.options.getString('id', true);
    const item = context.v2.getItem(id, 'shop_reward');
    if (!item || item.guild_id !== interaction.guildId) {
      await deny(interaction, context, 'Reward not found.');
      return;
    }
    context.v2.updateItem(id, { status: 'disabled' });
    await interaction.reply({ embeds: [successEmbed(context, 'Reward removed', `**${id}** is no longer available.`)], ephemeral: true });
  },
};

const modulesCommand: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('modules')
    .setDescription('Enable or disable DevForge modules for this server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) => subcommand.setName('list').setDescription('View every module state.'))
    .addSubcommand((subcommand) =>
      subcommand.setName('toggle').setDescription('Enable or disable a module.')
        .addStringOption((option) => option.setName('module').setDescription('Module name from /modules list.').setRequired(true).setMaxLength(50))
        .addBooleanOption((option) => option.setName('enabled').setDescription('New state.').setRequired(true)),
    ),
  async execute(interaction, context) {
    if (interaction.options.getSubcommand() === 'list') {
      const body = MODULES.map((module) => `${context.v2.isModuleEnabled(interaction.guildId, module) ? '✅' : '❌'} **${module}**`).join('\n');
      await interaction.reply({ embeds: [embed(context, '🧩 DevForge modules', body)], ephemeral: true });
      return;
    }
    const module = interaction.options.getString('module', true).toLowerCase();
    if (!MODULES.includes(module as (typeof MODULES)[number])) {
      await deny(interaction, context, `Unknown module. Use \`/modules list\` and copy one of the displayed names.`);
      return;
    }
    if (['permissions', 'diagnostics'].includes(module) && !interaction.options.getBoolean('enabled', true)) {
      await deny(interaction, context, 'The permissions and diagnostics safety modules cannot be disabled.');
      return;
    }
    const enabled = interaction.options.getBoolean('enabled', true);
    context.v2.setModule(interaction.guildId, module, enabled);
    context.v2.audit(interaction.guildId, interaction.user.id, 'module.toggled', `${module}: ${enabled}`);
    await interaction.reply({ embeds: [successEmbed(context, 'Module updated', `**${module}** is now **${enabled ? 'enabled' : 'disabled'}**.`)], ephemeral: true });
  },
};

const permissionsCommand: BotCommand = {
  module: 'permissions',
  data: new SlashCommandBuilder()
    .setName('permissions')
    .setDescription('Configure which roles can use each command.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((subcommand) =>
      subcommand.setName('set').setDescription('Add an allow or deny rule.')
        .addStringOption((option) => option.setName('command').setDescription('Command name without /.').setRequired(true).setMaxLength(32))
        .addRoleOption((option) => option.setName('role').setDescription('Role affected.').setRequired(true))
        .addBooleanOption((option) => option.setName('allowed').setDescription('Allow or deny.').setRequired(true)),
    )
    .addSubcommand((subcommand) => subcommand.setName('list').setDescription('View permission rules.').addStringOption((option) => option.setName('command').setDescription('Optional command filter.').setMaxLength(32)))
    .addSubcommand((subcommand) =>
      subcommand.setName('remove').setDescription('Remove a permission rule.')
        .addStringOption((option) => option.setName('command').setDescription('Command name.').setRequired(true).setMaxLength(32))
        .addRoleOption((option) => option.setName('role').setDescription('Role in the rule.').setRequired(true)),
    ),
  async execute(interaction, context) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'list') {
      const command = interaction.options.getString('command')?.replace(/^\//, '').toLowerCase();
      const rules = context.v2.permissions(interaction.guildId, command);
      const body = rules.length ? rules.map((rule) => `${rule.allowed ? '✅' : '❌'} \`/${rule.command}\` • <@&${rule.role_id}>`).join('\n') : 'No custom rules; Discord and command defaults apply.';
      await interaction.reply({ embeds: [embed(context, '🔐 Permission matrix', body)], ephemeral: true });
      return;
    }
    const command = interaction.options.getString('command', true).replace(/^\//, '').toLowerCase();
    const role = interaction.options.getRole('role', true);
    if (!context.commands.has(command)) {
      await deny(interaction, context, 'That command is not registered in this version of DevForge.');
      return;
    }
    if (subcommand === 'set') {
      const allowed = interaction.options.getBoolean('allowed', true);
      context.v2.setPermission(interaction.guildId, command, role.id, allowed);
      context.v2.audit(interaction.guildId, interaction.user.id, 'permissions.set', `${command}:${role.id}:${allowed}`);
      await interaction.reply({ embeds: [successEmbed(context, 'Permission rule saved', `${role} is now **${allowed ? 'allowed' : 'denied'}** for \`/${command}\`.`)], ephemeral: true });
    } else {
      context.v2.removePermission(interaction.guildId, command, role.id);
      await interaction.reply({ embeds: [successEmbed(context, 'Permission rule removed', `The custom rule for ${role} and \`/${command}\` was removed.`)], ephemeral: true });
    }
  },
};

const notificationsCommand: BotCommand = {
  module: 'notifications',
  data: new SlashCommandBuilder()
    .setName('notifications')
    .setDescription('Choose which optional notifications you receive.')
    .addSubcommand((subcommand) => subcommand.setName('view').setDescription('View your notification preferences.'))
    .addSubcommand((subcommand) =>
      subcommand.setName('set').setDescription('Update one preference.')
        .addStringOption((option) => option.setName('type').setDescription('Notification type.').setRequired(true).addChoices(
          { name: 'Events', value: 'events' }, { name: 'Releases', value: 'releases' }, { name: 'Mentoring', value: 'mentoring' }, { name: 'Uptime', value: 'uptime' }, { name: 'Digests', value: 'digests' }, { name: 'Projects', value: 'projects' },
        ))
        .addBooleanOption((option) => option.setName('enabled').setDescription('Receive this type.').setRequired(true)),
    ),
  async execute(interaction, context) {
    const types = ['events', 'releases', 'mentoring', 'uptime', 'digests', 'projects'];
    if (interaction.options.getSubcommand() === 'view') {
      const body = types.map((type) => `${context.v2.getPreference(interaction.guildId, interaction.user.id, `notify.${type}`, true) ? '✅' : '❌'} **${type}**`).join('\n');
      await interaction.reply({ embeds: [embed(context, '🔔 Notification center', body)], ephemeral: true });
      return;
    }
    const type = interaction.options.getString('type', true);
    const enabled = interaction.options.getBoolean('enabled', true);
    context.v2.setPreference(interaction.guildId, interaction.user.id, `notify.${type}`, enabled);
    await interaction.reply({ embeds: [successEmbed(context, 'Preference updated', `**${type}** notifications are ${enabled ? 'enabled' : 'disabled'}.`)], ephemeral: true });
  },
};

const auditCommand: BotCommand = {
  module: 'audit',
  data: new SlashCommandBuilder()
    .setName('audit')
    .setDescription('View important DevForge and staff actions.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ViewAuditLog)
    .addStringOption((option) => option.setName('action').setDescription('Optional action filter.').setMaxLength(50))
    .addIntegerOption((option) => option.setName('limit').setDescription('Entries to show.').setMinValue(1).setMaxValue(25)),
  async execute(interaction, context) {
    const entries = context.v2.auditLog(interaction.guildId, interaction.options.getInteger('limit') ?? 15, interaction.options.getString('action') ?? undefined);
    const body = entries.length ? entries.map((entry) => `**${entry.action}** • <@${entry.actor_id}> • ${relativeTimestamp(entry.created_at)}\n${truncate(entry.details, 220)}${entry.target ? ` • target \`${entry.target}\`` : ''}`).join('\n\n') : 'No matching audit entries.';
    await interaction.reply({ embeds: [embed(context, '📝 DevForge audit log', body)], ephemeral: true });
  },
};

const healthCommand: BotCommand = {
  module: 'diagnostics',
  data: new SlashCommandBuilder().setName('health').setDescription('View bot, database, shard, and integration health.'),
  async execute(interaction, context) {
    const database = context.v2.healthCheck();
    const memory = process.memoryUsage();
    const github = context.config.githubWebhookSecret ? 'Configured' : 'Not configured';
    await interaction.reply({ embeds: [embed(context, '🩺 DevForge health').setColor(database.ok ? 0x22c55e : 0xef4444).addFields(...fields([
      ['Discord latency', `${context.client.ws.ping} ms`, true],
      ['Interaction latency', `${Date.now() - interaction.createdTimestamp} ms`, true],
      ['Uptime', `${Math.floor((Date.now() - context.runtime.startedAt) / 1000)} seconds`, true],
      ['Memory', `${Math.round(memory.rss / 1024 / 1024)} MB RSS`, true],
      ['Database', database.ok ? `Healthy • ${database.items} v2 items` : 'Unavailable', true],
      ['Shards', String(context.client.ws.shards.size || 1), true],
      ['GitHub webhooks', github, true],
      ['Dashboard', context.config.dashboardEnabled ? 'Enabled + token protected' : 'Disabled', true],
      ['Node.js', process.version, true],
    ]))], ephemeral: true });
  },
};

const botstatsCommand: BotCommand = {
  module: 'diagnostics',
  data: new SlashCommandBuilder().setName('botstats').setDescription('View DevForge usage, servers, users, uptime, and version.'),
  async execute(interaction, context) {
    const users = context.client.guilds.cache.reduce((sum, guild) => sum + guild.memberCount, 0);
    const commands = context.v2.commandStats(undefined, 10);
    const packageVersion = '2.1.1';
    await interaction.reply({ embeds: [embed(context, '📊 DevForge bot statistics').addFields(...fields([
      ['Version', packageVersion, true], ['Servers', String(context.client.guilds.cache.size), true], ['Users', users.toLocaleString(), true],
      ['Commands loaded', String(context.commands.size), true], ['Uptime', `${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m`, true], ['WebSocket', `${context.client.ws.ping} ms`, true],
      ['Top commands', commands.length ? commands.map((item) => `\`/${item.command}\` • ${item.uses}`).join('\n') : 'Usage collection starts after this update.'],
    ]))] });
  },
};

const whoisCommand: BotCommand = {
  module: 'diagnostics',
  data: new SlashCommandBuilder().setName('whois').setDescription('View Discord and DevForge information for a member.').addUserOption((option) => option.setName('member').setDescription('Member to inspect.')),
  async execute(interaction, context) {
    const user = interaction.options.getUser('member') ?? interaction.user;
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    const stats = context.db.getStats(interaction.guildId, user.id);
    const profile = context.db.getProfile(interaction.guildId, user.id);
    const achievements = context.db.getAchievements(interaction.guildId, user.id);
    const skills = context.v2.skills(interaction.guildId, user.id);
    await interaction.reply({ embeds: [embed(context, `🔎 ${user.displayName}`, profile?.bio ?? 'No DevForge bio yet.')
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .addFields(...fields([
        ['Discord ID', `\`${user.id}\``, true],
        ['Account created', `<t:${Math.floor(user.createdTimestamp / 1000)}:F>`, true],
        ['Joined server', member?.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>` : 'Not in server', true],
        ['Roles', member ? member.roles.cache.filter((role) => role.id !== interaction.guild.roles.everyone.id).map((role) => `${role}`).slice(0, 20).join(' ') || 'None' : '—'],
        ['DevForge', `Level **${stats.level}** • ${stats.xp} XP • ${stats.reputation} reputation`, true],
        ['Achievements', String(achievements.length), true],
        ['Top skills', skills.slice(0, 4).map((skill) => `${skill.area}: ${skill.xp}`).join(' • ') || 'None logged'],
        ['GitHub / portfolio', [profile?.github, profile?.portfolio].filter(Boolean).join('\n') || 'Not provided'],
      ]))] });
  },
};

function base64Decode(value: string): string | null {
  try {
    const decoded = Buffer.from(value, 'base64').toString('utf8');
    return decoded.includes('\uFFFD') ? null : decoded;
  } catch {
    return null;
  }
}

const toolsCommand: BotCommand = {
  module: 'developer_tools',
  data: new SlashCommandBuilder()
    .setName('tools')
    .setDescription('Developer utilities for timestamps, UUIDs, hashes, Base64, JSON, and units.')
    .addSubcommand((subcommand) => subcommand.setName('timestamp').setDescription('Create Discord timestamp formats.').addStringOption((option) => option.setName('date').setDescription('ISO date; defaults to now.').setMaxLength(100)))
    .addSubcommand((subcommand) => subcommand.setName('uuid').setDescription('Generate UUID v4 values.').addIntegerOption((option) => option.setName('count').setDescription('1–5.').setMinValue(1).setMaxValue(5)))
    .addSubcommand((subcommand) =>
      subcommand.setName('hash').setDescription('Hash text with SHA-256 or SHA-512.')
        .addStringOption((option) => option.setName('text').setDescription('Text to hash. Do not enter secrets.').setRequired(true).setMaxLength(1500))
        .addStringOption((option) => option.setName('algorithm').setDescription('Hash algorithm.').setRequired(true).addChoices({ name: 'SHA-256', value: 'sha256' }, { name: 'SHA-512', value: 'sha512' })),
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('base64').setDescription('Encode or decode Base64 locally.')
        .addStringOption((option) => option.setName('mode').setDescription('Operation.').setRequired(true).addChoices({ name: 'Encode', value: 'encode' }, { name: 'Decode', value: 'decode' }))
        .addStringOption((option) => option.setName('text').setDescription('Input text. Do not enter secrets.').setRequired(true).setMaxLength(1500)),
    )
    .addSubcommand((subcommand) => subcommand.setName('json').setDescription('Validate and format JSON.').addStringOption((option) => option.setName('input').setDescription('JSON input.').setRequired(true).setMaxLength(1800)))
    .addSubcommand((subcommand) =>
      subcommand.setName('bytes').setDescription('Convert a byte count to readable units.')
        .addNumberOption((option) => option.setName('value').setDescription('Number of bytes.').setRequired(true).setMinValue(0)),
    ),
  async execute(interaction, context) {
    const subcommand = interaction.options.getSubcommand();
    let output: string;
    if (subcommand === 'timestamp') {
      const input = interaction.options.getString('date');
      const date = input ? new Date(input) : new Date();
      if (Number.isNaN(date.getTime())) {
        await deny(interaction, context, 'That date is invalid. Try an ISO value such as `2026-09-21T18:30:00-03:00`.');
        return;
      }
      const seconds = Math.floor(date.getTime() / 1000);
      output = ['t', 'T', 'd', 'D', 'f', 'F', 'R'].map((style) => `\`<t:${seconds}:${style}>\` → <t:${seconds}:${style}>`).join('\n');
    } else if (subcommand === 'uuid') {
      output = Array.from({ length: interaction.options.getInteger('count') ?? 1 }, () => `\`${randomUUID()}\``).join('\n');
    } else if (subcommand === 'hash') {
      const algorithm = interaction.options.getString('algorithm', true);
      output = `\`${createHash(algorithm).update(interaction.options.getString('text', true)).digest('hex')}\``;
    } else if (subcommand === 'base64') {
      const mode = interaction.options.getString('mode', true);
      const text = interaction.options.getString('text', true);
      const result = mode === 'encode' ? Buffer.from(text, 'utf8').toString('base64') : base64Decode(text);
      if (result === null) {
        await deny(interaction, context, 'The input is not valid Base64 text.');
        return;
      }
      output = safeCodeBlock(truncate(result, 1800), 'text');
    } else if (subcommand === 'json') {
      try {
        output = safeCodeBlock(JSON.stringify(JSON.parse(interaction.options.getString('input', true)) as unknown, null, 2), 'json');
      } catch {
        await deny(interaction, context, 'Invalid JSON. Check quotes, commas, and brackets.');
        return;
      }
    } else {
      const value = interaction.options.getNumber('value', true);
      const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
      const index = value === 0 ? 0 : Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
      output = `**${value.toLocaleString()} bytes** = **${(value / 1024 ** index).toFixed(2)} ${units[index]}**`;
    }
    await interaction.reply({ embeds: [embed(context, `🧰 Tools • ${subcommand}`, truncate(output, 4000))], ephemeral: true });
  },
};

function potentiallyUnsafeRegex(pattern: string): boolean {
  return pattern.length > 150 || /\([^)]*[+*][^)]*\)[+*{]/.test(pattern) || /(\.\*){2,}|(\.\+){2,}/.test(pattern);
}

const playgroundCommand: BotCommand = {
  module: 'developer_tools',
  data: new SlashCommandBuilder()
    .setName('playground')
    .setDescription('Safely test regex, JSON, and Discord Markdown.')
    .addSubcommand((subcommand) =>
      subcommand.setName('regex').setDescription('Test a small regular expression.')
        .addStringOption((option) => option.setName('pattern').setDescription('Regex without slashes.').setRequired(true).setMaxLength(150))
        .addStringOption((option) => option.setName('text').setDescription('Test input.').setRequired(true).setMaxLength(1000))
        .addStringOption((option) => option.setName('flags').setDescription('Allowed: gimsuy.').setMaxLength(6)),
    )
    .addSubcommand((subcommand) => subcommand.setName('json').setDescription('Validate JSON and show its top-level type.').addStringOption((option) => option.setName('input').setDescription('JSON input.').setRequired(true).setMaxLength(1800)))
    .addSubcommand((subcommand) => subcommand.setName('markdown').setDescription('Preview Discord Markdown privately.').addStringOption((option) => option.setName('input').setDescription('Markdown input.').setRequired(true).setMaxLength(1500))),
  async execute(interaction, context) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'markdown') {
      await interaction.reply({ content: interaction.options.getString('input', true), allowedMentions: { parse: [] }, ephemeral: true });
      return;
    }
    if (subcommand === 'json') {
      try {
        const parsed = JSON.parse(interaction.options.getString('input', true)) as unknown;
        const type = Array.isArray(parsed) ? 'array' : parsed === null ? 'null' : typeof parsed;
        await interaction.reply({ embeds: [successEmbed(context, 'Valid JSON', `Top-level type: **${type}**`)], ephemeral: true });
      } catch (error) {
        await deny(interaction, context, `Invalid JSON: ${error instanceof Error ? truncate(error.message, 300) : 'parse error'}`);
      }
      return;
    }
    const pattern = interaction.options.getString('pattern', true);
    const flags = interaction.options.getString('flags') ?? 'g';
    if (!/^[gimsuy]*$/.test(flags) || potentiallyUnsafeRegex(pattern)) {
      await deny(interaction, context, 'The flags are invalid or the pattern was rejected as potentially expensive.');
      return;
    }
    try {
      const regex = new RegExp(pattern, flags);
      const text = interaction.options.getString('text', true);
      const matches = [...text.matchAll(regex.global ? regex : new RegExp(regex.source, `${regex.flags}g`))].slice(0, 25);
      const body = matches.length ? matches.map((match, index) => `**${index + 1}.** \`${truncate(match[0], 100)}\` at index ${match.index}`).join('\n') : 'No matches.';
      await interaction.reply({ embeds: [embed(context, '🧪 Regex result', body)], ephemeral: true });
    } catch (error) {
      await deny(interaction, context, `Invalid regular expression: ${error instanceof Error ? truncate(error.message, 250) : 'compile error'}`);
    }
  },
};

const bookmarksCommand: BotCommand = {
  module: 'bookmarks',
  data: new SlashCommandBuilder()
    .setName('bookmarks')
    .setDescription('Save important Discord messages for later.')
    .addSubcommand((subcommand) =>
      subcommand.setName('save').setDescription('Save a message link.')
        .addStringOption((option) => option.setName('message_link').setDescription('Copy Message Link from Discord.').setRequired(true).setMaxLength(300))
        .addStringOption((option) => option.setName('note').setDescription('Why is this useful?').setMaxLength(300)),
    )
    .addSubcommand((subcommand) => subcommand.setName('list').setDescription('List your bookmarks.'))
    .addSubcommand((subcommand) => subcommand.setName('remove').setDescription('Remove a bookmark.').addStringOption((option) => option.setName('id').setDescription('Bookmark ID.').setRequired(true))),
  async execute(interaction, context) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'save') {
      const link = interaction.options.getString('message_link', true);
      const match = /^https:\/\/(?:canary\.|ptb\.)?discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)$/.exec(link);
      if (!match || match[1] !== interaction.guildId) {
        await deny(interaction, context, 'Use a valid message link from this server.');
        return;
      }
      const channel = await interaction.guild.channels.fetch(match[2]!).catch(() => null);
      if (!channel?.isTextBased() || !('messages' in channel)) {
        await deny(interaction, context, 'The linked channel is unavailable.');
        return;
      }
      const message = await channel.messages.fetch(match[3]!).catch(() => null);
      if (!message) {
        await deny(interaction, context, 'The message was not found or you cannot access it.');
        return;
      }
      const item = context.v2.createItem({ guildId: interaction.guildId, type: 'bookmark', ownerId: interaction.user.id, title: truncate(message.cleanContent || 'Attachment or embed message', 100), data: {
        url: message.url, channelId: message.channelId, messageId: message.id, authorId: message.author.id, note: interaction.options.getString('note') ?? '', preview: truncate(message.cleanContent, 300),
      }, idPrefix: 'mark' });
      await interaction.reply({ embeds: [successEmbed(context, 'Bookmark saved', `Saved as **${item.id}**.`)], ephemeral: true });
      return;
    }
    if (subcommand === 'list') {
      const items = context.v2.listItems({ guildId: interaction.guildId, type: 'bookmark', ownerId: interaction.user.id, limit: 30 });
      const body = items.length ? items.map((item) => `**${item.id}** • [Open message](${String(item.data['url'])})\n${truncate(String(item.data['note'] || item.data['preview']), 220)}`).join('\n\n') : 'No bookmarks saved.';
      await interaction.reply({ embeds: [embed(context, '🔖 Your bookmarks', body)], ephemeral: true });
      return;
    }
    const id = interaction.options.getString('id', true);
    const item = context.v2.getItem(id, 'bookmark');
    if (!item || item.guild_id !== interaction.guildId || item.owner_id !== interaction.user.id) {
      await deny(interaction, context, 'Bookmark not found or not owned by you.');
      return;
    }
    context.v2.deleteItem(id);
    await interaction.reply({ embeds: [successEmbed(context, 'Bookmark removed', `**${id}** was deleted.`)], ephemeral: true });
  },
};

interface TodoData extends JsonObject {
  project: string | null;
  private: boolean;
}

const todoCommand: BotCommand = {
  module: 'todo',
  data: new SlashCommandBuilder()
    .setName('todo')
    .setDescription('Manage private or project-linked tasks.')
    .addSubcommand((subcommand) =>
      subcommand.setName('add').setDescription('Add a task.')
        .addStringOption((option) => option.setName('task').setDescription('What needs to be done?').setRequired(true).setMaxLength(300))
        .addStringOption((option) => option.setName('project').setDescription('Optional project name or ID.').setMaxLength(100))
        .addStringOption((option) => option.setName('deadline').setDescription('Optional ISO date or date-time.').setMaxLength(100))
        .addBooleanOption((option) => option.setName('private').setDescription('Keep this task private.')),
    )
    .addSubcommand((subcommand) => subcommand.setName('list').setDescription('List your tasks.'))
    .addSubcommand((subcommand) => subcommand.setName('complete').setDescription('Complete a task.').addStringOption((option) => option.setName('id').setDescription('Task ID.').setRequired(true)))
    .addSubcommand((subcommand) => subcommand.setName('remove').setDescription('Delete a task.').addStringOption((option) => option.setName('id').setDescription('Task ID.').setRequired(true))),
  async execute(interaction, context) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'add') {
      const deadlineInput = interaction.options.getString('deadline');
      const parsed = deadlineInput ? new Date(deadlineInput) : null;
      if (parsed && Number.isNaN(parsed.getTime())) {
        await deny(interaction, context, 'The deadline is invalid. Use an ISO date such as `2026-10-01` or include a timezone.');
        return;
      }
      const item = context.v2.createItem<TodoData>({ guildId: interaction.guildId, type: 'todo', ownerId: interaction.user.id, title: interaction.options.getString('task', true), status: 'open', dueAt: parsed?.toISOString() ?? null, data: {
        project: interaction.options.getString('project'), private: interaction.options.getBoolean('private') ?? true,
      }, idPrefix: 'todo' });
      await interaction.reply({ embeds: [successEmbed(context, 'Task added', `**${item.id}** • ${item.title}`)], ephemeral: item.data.private });
      return;
    }
    if (subcommand === 'list') {
      const items = context.v2.listItems<TodoData>({ guildId: interaction.guildId, type: 'todo', ownerId: interaction.user.id, limit: 50 });
      const body = items.length ? items.map((item) => `${item.status === 'completed' ? '✅' : '⬜'} **${item.id}** • ${item.title}${item.data.project ? ` • ${item.data.project}` : ''}${item.due_at ? ` • ${relativeTimestamp(item.due_at)}` : ''}`).join('\n') : 'No tasks yet.';
      await interaction.reply({ embeds: [embed(context, '📌 Your todo list', body)], ephemeral: true });
      return;
    }
    const id = interaction.options.getString('id', true);
    const item = context.v2.getItem(id, 'todo');
    if (!item || item.guild_id !== interaction.guildId || item.owner_id !== interaction.user.id) {
      await deny(interaction, context, 'Task not found or not owned by you.');
      return;
    }
    if (subcommand === 'complete') {
      context.v2.updateItem(id, { status: 'completed' });
      context.v2.changeCredits(interaction.guildId, interaction.user.id, 2, 'Completed a todo', id);
      await interaction.reply({ embeds: [successEmbed(context, 'Task completed', 'Nice work. You earned **2 credits**.')], ephemeral: true });
    } else {
      context.v2.deleteItem(id);
      await interaction.reply({ embeds: [successEmbed(context, 'Task removed', `**${id}** was deleted.`)], ephemeral: true });
    }
  },
};

interface FocusData extends JsonObject {
  goal: string;
  minutes: number;
  threadId: string | null;
}

const focusCommand: BotCommand = {
  module: 'focus',
  data: new SlashCommandBuilder()
    .setName('focus')
    .setDescription('Run group Pomodoro sessions with temporary threads and stats.')
    .addSubcommand((subcommand) =>
      subcommand.setName('start').setDescription('Start a focus session.')
        .addStringOption((option) => option.setName('goal').setDescription('What will you focus on?').setRequired(true).setMaxLength(200))
        .addIntegerOption((option) => option.setName('minutes').setDescription('Session duration.').setRequired(true).setMinValue(5).setMaxValue(180)),
    )
    .addSubcommand((subcommand) => subcommand.setName('join').setDescription('Join a focus session.').addStringOption((option) => option.setName('id').setDescription('Session ID.').setRequired(true)))
    .addSubcommand((subcommand) => subcommand.setName('end').setDescription('End your focus session.').addStringOption((option) => option.setName('id').setDescription('Session ID.').setRequired(true)))
    .addSubcommand((subcommand) => subcommand.setName('stats').setDescription('View your focus statistics.')),
  async execute(interaction, context) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'start') {
      const minutes = interaction.options.getInteger('minutes', true);
      const goal = interaction.options.getString('goal', true);
      let threadId: string | null = null;
      const channel = interaction.channel;
      if (channel?.type === ChannelType.GuildText) {
        const thread = await channel.threads.create({ name: truncate(`Focus • ${interaction.user.displayName} • ${goal}`, 100), type: ChannelType.PrivateThread, invitable: true, autoArchiveDuration: 60, reason: 'DevForge focus session' }).catch(() => null);
        if (thread) {
          threadId = thread.id;
          await thread.members.add(interaction.user.id);
          await thread.send(`⏱️ **${minutes}-minute focus session**\nGoal: ${goal}\nUse \`/focus join\` with the session ID to invite collaborators.`);
        }
      }
      const dueAt = new Date(Date.now() + minutes * 60_000).toISOString();
      const item = context.v2.createItem<FocusData>({ guildId: interaction.guildId, type: 'focus', ownerId: interaction.user.id, title: goal, status: 'active', dueAt, data: { goal, minutes, threadId }, idPrefix: 'focus' });
      context.v2.setMember({ itemId: item.id, userId: interaction.user.id, role: 'host' });
      await interaction.reply({ embeds: [successEmbed(context, 'Focus session started', `Session **${item.id}** ends <t:${Math.floor(new Date(dueAt).getTime() / 1000)}:R>.${threadId ? ` Join <#${threadId}>.` : ''}`)], ephemeral: true });
      return;
    }
    if (subcommand === 'stats') {
      const sessions = context.v2.listItems<FocusData>({ guildId: interaction.guildId, type: 'focus', ownerId: interaction.user.id, limit: 100 });
      const completed = sessions.filter((item) => item.status === 'completed');
      const minutes = completed.reduce((sum, item) => sum + item.data.minutes, 0);
      await interaction.reply({ embeds: [embed(context, '🧠 Focus statistics').addFields(...fields([
        ['Completed sessions', String(completed.length), true], ['Focused minutes', String(minutes), true], ['Average session', completed.length ? `${Math.round(minutes / completed.length)} min` : '—', true],
      ]))], ephemeral: true });
      return;
    }
    const id = interaction.options.getString('id', true);
    const item = context.v2.getItem<FocusData>(id, 'focus');
    if (!item || item.guild_id !== interaction.guildId || item.status !== 'active') {
      await deny(interaction, context, 'Active focus session not found.');
      return;
    }
    if (subcommand === 'join') {
      context.v2.setMember({ itemId: item.id, userId: interaction.user.id, role: 'participant' });
      if (item.data.threadId) {
        const thread = await interaction.guild.channels.fetch(item.data.threadId).catch(() => null);
        if (thread?.isThread()) await thread.members.add(interaction.user.id).catch(() => null);
      }
      await interaction.reply({ embeds: [successEmbed(context, 'Focus session joined', `You joined **${item.title}**.`)], ephemeral: true });
      return;
    }
    if (item.owner_id !== interaction.user.id) {
      await deny(interaction, context, 'Only the session host can end it early.');
      return;
    }
    context.v2.updateItem(item.id, { status: 'completed' });
    context.v2.changeCredits(interaction.guildId, interaction.user.id, Math.max(5, Math.floor(item.data.minutes / 5)), 'Completed focus session', item.id);
    context.v2.updateStreak(interaction.guildId, interaction.user.id, 'focus');
    if (item.data.threadId) {
      const thread = await interaction.guild.channels.fetch(item.data.threadId).catch(() => null);
      if (thread?.isThread()) await thread.setArchived(true, 'Focus session completed').catch(() => null);
    }
    await interaction.reply({ embeds: [successEmbed(context, 'Focus session completed', `Great work on **${item.title}**.`)], ephemeral: true });
  },
};

const MISSIONS = [
  ['review', 'Review a code request or provide constructive technical feedback.', 'reviews'],
  ['help', 'Answer a developer question with useful context.', 'community'],
  ['ship', 'Post a meaningful project or dev-log update.', 'shipping'],
  ['learn', 'Log a focused learning session in your Skill Tree.', 'learning'],
  ['connect', 'Join a pair-programming or mentoring session.', 'collaboration'],
] as const;

function dailyMissions(guildId: string): typeof MISSIONS[number][] {
  const day = new Date().toISOString().slice(0, 10);
  let hash = 0;
  for (const character of `${guildId}:${day}`) hash = (hash * 33 + character.charCodeAt(0)) >>> 0;
  const first = hash % MISSIONS.length;
  return [MISSIONS[first]!, MISSIONS[(first + 2) % MISSIONS.length]!, MISSIONS[(first + 4) % MISSIONS.length]!];
}

const missionsCommand: BotCommand = {
  module: 'missions',
  data: new SlashCommandBuilder()
    .setName('missions')
    .setDescription('Complete daily community missions for credits and streaks.')
    .addSubcommand((subcommand) => subcommand.setName('view').setDescription("View today's missions."))
    .addSubcommand((subcommand) =>
      subcommand.setName('complete').setDescription('Mark one mission complete after doing the work.')
        .addStringOption((option) => option.setName('mission').setDescription('Mission key shown in /missions view.').setRequired(true).setMaxLength(30))
        .addStringOption((option) => option.setName('evidence').setDescription('Message, PR, project, or concise explanation.').setRequired(true).setMinLength(10).setMaxLength(500)),
    )
    .addSubcommand((subcommand) => subcommand.setName('leaderboard').setDescription('View top mission streaks.')),
  async execute(interaction, context) {
    const subcommand = interaction.options.getSubcommand();
    const missions = dailyMissions(interaction.guildId);
    const date = new Date().toISOString().slice(0, 10);
    if (subcommand === 'view') {
      await interaction.reply({ embeds: [embed(context, `🎯 Daily missions • ${date}`, missions.map(([key, description], index) => `**${index + 1}. \`${key}\`** — ${description}`).join('\n\n'))], ephemeral: true });
      return;
    }
    if (subcommand === 'complete') {
      const key = interaction.options.getString('mission', true).toLowerCase();
      const mission = missions.find(([missionKey]) => missionKey === key);
      if (!mission) {
        await deny(interaction, context, 'That is not one of today’s missions. Run `/missions view`.');
        return;
      }
      const duplicate = context.v2.listItems({ guildId: interaction.guildId, type: 'mission_completion', ownerId: interaction.user.id, limit: 50 }).some((item) => item.title === `${date}:${key}`);
      if (duplicate) {
        await deny(interaction, context, 'You already completed this mission today.');
        return;
      }
      const evidence = interaction.options.getString('evidence', true);
      context.v2.createItem({ guildId: interaction.guildId, type: 'mission_completion', ownerId: interaction.user.id, title: `${date}:${key}`, status: 'completed', data: { evidence, category: mission[2] }, idPrefix: 'mission' });
      context.v2.changeCredits(interaction.guildId, interaction.user.id, 15, `Daily mission: ${key}`);
      const streak = context.v2.updateStreak(interaction.guildId, interaction.user.id, 'missions');
      await interaction.reply({ embeds: [successEmbed(context, 'Mission completed', `You earned **15 credits**. Mission streak: **${streak.current} day(s)**.`)], ephemeral: true });
      return;
    }
    const completions = context.v2.listItems({ guildId: interaction.guildId, type: 'mission_completion', status: 'completed', limit: 100 });
    const totals = new Map<string, number>();
    for (const item of completions) totals.set(item.owner_id, (totals.get(item.owner_id) ?? 0) + 1);
    const leaders = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    await interaction.reply({ embeds: [embed(context, '🎯 Mission leaderboard', leaders.length ? leaders.map(([id, total], index) => `**${index + 1}.** <@${id}> — ${total}`).join('\n') : 'No missions completed yet.')] });
  },
};

const streakCommand: BotCommand = {
  module: 'streaks',
  data: new SlashCommandBuilder().setName('streak').setDescription('View daily and weekly participation streaks.').addUserOption((option) => option.setName('member').setDescription('Member to inspect.')),
  async execute(interaction, context) {
    const user = interaction.options.getUser('member') ?? interaction.user;
    const streaks = context.v2.streaks(interaction.guildId, user.id);
    const body = streaks.length ? streaks.map((item) => `🔥 **${item.kind}** — current ${item.current_count}, best ${item.best_count}${item.last_date ? ` • last ${item.last_date}` : ''}`).join('\n') : 'No activity streaks yet.';
    await interaction.reply({ embeds: [embed(context, `🔥 ${user.displayName}'s streaks`, body)] });
  },
};

const leaderboardsCommand: BotCommand = {
  module: 'leaderboards',
  data: new SlashCommandBuilder()
    .setName('leaderboards')
    .setDescription('Rank projects, reviews, mentoring, challenges, credits, and activity.')
    .addStringOption((option) => option.setName('category').setDescription('Ranking category.').setRequired(true).addChoices(
      { name: 'Credits', value: 'credits' }, { name: 'Completed reviews', value: 'reviews' }, { name: 'Projects', value: 'projects' }, { name: 'Mentor requests', value: 'mentoring' }, { name: 'Missions', value: 'missions' }, { name: 'Bug Hunt', value: 'bugs' },
    )),
  async execute(interaction, context) {
    const category = interaction.options.getString('category', true);
    if (category === 'credits') {
      const rows = context.v2.creditLeaderboard(interaction.guildId);
      await interaction.reply({ embeds: [embed(context, '📈 Credits leaderboard', rows.map((row, index) => `**${index + 1}.** <@${row.user_id}> — ${row.credits}`).join('\n') || 'No data yet.')] });
      return;
    }
    let items;
    if (category === 'projects') items = context.v2.listItems({ guildId: interaction.guildId, type: 'project_milestone', limit: 100 });
    else if (category === 'mentoring') items = context.v2.listItems({ guildId: interaction.guildId, type: 'mentor_request', limit: 100 });
    else if (category === 'missions') items = context.v2.listItems({ guildId: interaction.guildId, type: 'mission_completion', status: 'completed', limit: 100 });
    else if (category === 'bugs') items = context.v2.listItems({ guildId: interaction.guildId, type: 'bughunt_solution', status: 'correct', limit: 100 });
    else {
      const rows = context.db.leaderboard(interaction.guildId, 'helpful', 10);
      await interaction.reply({ embeds: [embed(context, '📈 Review/help leaderboard', rows.map((row, index) => `**${index + 1}.** <@${row.user_id}> — ${row.helpful}`).join('\n') || 'No data yet.')] });
      return;
    }
    const counts = new Map<string, number>();
    for (const item of items) counts.set(item.owner_id, (counts.get(item.owner_id) ?? 0) + 1);
    const leaders = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
    await interaction.reply({ embeds: [embed(context, `📈 ${category} leaderboard`, leaders.map(([id, total], index) => `**${index + 1}.** <@${id}> — ${total}`).join('\n') || 'No data yet.')] });
  },
};

const dashboardCommand: BotCommand = {
  module: 'dashboard',
  data: new SlashCommandBuilder().setName('dashboard').setDescription('View optional web dashboard status and secure access instructions.').setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction, context) {
    const url = context.config.publicBaseUrl ? `${context.config.publicBaseUrl}/dashboard` : `http://localhost:${context.config.port}/dashboard`;
    await interaction.reply({ embeds: [embed(context, '🌐 DevForge dashboard').addFields(...fields([
      ['Status', context.config.dashboardEnabled ? '✅ Enabled' : '❌ Disabled', true],
      ['URL', context.config.dashboardEnabled ? url : 'Enable `DASHBOARD_ENABLED=true` in `.env`.', false],
      ['Authentication', 'The dashboard requires the secret `DASHBOARD_TOKEN`. Never post that token in Discord or screenshots.'],
      ['Capabilities', 'View health and analytics, toggle modules, close tickets, update project states, and create internal moderation notes. Every change is token-protected and audited.'],
    ]))], ephemeral: true });
  },
};

export const v2ProductivityCommands: BotCommand[] = [
  creditsCommand,
  shopCommand,
  modulesCommand,
  permissionsCommand,
  notificationsCommand,
  auditCommand,
  healthCommand,
  botstatsCommand,
  whoisCommand,
  toolsCommand,
  playgroundCommand,
  bookmarksCommand,
  todoCommand,
  focusCommand,
  missionsCommand,
  streakCommand,
  leaderboardsCommand,
  dashboardCommand,
];

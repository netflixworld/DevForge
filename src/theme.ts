import { EmbedBuilder, type APIEmbedField } from 'discord.js';
import type { BotContext } from './types.js';

export const icons = {
  success: '✅',
  error: '❌',
  info: 'ℹ️',
  code: '⌨️',
  project: '🚀',
  review: '🔎',
  pair: '🤝',
  challenge: '🧩',
  reputation: '◆',
  shield: '🛡️',
} as const;

export function embed(context: BotContext, title: string, description?: string): EmbedBuilder {
  const result = new EmbedBuilder()
    .setColor(context.config.primaryColor)
    .setTitle(title)
    .setTimestamp()
    .setFooter({ text: `${context.config.botName} • Developer Community` });
  if (description) result.setDescription(description);
  return result;
}

export function successEmbed(context: BotContext, title: string, description: string): EmbedBuilder {
  return embed(context, `${icons.success} ${title}`, description).setColor(0x22c55e);
}

export function errorEmbed(context: BotContext, title: string, description: string): EmbedBuilder {
  return embed(context, `${icons.error} ${title}`, description).setColor(0xef4444);
}

export function fields(items: Array<[string, string, boolean?]>): APIEmbedField[] {
  return items.map(([name, value, inline]) => ({ name, value: value || '—', inline: inline ?? false }));
}

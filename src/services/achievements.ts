import type { BotContext } from '../types.js';

export interface AchievementDefinition {
  code: string;
  icon: string;
  name: string;
  description: string;
}

export const ACHIEVEMENTS: Record<string, AchievementDefinition> = {
  FIRST_PR: {
    code: 'FIRST_PR',
    icon: '🔀',
    name: 'First PR',
    description: 'Shared or completed a first pull-request workflow.',
  },
  FIRST_COMMIT: {
    code: 'FIRST_COMMIT',
    icon: '🌱',
    name: 'First Commit',
    description: 'Reached community level 1.',
  },
  SIGNAL_BOOSTER: {
    code: 'SIGNAL_BOOSTER',
    icon: '📡',
    name: 'Signal Booster',
    description: 'Earned 5 reputation points.',
  },
  PROJECT_SHIPPER: {
    code: 'PROJECT_SHIPPER',
    icon: '🚀',
    name: 'Project Shipper',
    description: 'Published 3 community projects.',
  },
  REVIEW_GUARDIAN: {
    code: 'REVIEW_GUARDIAN',
    icon: '🔎',
    name: 'Review Guardian',
    description: 'Completed 3 code reviews.',
  },
  CODE_REVIEWER: {
    code: 'CODE_REVIEWER',
    icon: '🧐',
    name: 'Code Reviewer',
    description: 'Completed a community code review.',
  },
  BUG_HUNTER: {
    code: 'BUG_HUNTER',
    icon: '🐛',
    name: 'Bug Hunter',
    description: 'Solved a Bug Hunt or developer bounty.',
  },
  MENTOR: {
    code: 'MENTOR',
    icon: '🧭',
    name: 'Mentor',
    description: 'Helped another developer through mentoring.',
  },
  OPEN_SOURCE_CONTRIBUTOR: {
    code: 'OPEN_SOURCE_CONTRIBUTOR',
    icon: '🌍',
    name: 'Open Source Contributor',
    description: 'Contributed to an open-source community project.',
  },
  HUNDRED_REVIEWS: {
    code: 'HUNDRED_REVIEWS',
    icon: '💯',
    name: '100 Reviews',
    description: 'Completed one hundred community code reviews.',
  },
  PROJECT_FOUNDER: {
    code: 'PROJECT_FOUNDER',
    icon: '🏗️',
    name: 'Project Founder',
    description: 'Founded a community project.',
  },
  PAIR_PROGRAMMER: {
    code: 'PAIR_PROGRAMMER',
    icon: '🤝',
    name: 'Pair Programmer',
    description: 'Completed a pair-programming session.',
  },
  CHALLENGE_ACCEPTED: {
    code: 'CHALLENGE_ACCEPTED',
    icon: '🧩',
    name: 'Challenge Accepted',
    description: 'Submitted a daily coding challenge.',
  },
};

export function achievement(code: string): AchievementDefinition {
  return (
    ACHIEVEMENTS[code] ?? {
      code,
      icon: '◆',
      name: code
        .toLowerCase()
        .split('_')
        .map((word) => word[0]?.toUpperCase() + word.slice(1))
        .join(' '),
      description: 'A hidden community achievement.',
    }
  );
}

export function evaluateAchievements(
  context: BotContext,
  guildId: string,
  userId: string,
): AchievementDefinition[] {
  const stats = context.db.getStats(guildId, userId);
  const candidates: string[] = [];
  if (stats.level >= 1) candidates.push('FIRST_COMMIT');
  if (stats.reputation >= 5) candidates.push('SIGNAL_BOOSTER');
  if (context.db.countOwnedProjects(guildId, userId) >= 3) candidates.push('PROJECT_SHIPPER');
  const reviews = context.db.countCompletedReviews(guildId, userId);
  if (context.db.countOwnedProjects(guildId, userId) >= 1) candidates.push('PROJECT_FOUNDER');
  if (reviews >= 1) candidates.push('CODE_REVIEWER');
  if (reviews >= 3) candidates.push('REVIEW_GUARDIAN');
  if (reviews >= 100) candidates.push('HUNDRED_REVIEWS');

  return candidates
    .filter((code) => context.db.awardAchievement(guildId, userId, code))
    .map((code) => achievement(code));
}

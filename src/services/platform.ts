import type { ProjectRow } from '../types.js';

export interface ProjectSignal {
  createdAt: string;
  updatedAt?: string | null;
  kind: 'milestone' | 'devlog' | 'workspace' | 'member';
}

export interface HealthResult {
  score: number;
  state: 'Healthy' | 'Attention' | 'At Risk' | 'Inactive';
  reasons: string[];
  recommendations: string[];
}

export function projectHealth(project: ProjectRow, signals: ProjectSignal[], now = Date.now()): HealthResult {
  const ageDays = Math.max(0, (now - new Date(project.created_at).getTime()) / 86_400_000);
  const recent = signals.filter((signal) => {
    const value = signal.updatedAt ?? signal.createdAt;
    return now - new Date(value).getTime() <= 14 * 86_400_000;
  });
  const kinds = new Set(recent.map((signal) => signal.kind));
  let score = 45;
  const reasons: string[] = [];
  const recommendations: string[] = [];

  if (project.repo_url) { score += 10; reasons.push('Repository linked'); }
  else recommendations.push('Link a repository with `/project status`.');
  if (project.looking_for) { score += 5; reasons.push('Recruitment needs are clear'); }
  if (kinds.has('workspace')) { score += 10; reasons.push('Project workspace is active'); }
  else recommendations.push('Create a shared space with `/workspace create`.');
  if (kinds.has('devlog')) { score += 15; reasons.push('Recent development log'); }
  else recommendations.push('Post a progress update with `/devlog`.');
  if (kinds.has('milestone')) { score += 10; reasons.push('Recent milestone activity'); }
  else recommendations.push('Add a milestone with `/project milestone`.');
  if (kinds.has('member')) { score += 5; reasons.push('Active collaborators'); }
  if (project.stars >= 3) { score += 5; reasons.push('Community interest'); }
  if (ageDays > 21 && !recent.length) { score -= 30; reasons.push('No recent tracked activity'); }
  if (ageDays > 45 && !kinds.has('devlog')) score -= 15;
  if (project.status === 'closed') score = Math.min(score, 25);
  score = Math.max(0, Math.min(100, score));
  const state = score >= 75 ? 'Healthy' : score >= 50 ? 'Attention' : score >= 25 ? 'At Risk' : 'Inactive';
  return { score, state, reasons, recommendations: recommendations.slice(0, 3) };
}

export function skillTokens(value: string): string[] {
  return [...new Set(value.toLowerCase().split(/[,;/|]+/).map((item) => item.trim()).filter(Boolean))];
}

export function matchScore(skills: string, stack: string): number {
  const wanted = skillTokens(stack);
  const owned = skillTokens(skills);
  if (!wanted.length || !owned.length) return 0;
  return wanted.reduce((score, item) => score + (owned.some((skill) => skill.includes(item) || item.includes(skill)) ? 1 : 0), 0);
}

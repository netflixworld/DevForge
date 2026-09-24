export interface ChallengeDefinition {
  key: string;
  title: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  description: string;
  requirements: string[];
  bonus: string;
}

export const CHALLENGES: readonly ChallengeDefinition[] = [
  {
    key: 'smart-rate-limiter',
    title: 'Build a Smart Rate Limiter',
    difficulty: 'Advanced',
    description: 'Create a reusable rate limiter that supports per-user quotas and burst protection.',
    requirements: ['Sliding-window or token-bucket strategy', 'Unit tests', 'Clear public API'],
    bonus: 'Add Redis support without changing the public API.',
  },
  {
    key: 'markdown-toc',
    title: 'Markdown Table of Contents',
    difficulty: 'Beginner',
    description: 'Turn Markdown headings into a nested, linked table of contents.',
    requirements: ['Support H1–H6', 'Generate stable slugs', 'Handle repeated headings'],
    bonus: 'Preserve headings found inside blockquotes while ignoring code fences.',
  },
  {
    key: 'tiny-cache',
    title: 'Tiny LRU Cache',
    difficulty: 'Intermediate',
    description: 'Implement a least-recently-used cache with predictable eviction behavior.',
    requirements: ['get, set, delete, clear', 'Configurable capacity', 'Automated tests'],
    bonus: 'Add per-entry TTL and hit-rate metrics.',
  },
  {
    key: 'log-detective',
    title: 'Log Detective',
    difficulty: 'Intermediate',
    description: 'Build a CLI that reads application logs and groups recurring errors into useful incidents.',
    requirements: ['Stream large files', 'Group similar stack traces', 'Produce JSON and human output'],
    bonus: 'Detect sudden error-rate spikes.',
  },
  {
    key: 'accessible-modal',
    title: 'Accessible Modal Component',
    difficulty: 'Intermediate',
    description: 'Create a framework-free web modal that works with keyboard and screen readers.',
    requirements: ['Focus trap', 'Escape-to-close', 'ARIA labels and focus restoration'],
    bonus: 'Support stacked modals without breaking focus order.',
  },
  {
    key: 'dependency-map',
    title: 'Dependency Map',
    difficulty: 'Advanced',
    description: 'Analyze source imports and generate a dependency graph for a small project.',
    requirements: ['Detect circular dependencies', 'Export JSON', 'Ignore configured paths'],
    bonus: 'Render a self-contained SVG graph.',
  },
  {
    key: 'api-paginator',
    title: 'Resilient API Paginator',
    difficulty: 'Intermediate',
    description: 'Write an async iterator that consumes a paginated API safely.',
    requirements: ['Cursor and page-number modes', 'Retries with backoff', 'AbortSignal support'],
    bonus: 'Prefetch the next page while preserving output order.',
  },
  {
    key: 'color-contrast',
    title: 'Color Contrast Checker',
    difficulty: 'Beginner',
    description: 'Check foreground and background colors against WCAG contrast targets.',
    requirements: ['Hex and RGB input', 'AA and AAA results', 'Helpful validation errors'],
    bonus: 'Suggest the closest passing foreground color.',
  },
  {
    key: 'feature-flags',
    title: 'Feature Flag Engine',
    difficulty: 'Advanced',
    description: 'Build a deterministic feature-flag evaluator for users and groups.',
    requirements: ['Percentage rollouts', 'Attribute rules', 'Deterministic assignment'],
    bonus: 'Explain exactly why each evaluation passed or failed.',
  },
  {
    key: 'commit-linter',
    title: 'Commit Message Linter',
    difficulty: 'Beginner',
    description: 'Validate commit messages against a configurable convention.',
    requirements: ['Configurable types', 'Useful error messages', 'CLI exit codes'],
    bonus: 'Publish a Git hook installer.',
  },
  {
    key: 'webhook-receiver',
    title: 'Secure Webhook Receiver',
    difficulty: 'Advanced',
    description: 'Implement an HTTP webhook endpoint with signature verification and replay protection.',
    requirements: ['HMAC verification', 'Constant-time comparison', 'Payload size limit'],
    bonus: 'Add idempotency keys and a dead-letter queue.',
  },
  {
    key: 'terminal-kanban',
    title: 'Terminal Kanban',
    difficulty: 'Intermediate',
    description: 'Create a small CLI board for moving tasks between todo, doing, and done.',
    requirements: ['Persistent local state', 'Add/move/archive commands', 'Readable terminal output'],
    bonus: 'Support undo for the last five operations.',
  },
  {
    key: 'json-diff',
    title: 'Human-Friendly JSON Diff',
    difficulty: 'Intermediate',
    description: 'Compare two JSON documents and explain additions, removals, and changes.',
    requirements: ['Nested objects', 'Arrays', 'Machine-readable output'],
    bonus: 'Generate RFC 6902 JSON Patch operations.',
  },
  {
    key: 'secret-scanner',
    title: 'Local Secret Scanner',
    difficulty: 'Advanced',
    description: 'Scan a folder for likely accidental secrets without uploading any file contents.',
    requirements: ['Pattern and entropy checks', 'Ignore file support', 'Redacted findings'],
    bonus: 'Scan only lines changed in a Git diff.',
  },
  {
    key: 'url-shortener-core',
    title: 'URL Shortener Core',
    difficulty: 'Beginner',
    description: 'Design the core mapping and redirect logic for a URL shortener.',
    requirements: ['Collision handling', 'Expiration dates', 'Click counter'],
    bonus: 'Generate memorable word-based aliases.',
  },
  {
    key: 'schema-validator',
    title: 'Mini Schema Validator',
    difficulty: 'Advanced',
    description: 'Build a composable runtime validator for strings, numbers, objects, and arrays.',
    requirements: ['Nested error paths', 'Optional fields', 'Type-safe or documented output'],
    bonus: 'Generate JSON Schema from the same definitions.',
  },
  {
    key: 'retry-queue',
    title: 'Reliable Retry Queue',
    difficulty: 'Advanced',
    description: 'Process async jobs with bounded concurrency, retries, and graceful shutdown.',
    requirements: ['Exponential backoff', 'Concurrency limit', 'Failed-job reporting'],
    bonus: 'Persist unfinished jobs and resume after restart.',
  },
  {
    key: 'readme-score',
    title: 'README Quality Score',
    difficulty: 'Beginner',
    description: 'Score a project README using transparent, constructive checks.',
    requirements: ['Setup section check', 'License and usage checks', 'Actionable suggestions'],
    bonus: 'Output a Markdown badge with the score.',
  },
  {
    key: 'timezone-planner',
    title: 'Team Timezone Planner',
    difficulty: 'Intermediate',
    description: 'Find reasonable meeting windows for a globally distributed team.',
    requirements: ['IANA timezones', 'Working-hour preferences', 'Ranked time slots'],
    bonus: 'Account for daylight-saving changes across a date range.',
  },
  {
    key: 'offline-sync',
    title: 'Offline Sync Simulator',
    difficulty: 'Advanced',
    description: 'Simulate two clients editing offline and merging their changes later.',
    requirements: ['Conflict detection', 'Deterministic merge', 'Conflict report'],
    bonus: 'Implement a small CRDT and explain its guarantees.',
  },
] as const;

function hash(value: string): number {
  let result = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16_777_619);
  }
  return result >>> 0;
}

export function challengeFor(seed: string, offset = 0): ChallengeDefinition {
  const index = (hash(seed) + Math.max(0, offset)) % CHALLENGES.length;
  return CHALLENGES[index]!;
}

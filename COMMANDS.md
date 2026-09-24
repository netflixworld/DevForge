# DevForge 2.0 Command Reference

**English** · [Português (Brasil)](COMMANDS.pt-BR.md)

DevForge exposes 74 English slash commands. Discord displays the exact required options and choices while a command is being typed.

There is no traditional join-time `/autorole` command yet. Verification through `/onboarding` and optional self-roles through `/rolemenu` are available.

## Start here

| Command | Purpose |
| --- | --- |
| `/help` | Browse command groups. |
| `/ping` | Check interaction and WebSocket latency. |
| `/health` | Check uptime, memory, database, shards, and integrations. |
| `/botstats` | View servers, users, command usage, version, and uptime. |
| `/config bootstrap` | Create or reuse the recommended roles/channels. |
| `/modules list` | View every optional module state. |

## Identity, learning, and recognition

| Command | Main subcommands |
| --- | --- |
| `/profile` | `set`, `view`, `discover`, `clear` |
| `/rank` | View XP, level, reputation, messages, and badges. |
| `/skills` | `log`, `view`, `leaderboard` |
| `/achievements` | `view`, `catalog` |
| `/rep` | `give`, `history` |
| `/streak` | View participation streaks. |
| `/leaderboard` | XP, reputation, or helpful actions. |
| `/leaderboards` | Credits, reviews, projects, mentoring, missions, or Bug Hunt. |
| `/whois` | Discord and DevForge member profile. |

## Collaboration and projects

| Command | Main subcommands |
| --- | --- |
| `/project` | `create`, `browse`, `mine`, `info`, `close`, `status`, `milestone`, `changelog`, `vacancy` |
| `/review` | `request`, `queue`, `mine`, `assign`, `match`, `priority`, `comment` |
| `/pair` | `join`, `status`, `leave` |
| `/mentor` | `register`, `find`, `request`, `accept`, `complete`, `requests` |
| `/bounty` | `create`, `list`, `submit`, `award` |
| `/idea` | `create`, `list`, `status`, `convert` |
| `/rfc` | `create`, `list`, `vote`, `status` |
| `/devlog` | `add`, `list` |
| `/snippet` | `save`, `get`, `search`, `delete`, `favorite`, `favorites`, `vote`, `versions` |

## Challenges and events

| Command | Main subcommands |
| --- | --- |
| `/challenge` | `current`, `submit`, `leaderboard`, `rotate` |
| `/bughunt` | `current`, `submit`, `leaderboard` |
| `/battle` | `create`, `list`, `join`, `team`, `submit`, `vote`, `judge`, `results` |
| `/codejam` | Same event workflow as Code Battles. |
| `/hackathon` | Same workflow with teams, judges, and longer deadlines. |
| `/event` | `create`, `list`, `join`, `leave`, `checkin`, `cancel` |
| `/giveaway` | `create`, `join`, `draw`, `reroll`, `list` |
| `/poll` | `create`, `vote`, `results`, `close` |
| `/suggest` | `create`, `list`, `vote`, `status` |

## Knowledge and productivity

| Command | Main subcommands |
| --- | --- |
| `/rubberduck` | Start a guided debugging session. |
| `/standup` | Submit a classic asynchronous stand-up. |
| `/standups` | `submit`, `schedule`, `summary`, `streak`, `disable` |
| `/docs` | `search`, `add`, `remove` |
| `/bookmarks` | `save`, `list`, `remove` |
| `/todo` | `add`, `list`, `complete`, `remove` |
| `/focus` | `start`, `join`, `end`, `stats` |
| `/missions` | `view`, `complete`, `leaderboard` |
| `/remind` | `create`, `list`, `cancel` |
| `/tools` | `timestamp`, `uuid`, `hash`, `base64`, `json`, `bytes` |
| `/playground` | `regex`, `json`, `markdown` |

## GitHub and operations

| Command | Main subcommands |
| --- | --- |
| `/github` | `repo`, `user`, `webhook`, `subscribe`, `subscriptions` |
| `/release` | `subscribe`, `list`, `remove` |
| `/uptime` | `add`, `list`, `check`, `remove` |
| `/digest` | `configure`, `now`, `disable` |
| `/analytics` | Detailed 7/14/30-day server analytics. |
| `/insights` | Compact seven-day community pulse. |

## Community workspace

### DevForge Platform 2.1

| Command | What it does |
| --- | --- |
| `/passport view [member]` | Show a verified developer identity combining profile, XP, reputation, projects, achievements, skill XP, and links. |
| `/passport availability status:` | Update collaboration availability without rebuilding the profile. |
| `/discover [skill]` | Recommend open projects and code reviews that match the member's stack. |
| `/projecthealth check project_id:` | Calculate a 0–100 momentum score and suggest concrete next actions. |
| `/projecthealth rescue project_id: needs:` | Publish a controlled rescue campaign for an at-risk project. |
| `/workspace create project_id:` | Create a private team role, project hub, and pairing voice channel. |
| `/workspace archive project_id:` | Remove the generated workspace. |

| Command | Main subcommands |
| --- | --- |
| `/ticket` | `open`, `panel`, `claim`, `close`, `add`, `remove`, `priority`, `stats` |
| `/onboarding` | `setup`, `start`, `status` |
| `/rolemenu` | `create`, `list` |
| `/starboard` | `add`, `list`, `remove` |
| `/voice` | `setup`, `name`, `limit`, `lock`, `unlock`, `allow`, `deny`, `transfer` |
| `/autothread` | `add`, `list`, `remove` |
| `/notifications` | `view`, `set` |

## Internal economy

| Command | Main subcommands |
| --- | --- |
| `/credits` | `balance`, `history`, `leaderboard`, `grant` |
| `/shop` | `list`, `buy`, `add`, `remove` |

Credits are internal community points only. They have no monetary value.

## Moderation and security

| Command | Purpose |
| --- | --- |
| `/ban` | Ban and create a case. |
| `/kick` | Kick and create a case. |
| `/timeout` | Apply or remove a timeout. |
| `/warn` | Warn with configurable automatic escalation. |
| `/purge` | Delete recent messages, optionally by member. |
| `/slowmode` | Change current-channel slowmode. |
| `/lock` / `/unlock` | Toggle default-role sending permissions. |
| `/nick` | Change or clear a nickname. |
| `/mod` | Legacy warning, timeout, note, case-history, and purge tools. |
| `/appeal` | `submit`, `status`, `resolve` |
| `/security` | `view`, `configure` |
| `/audit` | Search DevForge's audit history. |

## Administration

| Command | Main subcommands |
| --- | --- |
| `/config` | `bootstrap`, `view`, `channel`, `role`, `feature`, `star-threshold` |
| `/modules` | `list`, `toggle` |
| `/permissions` | `set`, `list`, `remove` |
| `/dashboard` | View dashboard status and secure URL. |

## Recommended first-run sequence

1. `/health`
2. `/config bootstrap`
3. `/onboarding setup`
4. `/ticket panel`
5. `/security configure`
6. `/modules list`
7. `/permissions list`

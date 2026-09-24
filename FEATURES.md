# DevForge 2.0 Feature Matrix

**English** · [Português (Brasil)](FEATURES.pt-BR.md)

All bot-facing commands, modals, buttons, select menus, and automated messages are in English.

1. **Advanced Moderation** — `/ban`, `/kick`, `/timeout`, `/warn`, `/purge`, `/slowmode`, `/lock`, `/unlock`, `/nick`, `/mod`, `/security`, `/appeal`; cases, notes, escalation, anti-spam, anti-invite, anti-raid, mention limits, role-change detection, and account-age alerts.
2. **Ticket System** — `/ticket`; guided form, private channels, claim, guests, priorities, transcript HTML, feedback, auto-close, and statistics.
3. **Smart Onboarding** — `/onboarding`; rules, verification, initial questions, technology selection, roles, and progress.
4. **Role Manager** — `/rolemenu`; reusable multi-select self-role panels.
5. **Server Analytics** — `/analytics` and `/insights`; growth, activity, active members, peak hours, channels, joins, projects, reviews, and sessions.
6. **Developer Profiles** — `/profile`; stack, GitHub, portfolio, experience, availability, goals, badges, and Skill Tree summary.
7. **Skill Tree** — `/skills`; Frontend, Backend, DevOps, Security, Database, Mobile, and Game Dev XP.
8. **Achievements** — `/achievements`; First PR, Code Reviewer, Bug Hunter, Mentor, Open Source Contributor, 100 Reviews, Project Founder, and legacy badges.
9. **Reputation 2.0** — `/rep`; anti-abuse limits, categories, reasons, history, credits, and leaderboards.
10. **Mentor Match** — `/mentor`; profiles, discovery, requests, acceptance, completion, rewards, and badges.
11. **Pair Programming** — `/pair`; stack/level/timezone matching, private threads, completion rewards, and streaks.
12. **Project Hub** — `/project`; projects, applications, members, lifecycle status, vacancies, milestones, changelog, stars, and links.
13. **Developer Bounties** — `/bounty`; credit escrow, submissions, winner selection, and rewards.
14. **Code Review Queue** — `/review`; priority, automatic skill matching, assignment, atomic claim, comments, completion XP/credits/reputation.
15. **Snippet Library** — `/snippet`; public/private snippets, language/tags, search, favorites, voting, versions, and usage counts.
16. **Code Battles** — `/battle`; registration, teams, submissions, voting, judging, and results.
17. **Code Jams** — `/codejam`; timed events, teams, submissions, voting, judging, and results.
18. **Hackathon Manager** — `/hackathon`; registration, teams, themes, deadlines, submissions, judge scores, community votes, and results.
19. **Idea Incubator** — `/idea`; create, discuss, register interest, state changes, and project conversion.
20. **Bug Hunt** — `/bughunt`; deterministic daily bugs, submissions, feedback, XP, credits, badges, and leaderboard.
21. **Rubber Duck 2.0** — `/rubberduck`; structured brief followed by guided debugging questions and completion tracking.
22. **RFC System** — `/rfc`; Draft, Review, Accepted, Rejected, Implemented, and community votes.
23. **Stand-ups** — `/standup` and `/standups`; Yesterday/Today/Blockers, schedules, streaks, and summaries.
24. **Dev Logs** — `/devlog`; project progress history and next steps.
25. **Knowledge Base** — `/docs`; staff publishing, search, tags, and archival.
26. **GitHub 2.0** — `/github`; repositories, developer profiles, signed pushes/PRs/issues/releases, per-repository routing, badges, XP, and credits.
27. **Release Feed** — `/release`; repository-specific release destinations and digest entries.
28. **Project Status** — `/project status`; Planning, Development, Testing, Maintenance, Paused, and Archived.
29. **Uptime Monitor** — `/uptime`; safe public URL checks, latency, consecutive failures, outage alerts, and recovery alerts.
30. **Reminders** — `/remind`; personal, recurring, deadline, and project-linked reminders.
31. **Event Manager** — `/event`; registration, capacity, waiting list, promotion, reminders, check-in, and cancellation.
32. **Giveaways** — `/giveaway`; duration, role requirement, multiple winners, secure draw, reroll, and automatic ending.
33. **Advanced Polls** — `/poll`; single/multiple choice, anonymous mode, role requirement, deadline, results, and closure.
34. **Suggestions** — `/suggest`; proposals, votes, states, and official staff responses.
35. **Starboard 2.0** — `/starboard`; multiple emojis, thresholds, channels, and labels such as Funny, Useful, or Showcase.
36. **Temporary Voice** — `/voice`; join-to-create rooms, ownership, rename, limit, lock, whitelist/deny, transfer, and automatic cleanup.
37. **Auto Threads** — `/autothread`; automatic organized threads in selected channels.
38. **Digest** — `/digest`; manual or scheduled daily/weekly activity, project, review, release, and event summaries.
39. **Activity Streaks** — `/streak`; community, learning, focus, review, pair, stand-up, mission, and debugging streaks.
40. **Leaderboards** — `/leaderboard` and `/leaderboards`; XP, reputation, helpful actions, credits, reviews, projects, mentoring, missions, and Bug Hunt.
41. **Internal Credits** — `/credits`; auditable community-only currency with no real-money value.
42. **Reward Shop** — `/shop`; roles/colors/cosmetics, prices, stock, purchases, and automatic refunds on role errors.
43. **Permission Matrix** — `/permissions`; per-command role allow/deny rules with administrator safety bypass.
44. **Per-Server Configuration** — `/config`, `/security`, and module-specific setup commands; no source edits required.
45. **Modules** — `/modules`; toggle command access for major feature areas. Some separately registered background tasks and existing buttons continue to run.
46. **Notification Center** — `/notifications`; personal event, release, mentoring, uptime, digest, and project preferences.
47. **Audit Logs** — `/audit`; important bot, staff, security, dashboard, configuration, ticket, and moderation actions.
48. **Health** — `/health`; latency, uptime, memory, database, shards, GitHub, dashboard, and Node.js.
49. **Bot Statistics** — `/botstats`; servers, users, loaded commands, usage, uptime, latency, and version.
50. **Whois** — `/whois`; account, join date, roles, profile, XP, reputation, skills, achievements, GitHub, and portfolio.
51. **Developer Tools** — `/tools`; timestamps, UUIDs, SHA hashes, Base64, JSON formatting, and byte conversions.
52. **Playground** — `/playground`; bounded regex testing, JSON validation, and private Markdown preview.
53. **Bookmarks** — `/bookmarks`; save same-server message links with notes.
54. **Personal Todo** — `/todo`; private/project tasks, deadlines, completion, and credit rewards.
55. **Focus Sessions** — `/focus`; group Pomodoro sessions, private threads, participants, automatic completion, stats, and rewards.
56. **Daily Missions** — `/missions`; rotating tasks, evidence, credits, streaks, and leaderboard.
57. **Web Dashboard** — optional token-protected dashboard for analytics, modules, tickets, project states, and moderation notes.
58. **Plugin Architecture** — `src/modules/plugins.ts` combines commands, buttons, modals, and select handlers into installable internal packages.

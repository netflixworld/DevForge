import { createHmac, timingSafeEqual } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { ChannelType, type Client, type EmbedBuilder } from 'discord.js';
import { embed, fields } from '../theme.js';
import type { BotContext } from '../types.js';
import { truncate } from '../utils.js';
import { MODULES } from '../modules/registry.js';

interface GithubPayload {
  action?: string;
  ref?: string;
  compare?: string;
  commits?: Array<{ id: string; message: string; url: string; author?: { name?: string } }>;
  head_commit?: { id: string; message: string; url: string } | null;
  repository?: { full_name?: string; html_url?: string; default_branch?: string };
  sender?: { login?: string; avatar_url?: string; html_url?: string };
  pull_request?: {
    number?: number;
    title?: string;
    html_url?: string;
    merged?: boolean;
    user?: { login?: string };
    head?: { ref?: string };
    base?: { ref?: string };
  };
  issue?: {
    number?: number;
    title?: string;
    html_url?: string;
    user?: { login?: string };
    state?: string;
  };
  release?: {
    name?: string | null;
    tag_name?: string;
    html_url?: string;
    prerelease?: boolean;
    draft?: boolean;
    author?: { login?: string };
  };
}

function json(response: ServerResponse, status: number, body: Record<string, unknown>): void {
  const data = JSON.stringify(body);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(data),
    'cache-control': 'no-store',
  });
  response.end(data);
}

function html(response: ServerResponse, status: number, body: string): void {
  response.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'",
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
  });
  response.end(body);
}

function dashboardAuthorized(request: IncomingMessage, secret: string): boolean {
  const header = request.headers.authorization?.replace(/^Bearer\s+/i, '') ?? request.headers['x-devforge-token'];
  const token = Array.isArray(header) ? header[0] : header;
  if (!token) return false;
  const expected = Buffer.from(secret);
  const received = Buffer.from(token);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

const DASHBOARD_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>DevForge Dashboard</title><style>
:root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui;background:#090f1f;color:#e5e7eb}*{box-sizing:border-box}body{margin:0;padding:32px}.wrap{max-width:1100px;margin:auto}h1{font-size:32px;margin:0}p{color:#9ca3af}.bar{display:flex;gap:12px;margin:24px 0}input,button,select{border:1px solid #334155;border-radius:10px;padding:12px;background:#111827;color:#fff}input{flex:1}button{background:#4f46e5;cursor:pointer;margin:4px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin-bottom:24px}.card{background:#111827;border:1px solid #1f2937;border-radius:16px;padding:18px}.card>div{border-top:1px solid #1f2937;padding:10px 0}.metric{font-size:28px;font-weight:700;color:#67e8f9}.error{color:#fca5a5}code{color:#c4b5fd}
</style></head><body><main class="wrap"><h1>DevForge Dashboard</h1><p>Private server operations and configuration panel. Enter the dashboard token from your environment configuration.</p><div class="bar"><input id="token" type="password" autocomplete="current-password" placeholder="Dashboard token"><button id="load">Load dashboard</button></div><p id="status"></p><section id="content"></section></main><script>
const status=document.querySelector('#status'),content=document.querySelector('#content'),tokenInput=document.querySelector('#token');let snapshot=null;
function el(tag,text,cls){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node}
async function request(path,options={}){const response=await fetch(path,{...options,headers:{...(options.headers||{}),Authorization:'Bearer '+tokenInput.value,'Content-Type':'application/json'}});if(!response.ok){const body=await response.json().catch(()=>({}));throw new Error(body.error||'Request failed')}return response.json()}
async function act(payload){status.className='';status.textContent='Saving…';await request('/api/dashboard/action',{method:'POST',body:JSON.stringify(payload)});await load()}
function labeled(label,node){const wrap=el('div');wrap.append(el('p',label),node);return wrap}
function render(data){content.textContent='';for(const guild of data.guilds){content.append(el('h2',guild.name));const grid=el('div',undefined,'grid');for(const [label,value] of Object.entries(guild.metrics)){const card=el('div',undefined,'card');card.append(el('p',label.replaceAll('_',' ')),el('div',String(value),'metric'));grid.append(card)}content.append(grid);const manage=el('div',undefined,'grid');
const moduleCard=el('div',undefined,'card');moduleCard.append(el('h3','Modules'));const moduleSelect=document.createElement('select');for(const module of guild.modules){const option=document.createElement('option');option.value=module.name;option.textContent=(module.enabled?'✅ ':'❌ ')+module.name;option.dataset.enabled=String(module.enabled);moduleSelect.append(option)}const moduleButton=el('button','Toggle selected');moduleButton.onclick=()=>{const option=moduleSelect.selectedOptions[0];act({action:'module.toggle',guildId:guild.id,module:option.value,enabled:option.dataset.enabled!=='true'}).catch(showError)};moduleCard.append(moduleSelect,moduleButton);manage.append(moduleCard);
const ticketCard=el('div',undefined,'card');ticketCard.append(el('h3','Open tickets'));if(!guild.tickets.length)ticketCard.append(el('p','No open tickets.'));for(const ticket of guild.tickets){const row=el('div');row.append(el('span',ticket.id+' • '+ticket.title+' • '+ticket.priority+' '));const close=el('button','Close');close.onclick=()=>act({action:'ticket.close',guildId:guild.id,id:ticket.id}).catch(showError);row.append(close);ticketCard.append(row)}manage.append(ticketCard);
const projectCard=el('div',undefined,'card');projectCard.append(el('h3','Projects'));if(!guild.projects.length)projectCard.append(el('p','No open projects.'));for(const project of guild.projects){const row=el('div');row.append(el('p',project.id+' • '+project.title));const states=document.createElement('select');for(const state of ['planning','development','testing','maintenance','paused','archived']){const option=document.createElement('option');option.value=state;option.textContent=state;option.selected=state===project.state;states.append(option)}const save=el('button','Save state');save.onclick=()=>act({action:'project.status',guildId:guild.id,id:project.id,state:states.value}).catch(showError);row.append(states,save);projectCard.append(row)}manage.append(projectCard);
const noteCard=el('div',undefined,'card');noteCard.append(el('h3','Moderation note'));const target=document.createElement('input');target.placeholder='Discord user ID';const note=document.createElement('input');note.placeholder='Internal note';const add=el('button','Create case');add.onclick=()=>act({action:'moderation.note',guildId:guild.id,targetId:target.value,note:note.value}).catch(showError);noteCard.append(labeled('Target',target),labeled('Note',note),add);manage.append(noteCard);content.append(manage)}}
function showError(error){status.className='error';status.textContent=error.message}
async function load(){status.className='';status.textContent='Loading…';content.textContent='';try{snapshot=await request('/api/dashboard');status.textContent='Online • '+snapshot.bot+' • uptime '+snapshot.uptime_seconds+'s';render(snapshot)}catch(error){showError(error)}}document.querySelector('#load').addEventListener('click',load);
</script></body></html>`;

async function readBody(request: IncomingMessage, maximum = 1_048_576): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > maximum) throw new Error('PAYLOAD_TOO_LARGE');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

function verifySignature(body: Buffer, signature: string | undefined, secret: string): boolean {
  if (!signature?.startsWith('sha256=')) return false;
  const expected = Buffer.from(`sha256=${createHmac('sha256', secret).update(body).digest('hex')}`);
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function webhookEmbed(context: BotContext, event: string, payload: GithubPayload): EmbedBuilder | null {
  const repository = payload.repository?.full_name ?? 'Unknown repository';
  const repositoryUrl = payload.repository?.html_url;
  const actor = payload.sender?.login ?? 'GitHub';
  const result = embed(context, `◉ ${repository}`, `GitHub event by **${actor}**`).setColor(0x24292f);
  if (repositoryUrl) result.setURL(repositoryUrl);
  if (payload.sender?.avatar_url) result.setThumbnail(payload.sender.avatar_url);

  if (event === 'ping') {
    return result.setTitle(`✅ GitHub connected • ${repository}`).setDescription('The webhook signature was verified successfully.');
  }
  if (event === 'push') {
    const branch = payload.ref?.replace('refs/heads/', '') ?? 'unknown branch';
    const commits = payload.commits ?? [];
    const lines = commits
      .slice(0, 5)
      .map(
        (commit) =>
          `[\`${commit.id.slice(0, 7)}\`](${commit.url}) ${truncate(commit.message.split('\n')[0] ?? '', 90)}`,
      )
      .join('\n');
    return result
      .setTitle(`⬆️ ${commits.length} ${commits.length === 1 ? 'commit' : 'commits'} pushed to ${branch}`)
      .setDescription(lines || 'A branch update was pushed.')
      .addFields({ name: 'Repository', value: repositoryUrl ? `[${repository}](${repositoryUrl})` : repository });
  }
  if (event === 'pull_request' && payload.pull_request) {
    const pull = payload.pull_request;
    const action = payload.action === 'closed' && pull.merged ? 'merged' : (payload.action ?? 'updated');
    return result
      .setTitle(`🔀 Pull request #${pull.number ?? '?'} ${action}`)
      .setDescription(pull.html_url ? `[${truncate(pull.title ?? 'Untitled pull request', 200)}](${pull.html_url})` : (pull.title ?? 'Untitled pull request'))
      .addFields(
        ...fields([
          ['Author', pull.user?.login ?? actor, true],
          ['Branch', `\`${pull.head?.ref ?? '?'}\` → \`${pull.base?.ref ?? '?'}\``, true],
          ['Action', action, true],
        ]),
      );
  }
  if (event === 'issues' && payload.issue) {
    const issue = payload.issue;
    return result
      .setTitle(`◎ Issue #${issue.number ?? '?'} ${payload.action ?? 'updated'}`)
      .setDescription(issue.html_url ? `[${truncate(issue.title ?? 'Untitled issue', 200)}](${issue.html_url})` : (issue.title ?? 'Untitled issue'))
      .addFields(
        ...fields([
          ['Author', issue.user?.login ?? actor, true],
          ['State', issue.state ?? 'unknown', true],
        ]),
      );
  }
  if (event === 'release' && payload.release) {
    const release = payload.release;
    return result
      .setTitle(`🏷️ Release ${release.tag_name ?? release.name ?? ''} ${payload.action ?? 'published'}`)
      .setDescription(
        release.html_url
          ? `[Open release notes](${release.html_url})`
          : 'A repository release was updated.',
      )
      .addFields(
        ...fields([
          ['Author', release.author?.login ?? actor, true],
          ['Type', release.prerelease ? 'Pre-release' : release.draft ? 'Draft' : 'Stable', true],
        ]),
      );
  }
  return null;
}

async function deliverGithubEvent(context: BotContext, event: string, payload: GithubPayload): Promise<void> {
  const repository = payload.repository?.full_name?.toLowerCase();
  if (!repository) return;
  if (context.config.githubRepositoryFilter.size && !context.config.githubRepositoryFilter.has(repository)) return;
  const card = webhookEmbed(context, event, payload);
  if (!card) return;
  const destinations = context.db.getGithubDestinations();
  await Promise.allSettled(
    destinations.map(async (destination) => {
      const channel = await context.client.channels.fetch(destination.github_channel_id).catch(() => null);
      if (channel?.type === ChannelType.GuildText) await channel.send({ embeds: [card] });
    }),
  );

  const routed: Array<Promise<void>> = [];
  for (const guild of context.client.guilds.cache.values()) {
    const githubActor = payload.pull_request?.user?.login ?? payload.sender?.login;
    if (githubActor && (event === 'pull_request' || event === 'push')) {
      for (const profile of context.db.findProfilesByGithub(guild.id, githubActor)) {
        if (event === 'pull_request') context.db.awardAchievement(guild.id, profile.user_id, 'FIRST_PR');
        context.db.awardAchievement(guild.id, profile.user_id, 'OPEN_SOURCE_CONTRIBUTOR');
        context.v2.addSkillXp(guild.id, profile.user_id, 'backend', event === 'pull_request' ? 25 : 10);
        context.v2.changeCredits(guild.id, profile.user_id, event === 'pull_request' ? 10 : 3, `GitHub ${event}`, repository);
      }
    }
    const subscriptions = context.v2.listItems({ guildId: guild.id, type: 'github_subscription', status: 'active', limit: 100 })
      .filter((item) => String(item.data['repository']).toLowerCase() === repository)
      .filter((item) => String(item.data['events']) === 'all' || String(item.data['events']) === event);
    for (const subscription of subscriptions) {
      routed.push((async () => {
        const channel = await context.client.channels.fetch(String(subscription.data['channelId'])).catch(() => null);
        if (channel?.type === ChannelType.GuildText) await channel.send({ embeds: [card] });
      })());
    }
    if (event === 'release') {
      const releases = context.v2.listItems({ guildId: guild.id, type: 'release_subscription', status: 'active', limit: 100 })
        .filter((item) => String(item.data['repository']).toLowerCase() === repository);
      if (releases.length) {
        context.v2.createItem({
          guildId: guild.id,
          type: 'release_event',
          ownerId: context.client.user.id,
          title: `${repository} • ${payload.release?.tag_name ?? payload.release?.name ?? 'release'}`,
          data: { repository, url: payload.release?.html_url ?? '', action: payload.action ?? 'published' },
          idPrefix: 'release',
        });
      }
      for (const subscription of releases) {
        routed.push((async () => {
          const channel = await context.client.channels.fetch(String(subscription.data['channelId'])).catch(() => null);
          if (channel?.type === ChannelType.GuildText) await channel.send({ embeds: [card] });
        })());
      }
    }
  }
  await Promise.allSettled(routed);
}

export function startGithubWebhookServer(client: Client<true>, context: BotContext): Server {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
    if (request.method === 'GET' && url.pathname === '/health') {
      const database = context.v2.healthCheck();
      json(response, 200, {
        status: database.ok ? 'ok' : 'degraded',
        bot: client.user.tag,
        guilds: client.guilds.cache.size,
        uptime_seconds: Math.floor(process.uptime()),
        database: database.ok ? 'ok' : 'error',
        memory_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      });
      return;
    }
    if (request.method === 'GET' && url.pathname === '/dashboard') {
      if (!context.config.dashboardEnabled) {
        json(response, 404, { error: 'dashboard_disabled' });
        return;
      }
      html(response, 200, DASHBOARD_HTML);
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/dashboard') {
      if (!context.config.dashboardEnabled || !context.config.dashboardToken) {
        json(response, 404, { error: 'dashboard_disabled' });
        return;
      }
      if (!dashboardAuthorized(request, context.config.dashboardToken)) {
        response.setHeader('www-authenticate', 'Bearer');
        json(response, 401, { error: 'unauthorized' });
        return;
      }
      const guilds = client.guilds.cache.map((guild) => {
        const analytics = context.v2.analytics(guild.id, 7);
        const insights = context.db.getInsights(guild.id);
        const projects = context.db.listProjects(guild.id, undefined, undefined, 25).map((project) => {
          const meta = context.v2.listItems({ guildId: guild.id, type: 'project_meta', limit: 100 }).find((item) => item.title === project.id);
          return { id: project.id, title: project.title, state: String(meta?.data['state'] ?? (project.status === 'open' ? 'development' : 'archived')) };
        });
        const tickets = context.v2.listItems({ guildId: guild.id, type: 'ticket', status: 'open', limit: 100 }).map((ticket) => ({ id: ticket.id, title: ticket.title, priority: String(ticket.data['priority'] ?? 'normal') }));
        return {
          id: guild.id,
          name: guild.name,
          metrics: {
            members: guild.memberCount,
            active_members_7d: analytics.activeMembers,
            messages_7d: analytics.messages,
            projects: insights.projects,
            open_reviews: insights.openReviews,
            open_tickets: context.v2.listItems({ guildId: guild.id, type: 'ticket', status: 'open', limit: 100 }).length,
            active_events: context.v2.listItems({ guildId: guild.id, type: 'event', status: 'registration', limit: 100 }).length,
            uptime_monitors: context.v2.listItems({ guildId: guild.id, type: 'monitor', status: 'active', limit: 100 }).length,
          },
          modules: MODULES.map((module) => ({ name: module, enabled: context.v2.isModuleEnabled(guild.id, module) })),
          projects,
          tickets,
        };
      });
      json(response, 200, { bot: client.user.tag, uptime_seconds: Math.floor(process.uptime()), guilds });
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/dashboard/action') {
      if (!context.config.dashboardEnabled || !context.config.dashboardToken) {
        json(response, 404, { error: 'dashboard_disabled' });
        return;
      }
      if (!dashboardAuthorized(request, context.config.dashboardToken)) {
        response.setHeader('www-authenticate', 'Bearer');
        json(response, 401, { error: 'unauthorized' });
        return;
      }
      try {
        const payload = JSON.parse((await readBody(request, 32_768)).toString('utf8')) as Record<string, unknown>;
        const guildId = typeof payload['guildId'] === 'string' ? payload['guildId'] : '';
        const action = typeof payload['action'] === 'string' ? payload['action'] : '';
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
          json(response, 404, { error: 'guild_not_found' });
          return;
        }
        if (action === 'module.toggle') {
          const module = typeof payload['module'] === 'string' ? payload['module'] : '';
          const enabled = payload['enabled'];
          if (!MODULES.includes(module as (typeof MODULES)[number]) || typeof enabled !== 'boolean' || (['permissions', 'diagnostics'].includes(module) && !enabled)) {
            json(response, 400, { error: 'invalid_module_change' });
            return;
          }
          context.v2.setModule(guild.id, module, enabled);
          context.v2.audit(guild.id, client.user.id, 'dashboard.module_toggle', `${module}: ${enabled}`);
          json(response, 200, { ok: true });
          return;
        }
        if (action === 'ticket.close') {
          const id = typeof payload['id'] === 'string' ? payload['id'] : '';
          const ticket = context.v2.getItem(id, 'ticket');
          if (!ticket || ticket.guild_id !== guild.id || ticket.status !== 'open') {
            json(response, 404, { error: 'ticket_not_found' });
            return;
          }
          context.v2.updateItem(ticket.id, { status: 'closed', data: { closedBy: client.user.id } });
          const channel = guild.channels.cache.get(String(ticket.data['channelId']));
          if (channel?.type === ChannelType.GuildText) {
            await channel.permissionOverwrites.edit(ticket.owner_id, { SendMessages: false }).catch(() => null);
            await channel.setName(truncate(`closed-${ticket.id}`, 100)).catch(() => null);
            await channel.send({ embeds: [embed(context, '🔒 Ticket closed from dashboard', 'A staff member closed this ticket through the secure DevForge dashboard.')] }).catch(() => null);
          }
          context.v2.audit(guild.id, client.user.id, 'dashboard.ticket_close', ticket.title, ticket.id);
          json(response, 200, { ok: true });
          return;
        }
        if (action === 'project.status') {
          const id = typeof payload['id'] === 'string' ? payload['id'] : '';
          const state = typeof payload['state'] === 'string' ? payload['state'] : '';
          const allowedStates = ['planning', 'development', 'testing', 'maintenance', 'paused', 'archived'];
          const project = context.db.getProject(id);
          if (!project || project.guild_id !== guild.id || !allowedStates.includes(state)) {
            json(response, 400, { error: 'invalid_project_change' });
            return;
          }
          const meta = context.v2.listItems({ guildId: guild.id, type: 'project_meta', limit: 100 }).find((item) => item.title === project.id);
          if (meta) context.v2.updateItem(meta.id, { data: { state } });
          else context.v2.createItem({ guildId: guild.id, type: 'project_meta', ownerId: project.owner_id, title: project.id, data: { state }, idPrefix: 'pmeta' });
          context.v2.audit(guild.id, client.user.id, 'dashboard.project_status', state, project.id);
          json(response, 200, { ok: true });
          return;
        }
        if (action === 'moderation.note') {
          const targetId = typeof payload['targetId'] === 'string' ? payload['targetId'] : '';
          const note = typeof payload['note'] === 'string' ? payload['note'].trim() : '';
          if (!/^\d{17,20}$/.test(targetId) || note.length < 3 || note.length > 750) {
            json(response, 400, { error: 'invalid_moderation_note' });
            return;
          }
          const moderationCase = context.db.createModerationCase({ guildId: guild.id, targetId, moderatorId: client.user.id, action: 'Dashboard note', reason: note });
          context.v2.audit(guild.id, client.user.id, 'dashboard.moderation_note', note, targetId);
          json(response, 200, { ok: true, case_number: moderationCase.caseNumber });
          return;
        }
        json(response, 400, { error: 'unsupported_action' });
      } catch (error) {
        json(response, error instanceof Error && error.message === 'PAYLOAD_TOO_LARGE' ? 413 : 400, { error: 'invalid_request' });
      }
      return;
    }
    if (request.method !== 'POST' || url.pathname !== '/webhooks/github') {
      json(response, 404, { error: 'not_found' });
      return;
    }
    if (!context.config.githubWebhookSecret) {
      json(response, 503, { error: 'github_webhook_not_configured' });
      return;
    }
    try {
      const body = await readBody(request);
      const signature = request.headers['x-hub-signature-256'];
      const signatureValue = Array.isArray(signature) ? signature[0] : signature;
      if (!verifySignature(body, signatureValue, context.config.githubWebhookSecret)) {
        json(response, 401, { error: 'invalid_signature' });
        return;
      }
      const eventHeader = request.headers['x-github-event'];
      const event = (Array.isArray(eventHeader) ? eventHeader[0] : eventHeader) ?? 'unknown';
      const payload = JSON.parse(body.toString('utf8')) as GithubPayload;
      json(response, 202, { accepted: true });
      void deliverGithubEvent(context, event, payload).catch((error) => {
        context.logger.error('GitHub event delivery failed.', error, { event });
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'PAYLOAD_TOO_LARGE') {
        json(response, 413, { error: 'payload_too_large' });
      } else {
        context.logger.warn('Invalid GitHub webhook request.', { error: String(error) });
        json(response, 400, { error: 'invalid_payload' });
      }
    }
  });

  server.listen(context.config.port, () => {
    context.logger.info('Health, GitHub webhook, and optional dashboard server listening.', {
      port: context.config.port,
      dashboard: context.config.dashboardEnabled,
    });
  });
  return server;
}

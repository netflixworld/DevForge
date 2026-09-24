# Security Notes

[English](#english) · [Português](#português)

## English

- Never commit `.env`, Discord tokens, GitHub tokens, webhook secrets, private keys, or the SQLite database.
- Rotate the Discord token immediately if it appears in a screenshot, chat, log, or public repository.
- The bot never needs the Discord `Administrator` permission. Grant only the permissions listed in `SETUP-PTBR.md`.
- Keep the bot role below server owners and above only the roles it must create or manage.
- GitHub webhooks use SHA-256 HMAC verification with constant-time comparison and a 1 MiB payload limit.
- The optional dashboard is disabled by default, requires a secret of at least 24 characters, uses constant-time token comparison, exposes only allowlisted actions, and records mutations in the audit log.
- Do not pass the dashboard token in URLs. Enter it only into the dashboard password field; API requests send it in an authorization header.
- Uptime monitoring accepts only HTTP(S) targets, rejects local/private addresses, validates DNS answers, limits redirects, and applies request timeouts. Keep network egress restricted in production as an additional defense.
- Automatic anti-raid quarantine is disabled until configured with `/security configure`. Review thresholds before enabling it.
- The permission matrix does not override Discord's own permission checks. Administrators and members with Manage Server keep a safety bypass.
- `GITHUB_REPOSITORY_FILTER` can restrict which repositories are allowed to publish events.
- Project, snippet, profile, and stand-up input is displayed as plain text inside Discord embeds. Discord mentions are controlled by the client-wide allowed-mentions policy.
- Public snippets and debugging briefs must never contain API keys, access tokens, customer information, or private source code.
- SQLite should be backed up from the `data` directory while the bot is stopped or through a filesystem snapshot that supports WAL databases.
- Ticket transcripts may contain message content and attachments. Store them only in staff-controlled channels and follow your retention policy.
- Internal credits are community points only and must not be presented as money, cryptocurrency, or a redeemable financial asset.
- Run `npm audit` and `npm run check` before deploying dependency updates.

To report a vulnerability, use GitHub's private vulnerability reporting if the repository enables it, or contact the project owner privately through an existing trusted channel. Do not publish exploit details or real tokens in a community server or public issue.

## Português

- Nunca publique `.env`, tokens Discord/GitHub, segredos de webhooks, chaves privadas ou o banco SQLite.
- Se um token aparecer em conversa, print, log ou repositório público, troque-o imediatamente no serviço correspondente.
- O bot não precisa da permissão `Administrator`. Conceda apenas as permissões exigidas pelos módulos usados e mantenha o cargo do bot acima dos cargos que ele gerencia.
- Webhooks do GitHub verificam a assinatura HMAC SHA-256; configure um segredo único e forte.
- O dashboard vem desligado, usa um token de pelo menos 24 caracteres e deve ser servido por HTTPS. Não envie o token por URLs ou mensagens no Discord.
- Monitores de uptime rejeitam endereços locais/privados e têm limites de redirecionamento e tempo. Restrinja saídas de rede na hospedagem quando possível.
- A quarentena anti-raid vem desligada até ser configurada em `/security configure`. Revise os limites antes de ativar.
- O sistema de permissões interno não dispensa as permissões do Discord. Administradores e membros com Gerenciar Servidor podem acessar os controles administrativos.
- Snippets, perfis, tickets e logs podem conter dados pessoais ou código privado. Não coloque senhas, tokens ou informações de clientes em conteúdo público.
- Para backup de SQLite em modo WAL, pare o bot ou use uma ferramenta de backup online compatível. Guarde `.env`, `data` e transcripts em lugar protegido.
- Créditos são apenas pontos da comunidade, sem valor monetário.
- Antes de atualizar dependências, execute `npm audit` e `npm run check`.

Relate vulnerabilidades pelo mecanismo privado do GitHub, se estiver ativado, ou diretamente ao responsável por um canal privado de confiança. Não publique detalhes de exploração ou segredos em issues públicas ou no servidor.

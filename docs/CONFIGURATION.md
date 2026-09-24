# Configuration / Configuração

[English](#english) · [Português](#português)

## English

Copy `.env.example` to `.env` and edit the copy. Keep `.env` on the machine running the bot. All keys below are read at startup, so restart the bot after changes.

| Key | Required | Purpose and default |
| --- | --- | --- |
| `DISCORD_TOKEN` | Yes | Private bot token from the Developer Portal. |
| `DISCORD_CLIENT_ID` | Yes | Discord Application ID used to register commands. |
| `DISCORD_GUILD_ID` | Recommended for testing | Registers commands only in this server; leave unset for global command registration. |
| `BOT_NAME` | No | Display setting, default `DevForge`. It does not rename the Discord application by itself. |
| `BOT_STATUS` | No | Presence text, default `Building better software together`. |
| `PRIMARY_COLOR`, `ACCENT_COLOR` | No | Embed colors in hex; defaults `#5865F2` and `#22D3EE`. |
| `DATABASE_PATH` | No | SQLite file path; default `./data/devforge.sqlite`. Preserve this directory across updates. |
| `PORT` | No | HTTP server port; default `3000`. |
| `DASHBOARD_ENABLED` | No | Set `true` to enable the web dashboard; default `false`. |
| `DASHBOARD_TOKEN` | When dashboard enabled | Secret with at least 24 characters. Use a unique random value. |
| `PUBLIC_BASE_URL` | For public dashboard/webhooks | Public HTTPS base URL used in setup links, without `/webhooks/github`. It does not configure HTTPS itself. |
| `GITHUB_WEBHOOK_SECRET` | For webhook events | Random secret that must also be entered in each GitHub webhook. |
| `GITHUB_TOKEN` | No | Optional GitHub API token for increased API limits when inspecting repositories or users. |
| `GITHUB_REPOSITORY_FILTER` | No | Comma-separated `owner/repo` allowlist for incoming webhook delivery. |
| `LOG_LEVEL` | No | `debug`, `info`, `warn`, or `error`; default `info`. |

Example for a local test server:

```dotenv
DISCORD_TOKEN=your_private_bot_token
DISCORD_CLIENT_ID=your_application_id
DISCORD_GUILD_ID=your_test_server_id
BOT_STATUS=Building better software together
DATABASE_PATH=./data/devforge.sqlite
PORT=3000
DASHBOARD_ENABLED=false
LOG_LEVEL=info
```

**Never paste real values into issues, pull requests, screenshots, or GitHub Actions logs.** The `.gitignore` excludes `.env` and `data`. If a token has leaked, rotate it at the provider and update your local `.env`.

### Per-server options

After startup, use Discord commands to configure each server without editing code:

| Command | Scope |
| --- | --- |
| `/config view`, `/config channel`, `/config role`, `/config feature` | Existing channels, roles, and legacy feature switches. |
| `/modules list`, `/modules toggle` | Enable or disable a feature group per server. |
| `/permissions set`, `/permissions list` | Allow or deny particular roles for a command. Discord permissions still apply. |
| `/security view`, `/security configure` | Raid thresholds, account age alerts, mention limits, mass role detection. Anti-raid quarantine is off by default. |
| `/ticket panel` | Support role, ticket category, transcript destination, and inactivity timeout. |
| `/onboarding setup`, `/rolemenu create` | Verification/technology roles and member-selectable roles. |
| `/voice setup`, `/autothread add`, `/digest configure`, `/standups schedule` | Channel-specific automations. |

Every optional module starts enabled unless a manager switches it off. GitHub webhook events require a configured secret and publicly reachable HTTPS endpoint. The dashboard needs its own secret and should be exposed only behind HTTPS.

## Português

Copie `.env.example` para `.env` e edite somente a cópia. Guarde `.env` no computador ou servidor que executa o bot. Reinicie o bot após alterar essas opções.

| Chave | Obrigatória | Uso e padrão |
| --- | --- | --- |
| `DISCORD_TOKEN` | Sim | Token privado do bot no Developer Portal. |
| `DISCORD_CLIENT_ID` | Sim | Application ID usado no registro dos comandos. |
| `DISCORD_GUILD_ID` | Recomendado em testes | Registra comandos apenas neste servidor; deixe sem valor para registro global. |
| `BOT_NAME` | Não | Nome de configuração; padrão `DevForge`. Não altera sozinho o nome da aplicação no Discord. |
| `BOT_STATUS` | Não | Texto da presença do bot. |
| `PRIMARY_COLOR`, `ACCENT_COLOR` | Não | Cores das mensagens em hexadecimal. |
| `DATABASE_PATH` | Não | Caminho do SQLite, padrão `./data/devforge.sqlite`. Preserve essa pasta nas atualizações. |
| `PORT` | Não | Porta HTTP, padrão `3000`. |
| `DASHBOARD_ENABLED` | Não | `true` liga o painel web; padrão `false`. |
| `DASHBOARD_TOKEN` | Se o painel estiver ligado | Segredo aleatório único com pelo menos 24 caracteres. |
| `PUBLIC_BASE_URL` | Para painel/webhooks públicos | Endereço HTTPS usado nas instruções; não instala HTTPS automaticamente. |
| `GITHUB_WEBHOOK_SECRET` | Para webhooks | Segredo que também será cadastrado em cada webhook do GitHub. |
| `GITHUB_TOKEN` | Não | Token opcional para aumentar limites da API do GitHub. |
| `GITHUB_REPOSITORY_FILTER` | Não | Lista `dono/repositorio` separada por vírgulas para filtrar webhooks. |
| `LOG_LEVEL` | Não | `debug`, `info`, `warn` ou `error`; padrão `info`. |

Exemplo de `.env` para testes:

```dotenv
DISCORD_TOKEN=seu_token_privado
DISCORD_CLIENT_ID=id_da_sua_aplicacao
DISCORD_GUILD_ID=id_do_servidor_de_teste
DASHBOARD_ENABLED=false
LOG_LEVEL=info
```

**Não publique valores reais em issues, pull requests, prints ou logs.** O `.gitignore` ignora `.env` e `data`. Se algum segredo vazou, gere outro no serviço correspondente e atualize o `.env` local.

### Ajustes por servidor

Você pode configurar cada servidor dentro do Discord:

| Comando | Uso |
| --- | --- |
| `/config view`, `/config channel`, `/config role`, `/config feature` | Canais, cargos e funções antigas. |
| `/modules list`, `/modules toggle` | Liga ou desliga grupos de recursos por servidor. |
| `/permissions set`, `/permissions list` | Regras de cargos por comando. As permissões do próprio Discord continuam valendo. |
| `/security view`, `/security configure` | Raid, contas novas, excesso de menções e alterações em massa de cargos. A quarentena anti-raid vem desligada. |
| `/ticket panel` | Cargo de suporte, categoria, transcript e fechamento por inatividade. |
| `/onboarding setup`, `/rolemenu create` | Verificação, cargos de tecnologia e menus de cargos. |
| `/voice setup`, `/autothread add`, `/digest configure`, `/standups schedule` | Automações dos canais. |

Os módulos opcionais começam ligados até que um gestor os desative. Para receber webhooks do GitHub é preciso um segredo e endereço HTTPS público. O painel web exige seu próprio segredo e também deve usar HTTPS.

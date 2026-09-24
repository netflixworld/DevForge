# Hosting and backups / Hospedagem e backups

[English](#english) · [Português](#português)

## English

GitHub holds the source code and CI results. It does **not** keep this bot online. Run one bot process on a PC, VPS, or hosting service with Node.js 24.17+ and persistent storage. Do not run two copies against the same Discord application and SQLite file at the same time.

### Windows PC

Run `INSTALL_WINDOWS.bat` once, configure `.env`, run `REGISTER_COMMANDS.bat`, then run `START_BOT.bat`. Keep the window and computer running. This is convenient for development but will stop when your PC sleeps or shuts down.

### Linux or VPS

```bash
npm ci
cp .env.example .env
# Set DISCORD_TOKEN and DISCORD_CLIENT_ID in .env
npm run check
npm run deploy:commands
npm start
```

For continuous service, run `npm start` under a process supervisor such as systemd, keep the working directory at the project root, restart after configuration changes, and persist the `data` directory. Start the service only after the command registration step completes. Send runtime logs to your supervisor and restrict their access.

### Docker Compose

```bash
cp .env.example .env
# Fill in required values in .env
docker compose up -d --build
docker compose logs -f devforge
```

The included Compose file mounts `./data` into the container and publishes the HTTP port as `3000:3000`. Keep `data` on durable storage. To update after pulling new code, stop the bot, back up `.env` and `data`, then rebuild. Use a one-off Node/npm environment to run `npm run deploy:commands` when command definitions change; the running production container installs production dependencies only and cannot run the TypeScript registration script. Alternatively, register from a local developer checkout using the same Discord application token.

### HTTP, webhooks, dashboard

- `GET /health` provides a basic health check.
- `POST /webhooks/github` receives signed GitHub events when configured.
- `/dashboard` and `/api/dashboard` are available only when the dashboard is enabled.

For public GitHub webhooks or dashboard access, put the HTTP port behind an HTTPS reverse proxy and set `PUBLIC_BASE_URL`. The dashboard uses a single shared admin token: keep it private, limit who can reach the service, and avoid exposing an unencrypted `http://` port publicly. Webhooks need an inbound public HTTPS URL; `/github repo` works without one. See [GitHub integration](GITHUB-INTEGRATION.md).

### Back up and restore

1. Stop the bot or use a SQLite-aware online backup method. SQLite uses WAL mode, so copying just the `.sqlite` file while it is running can produce an incomplete backup.
2. Save **both** the `.env` file and the entire `data` folder securely, including any SQLite companion files that remain after shutdown.
3. Restore both into a fresh installation, run `npm ci` and `npm run build`, then start the bot. Register commands if command definitions changed.
4. Keep backup copies private. Profiles, moderation cases, and ticket-related data may be personal information.

The 2.0 migration adds tables and preserves 1.0 data. Read [the upgrade guide](../UPGRADE-V2-PTBR.md) before replacing an older installation.

## Português

O GitHub guarda o código e mostra o resultado dos testes. Ele **não mantém o bot online**. Execute uma única cópia no PC, VPS ou hospedagem com Node.js 24.17+ e armazenamento persistente. Evite dois processos usando a mesma aplicação e o mesmo arquivo SQLite ao mesmo tempo.

### Windows

Execute `INSTALL_WINDOWS.bat` uma vez, preencha `.env`, execute `REGISTER_COMMANDS.bat` e depois `START_BOT.bat`. Deixe a janela e o computador ligados. Quando o PC suspender ou desligar, o bot ficará offline.

### Linux ou VPS

```bash
npm ci
cp .env.example .env
# Preencha DISCORD_TOKEN e DISCORD_CLIENT_ID no .env
npm run check
npm run deploy:commands
npm start
```

Para deixar online continuamente, use um gerenciador de processos como systemd, inicie o processo na raiz do projeto, preserve a pasta `data` e reinicie após alterar configurações. Registre comandos antes de ligar o serviço. Proteja o acesso aos logs.

### Docker Compose

```bash
cp .env.example .env
# Preencha o .env
docker compose up -d --build
docker compose logs -f devforge
```

O Compose incluído monta `./data` e publica a porta HTTP como `3000:3000`. Para atualizar, pare o bot, faça backup de `.env` e `data` e reconstrua a imagem. Ao mudar comandos, faça o registro com um ambiente Node/npm separado; o contêiner final instala apenas dependências de produção e não executa o script TypeScript de registro. Você também pode registrar os comandos em uma cópia local do projeto usando o mesmo token.

### HTTP, webhooks e painel

- `GET /health`: verificação básica do serviço.
- `POST /webhooks/github`: eventos assinados do GitHub.
- `/dashboard` e `/api/dashboard`: painel opcional quando ativado.

Para receber webhooks públicos ou acessar o painel, use um proxy HTTPS e ajuste `PUBLIC_BASE_URL`. O painel usa um único token administrativo: proteja esse segredo e restrinja o acesso à porta. Evite expor HTTP sem criptografia na internet. O comando `/github repo` funciona sem webhook. Veja [Integração com GitHub](GITHUB-INTEGRATION.md).

### Backup e restauração

1. Pare o bot ou use um método de backup online compatível com SQLite. Como o banco usa WAL, copiar só o `.sqlite` enquanto está em uso pode gerar um backup incompleto.
2. Guarde **o `.env` e a pasta `data` inteira** em local protegido.
3. Restaure ambos em uma instalação nova, execute `npm ci` e `npm run build`, então ligue o bot. Registre os comandos se eles mudaram.
4. Não publique backups: perfis, casos de moderação e tickets podem conter dados pessoais.

Na versão 2.0, a migração adiciona tabelas sem apagar dados da 1.0. Leia o [guia de atualização](../UPGRADE-V2-PTBR.md).

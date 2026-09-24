# GitHub integration / Integração com GitHub

[English](#english) · [Português](#português)

## English

**Publishing this code to GitHub and connecting GitHub events to Discord are separate steps.** The repository can be public without giving the bot your GitHub password. `/github repo` and `/github user` inspect public information without a webhook. For a higher API limit, you may add a read-only `GITHUB_TOKEN` locally; never commit it.

### Automatic repository events and releases

1. Host the bot so its HTTP server is reachable through HTTPS, for example `https://bot.example.com` with `PORT=3000` behind a reverse proxy. Set `PUBLIC_BASE_URL` to this public base URL.
2. Generate a long random secret. Set `GITHUB_WEBHOOK_SECRET` in your private `.env` and restart the bot. Optionally set `GITHUB_REPOSITORY_FILTER=owner/repository` to allow only selected repositories.
3. In the repository on GitHub, go to **Settings → Webhooks → Add webhook**. Set the payload URL to `https://bot.example.com/webhooks/github`, content type to `application/json`, and **Secret** to exactly the same value as `GITHUB_WEBHOOK_SECRET`.
4. Choose the events you want: **Pushes**, **Pull requests**, **Issues**, and **Releases**. Activate the webhook. GitHub normally sends a ping after creation; the bot verifies its SHA-256 signature before accepting it.
5. In Discord, run `/config bootstrap` to select `#dev-updates` as the default GitHub channel. Use `/github subscribe` for specific repository events in a chosen channel and `/release subscribe` for release notifications. Run `/github subscriptions` and `/release list` to review the routes.

You need repository administrator access to add a webhook. GitHub's [webhook guide](https://docs.github.com/en/webhooks/using-webhooks/creating-webhooks) explains the current interface, and its [signature guide](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries) explains `X-Hub-Signature-256`.

**Troubleshooting:** Check GitHub's recent deliveries for status codes; confirm the public HTTPS URL, shared secret, JSON content type, allowed repository filter, and the bot's permission to post in the destination channel. A GitHub webhook configured against `localhost` or a computer without a public HTTPS route cannot reach your bot. Keep the secret private and rotate it if exposed.

## Português

**Publicar o código no GitHub e receber eventos dele no Discord são etapas diferentes.** O repositório pode ser público sem entregar sua senha do GitHub ao bot. `/github repo` e `/github user` consultam informações públicas sem webhook. Um `GITHUB_TOKEN` local e somente leitura pode aumentar o limite da API; nunca publique esse token.

### Eventos automáticos e releases

1. Hospede o bot com um endereço HTTPS público, como `https://bot.exemplo.com`, encaminhando para `PORT=3000`. Coloque esse endereço em `PUBLIC_BASE_URL`.
2. Gere um segredo aleatório longo. Salve em `GITHUB_WEBHOOK_SECRET` no seu `.env` privado e reinicie o bot. Se quiser aceitar só alguns repositórios, use `GITHUB_REPOSITORY_FILTER=dono/repositorio`.
3. No repositório GitHub, abra **Settings → Webhooks → Add webhook**. Use `https://bot.exemplo.com/webhooks/github` como destino, `application/json` como formato e o mesmo segredo no campo **Secret**.
4. Selecione os eventos **Pushes**, **Pull requests**, **Issues** e **Releases**, conforme seu interesse. Ative o webhook. O GitHub costuma enviar um ping inicial; o bot confere a assinatura SHA-256 antes de aceitar eventos.
5. No Discord, use `/config bootstrap` para selecionar `#dev-updates` como canal padrão. Configure destinos por repositório com `/github subscribe` e avisos de versões com `/release subscribe`. Confira com `/github subscriptions` e `/release list`.

É necessário ter acesso de administrador ao repositório para criar um webhook. Veja o [guia oficial de webhooks](https://docs.github.com/pt/webhooks/using-webhooks/creating-webhooks) e o [guia de assinatura](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries).

**Se não funcionar:** verifique as entregas recentes do webhook no GitHub, status HTTP, endereço HTTPS público, segredo, formato JSON, filtro de repositórios e permissão para o bot escrever no canal. `localhost` ou um PC sem endereço público acessível não recebe webhooks externos. Proteja o segredo e troque-o se vazar.

# Instalação do DevForge no Windows

O bot funciona no Windows 10/11 e permanece online enquanto o computador ou servidor estiver ligado. Toda a interface usada no Discord está em inglês.

## 1. Criar a aplicação no Discord

1. Acesse o [Discord Developer Portal](https://discord.com/developers/applications).
2. Clique em **New Application**, escolha o nome e abra a seção **Bot**.
3. Crie o bot caso o portal solicite.
4. Em **Privileged Gateway Intents**, ative:
   - **Server Members Intent**
   - **Message Content Intent**
5. Clique em **Reset Token** somente quando precisar gerar o token. Copie-o diretamente para o arquivo `.env`. Nunca envie o token em chats, prints ou arquivos públicos.
6. Na página **General Information**, copie o **Application ID**.

## 2. Convidar o bot

No Developer Portal, abra **OAuth2 → URL Generator**:

- Scopes: `bot` e `applications.commands`.
- Bot permissions:
  - View Channels
  - Send Messages
  - Embed Links
  - Attach Files
  - Read Message History
  - Add Reactions
  - Manage Messages
  - Ban Members
  - Kick Members
  - Moderate Members
  - Manage Nicknames
  - View Audit Log
  - Manage Roles
  - Manage Channels
  - Create Public Threads
  - Create Private Threads
  - Send Messages in Threads
  - Manage Threads
  - Move Members

Abra o link gerado e selecione seu servidor. Não é necessário conceder `Administrator`.

## 3. Preparar os arquivos

1. Extraia o ZIP em uma pasta comum, como `Documentos\DevForge`.
2. Execute `INSTALL_WINDOWS.bat`.
3. O instalador criará `.env` a partir do modelo e instalará as dependências.
4. Abra `.env` com o Bloco de Notas e preencha:

   ```env
   DISCORD_TOKEN=seu_token
   DISCORD_CLIENT_ID=id_da_aplicacao
   DISCORD_GUILD_ID=id_do_servidor_de_teste
   ```

Para copiar o ID do servidor, ative **Configurações do Discord → Avançado → Modo desenvolvedor**, clique com o botão direito no ícone do servidor e use **Copiar ID do servidor**.

## 4. Registrar e iniciar

1. Execute `REGISTER_COMMANDS.bat` uma vez sempre que os comandos forem modificados. O registrador mantém uma única coleção no servidor e remove comandos globais antigos da mesma aplicação para evitar duplicatas.
2. Execute `START_BOT.bat` para ligar o bot.
3. No Discord, use `/config bootstrap`.

Depois do bootstrap, finalize a versão 2.0 com:

```text
/onboarding setup
/ticket panel
/modules list
/security view
/health
```

O bootstrap cria, sem duplicar itens existentes:

- Community Moderator
- Code Mentor
- Verified Developer
- Dev Events
- Community Support
- Event Organizer
- Hackathon Judge
- welcome
- dev-chat
- project-showcase
- code-review
- pair-programming
- daily-challenge
- dev-updates
- dev-logs
- knowledge-base
- suggestions
- events
- support
- starboard
- mod-log privado

Se o bootstrap informar falta de permissão, mova o cargo do bot acima dos cargos criados e confirme as permissões `Manage Roles` e `Manage Channels`.

## 5. Deixar online

No computador, a janela de `START_BOT.bat` precisa permanecer aberta. Para funcionamento 24 horas, use um VPS, Docker ou outro serviço compatível com Node.js 24 e armazenamento persistente.

## GitHub opcional

O comando `/github repo` funciona sem configuração extra. Para receber pushes, pull requests, issues e releases automaticamente:

1. Crie uma senha aleatória longa e coloque-a em `GITHUB_WEBHOOK_SECRET` no `.env`.
2. Use `/config channel purpose:GitHub events` no Discord.
3. Exponha a porta configurada em `PORT` por HTTPS.
4. No repositório GitHub, crie um webhook apontando para:

   ```text
   https://seu-endereco/webhooks/github
   ```

5. Use `application/json` e a mesma senha no campo **Secret**.

O bot valida a assinatura HMAC antes de aceitar qualquer evento. Opcionalmente, `GITHUB_REPOSITORY_FILTER` limita os repositórios aceitos.

## Dashboard opcional

O painel vem desligado. Para ativá-lo, configure `DASHBOARD_ENABLED=true`, crie um `DASHBOARD_TOKEN` exclusivo com pelo menos 24 caracteres e reinicie o bot. Use `/dashboard` para consultar o endereço. Nunca envie esse token no Discord ou em prints.

## Atualização

Se você já usa a versão 1.0, siga primeiro [UPGRADE-V2-PTBR.md](UPGRADE-V2-PTBR.md).

Antes de substituir os arquivos, preserve `.env` e a pasta `data`. Depois execute:

```text
npm install
npm run check
npm run deploy:commands
```

O banco é inicializado automaticamente e não requer painel externo.

## Comandos aparecem duplicados

Isso acontece quando a mesma aplicação possui uma cópia global e outra específica do servidor. Confirme que `DISCORD_GUILD_ID` contém o ID correto do seu servidor e execute `REGISTER_COMMANDS.bat` novamente. A versão 2.1.1 ou superior remove automaticamente as cópias globais antigas antes de sincronizar os 78 comandos do servidor. Depois, pressione `Ctrl + R` no Discord ou feche e abra o aplicativo.

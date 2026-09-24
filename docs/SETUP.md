# Bot setup / Instalação do bot

[English](#english) · [Português](#português)

## English

### 1. Create your Discord application

1. Open the [Discord Developer Portal](https://discord.com/developers/applications) and create an application named **DevForge** (or your preferred name).
2. Open **Bot**. Create a bot if prompted, copy its token into a local `.env` file, and keep the token private. Copy the **Application ID** from General Information.
3. Under the bot's privileged gateway intents, enable **Server Members Intent** and **Message Content Intent**. The bot also uses Guild Voice States, which is configured in code.
4. In the application's installation settings, allow **Guild Install**. Create an installation link with the `bot` and `applications.commands` scopes and the permissions below. The portal may generate a link automatically.

**Bot permissions to select:** View Channels, Send Messages, Embed Links, Attach Files, Read Message History, Add Reactions, Manage Messages, Ban Members, Kick Members, Moderate Members, Manage Nicknames, View Audit Log, Manage Roles, Manage Channels, Create Public Threads, Create Private Threads, Send Messages in Threads, Manage Threads, and Move Members. Features only work where the bot has the corresponding permission; **Administrator is not required**. Invite the bot with the generated link and select your server.

### 2. Configure the project

Install Node.js **24.17.0 or newer**. Download this repository, then use the Windows files or terminal commands:

| Windows 10/11 | Terminal, macOS, or Linux |
| --- | --- |
| Run `INSTALL_WINDOWS.bat`. It installs dependencies, builds the bot, and opens `.env`. | Run `npm ci`, then `cp .env.example .env`, then `npm run build`. |

Set these three values in `.env`:

```dotenv
DISCORD_TOKEN=your_private_bot_token
DISCORD_CLIENT_ID=your_application_id
DISCORD_GUILD_ID=your_test_server_id
```

Turn on **Developer Mode** in Discord settings, right-click the server icon, and copy its ID. The `DISCORD_GUILD_ID` value registers commands in that one server for rapid testing. To register globally later, remove the value and run the registration script again. Read [Configuration](CONFIGURATION.md) for all other settings.

### 3. Register commands and start

| Windows | Terminal |
| --- | --- |
| Run `REGISTER_COMMANDS.bat`, then `START_BOT.bat`. | Run `npm run deploy:commands`, then `npm start`. |

When the bot logs that it is online, try `/ping` and `/health` in your server. Run `/config bootstrap` to create the default channels and roles, `/onboarding setup` in the welcome channel, and `/ticket panel` in the support channel. See [Server blueprint](SERVER-BLUEPRINT.md).

Register commands again whenever command names or options change. If commands still appear old, refresh Discord and make sure the application ID and guild ID point to the intended bot/server. For a global registration, Discord may take longer to display updates than a test-server registration.

### Common problems

| Symptom | Check |
| --- | --- |
| `Missing required environment variable` | `.env` exists in the project root and contains a real token and application ID. |
| Bot fails to connect | Token is current; privileged intents requested by the code are enabled in the portal. |
| Commands are missing | Run `REGISTER_COMMANDS.bat` / `npm run deploy:commands` and confirm the guild ID. |
| Role or channel operation fails | Bot has the relevant permission and its role is above roles it needs to manage. |
| Bot goes offline | Keep the process running, or use a host from [Deployment](DEPLOYMENT.md). GitHub does not run the bot. |

For a 1.0 installation, follow [the upgrade guide](../UPGRADE-V2-PTBR.md) before copying files.

## Português

### 1. Crie a aplicação no Discord

1. Abra o [Discord Developer Portal](https://discord.com/developers/applications) e crie uma aplicação chamada **DevForge** (ou outro nome de sua preferência).
2. Abra **Bot**, crie o bot se necessário e copie o token diretamente para seu `.env` local. Copie o **Application ID** em General Information. Não compartilhe o token.
3. Em **Privileged Gateway Intents**, ative **Server Members Intent** e **Message Content Intent**. O código já inclui Guild Voice States para as salas temporárias.
4. Nas opções de instalação, permita **Guild Install** e gere o convite com os escopos `bot` e `applications.commands` e as permissões abaixo. O portal também pode gerar o link automaticamente.

**Permissões do bot:** View Channels, Send Messages, Embed Links, Attach Files, Read Message History, Add Reactions, Manage Messages, Ban Members, Kick Members, Moderate Members, Manage Nicknames, View Audit Log, Manage Roles, Manage Channels, Create Public Threads, Create Private Threads, Send Messages in Threads, Manage Threads e Move Members. Cada função precisa das permissões correspondentes; **Administrator não é necessário**. Abra o convite e selecione seu servidor.

### 2. Configure o projeto

Instale Node.js **24.17.0 ou superior**. Baixe este repositório e escolha um caminho:

| Windows 10/11 | Terminal, macOS ou Linux |
| --- | --- |
| Execute `INSTALL_WINDOWS.bat`. Ele instala as dependências, compila o bot e abre o `.env`. | Execute `npm ci`, depois `cp .env.example .env`, e então `npm run build`. |

Preencha no `.env`:

```dotenv
DISCORD_TOKEN=seu_token_privado
DISCORD_CLIENT_ID=id_da_sua_aplicacao
DISCORD_GUILD_ID=id_do_seu_servidor_de_teste
```

Ative **Modo desenvolvedor** nas configurações do Discord, clique com o botão direito no servidor e copie o ID. `DISCORD_GUILD_ID` registra os comandos nesse servidor de teste. Para registro global, remova o valor e execute o registro novamente. Os demais campos estão em [Configuração](CONFIGURATION.md).

### 3. Registre e ligue o bot

| Windows | Terminal |
| --- | --- |
| Execute `REGISTER_COMMANDS.bat` e depois `START_BOT.bat`. | Execute `npm run deploy:commands` e depois `npm start`. |

Quando aparecer a mensagem de que o bot está online, teste `/ping` e `/health`. Em seguida, use `/config bootstrap`, `/onboarding setup` no canal de boas-vindas e `/ticket panel` no canal de suporte. Veja a [estrutura do servidor](SERVER-BLUEPRINT.md).

Registre os comandos novamente após alterar nomes ou opções. Se os comandos ainda aparecerem antigos, atualize o Discord e confira Application ID e Guild ID. O registro global pode demorar mais para aparecer do que o registro no servidor de teste.

### Problemas comuns

| Sintoma | O que conferir |
| --- | --- |
| `Missing required environment variable` | O `.env` está na raiz e contém token e Application ID válidos. |
| Bot não conecta | Token atual e intents privilegiados ativados no portal. |
| Comandos não aparecem | Execute o registro e confirme o ID do servidor. |
| Cargos ou canais falham | Permissões do bot e posição do cargo dele na hierarquia. |
| Bot fica offline | Deixe o processo aberto ou use uma hospedagem. GitHub sozinho não mantém o bot online. |

Se você usa a versão 1.0, siga primeiro o [guia de atualização](../UPGRADE-V2-PTBR.md).

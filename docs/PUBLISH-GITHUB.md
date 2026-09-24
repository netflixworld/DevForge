# Publishing DevForge to GitHub / Publicando o DevForge no GitHub

[English](#english) · [Português](#português)

## English

Use **one repository named `devforge`** for the bot source and server guides. GitHub does not create your Discord server, install the bot in it, or host the bot process. The account owner chooses whether the repository is public or private.

### Before publishing

1. Check the folder contents. This project includes source, documentation, and `.env.example`. It must **not** include `.env`, `data` contents, real tokens, server backups, or `node_modules`.
2. Choose the **GitHub Desktop** path below to create and publish directly, or the **terminal** path to create an empty repository on GitHub first. Do not create the same repository twice.
3. Choose public or private visibility yourself. A useful description is: `A modular Discord bot and community blueprint for developers.`

### Easiest path on Windows: GitHub Desktop

1. Extract the project to a folder such as `Documents\DevForge` and open GitHub Desktop while signed in to your GitHub account. Do **not** create an empty repository on the GitHub website for this path.
2. Select **File → Add Local Repository** and choose the extracted folder. If GitHub Desktop says it is not a repository, choose **Create a Repository** in that folder.
3. Confirm that the Changes list contains **no `.env` or `data` database files**. Create the first commit with a message such as `Initial DevForge release`.
4. Choose **Publish repository**, name it `devforge`, and select public or private visibility. Confirm the README, `src/`, `docs/`, and `.github/workflows/ci.yml` appear on GitHub.

### Terminal alternative

First, create an empty repository named `devforge` on GitHub. Leave **Add a README**, **Add .gitignore**, and **Choose a license** unchecked because these files are already in the project. Then, from the extracted project folder:

```bash
git init -b main
git add .
git status --short
git commit -m "Initial DevForge release"
git remote add origin https://github.com/YOUR_USERNAME/devforge.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual account name. Sign in through GitHub Desktop, Git Credential Manager, or another supported credential method; never paste an access token into a command, repository URL, commit, or screenshot. If the folder is already a git repository, skip `git init` and inspect `git remote -v` before adding a remote. GitHub's [repository guide](https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository) has the current web UI steps.

### After publishing

- Open the **Actions** tab and check that Node CI passes. The workflow runs tests/build without Discord secrets; it does not deploy the bot.
- Keep issues and pull requests enabled if you want outside contributions. Consider Discussions for community questions and branch protection for `main`.
- Add the actual Discord server invite and bot installation link to the repository's About section **only after you create them**. Do not put a token in either link.
- Host the process following [Deployment](DEPLOYMENT.md), then register commands. A successful GitHub push does not turn the bot on.
- To connect project updates from this GitHub repository to Discord, follow [GitHub integration](GITHUB-INTEGRATION.md).

## Português

Use **um repositório chamado `devforge`** para o código do bot e os guias do servidor. O GitHub não cria o servidor Discord, não instala o bot e não mantém o processo ligado. Você escolhe se o repositório será público ou privado.

### Antes de publicar

1. Confira os arquivos da pasta. O projeto deve conter código, documentação e `.env.example`, mas **não** `.env`, banco da pasta `data`, tokens reais, backups ou `node_modules`.
2. Escolha o caminho pelo **GitHub Desktop** para criar e publicar diretamente, ou o caminho pelo **terminal** para criar primeiro um repositório vazio no site. Não crie o mesmo repositório duas vezes.
3. Escolha se será público ou privado. Sugestão de descrição: `A modular Discord bot and community blueprint for developers.`

### Jeito mais simples no Windows: GitHub Desktop

1. Extraia o projeto em `Documentos\DevForge` e abra o GitHub Desktop conectado à sua conta. **Não crie previamente um repositório vazio pelo site** nesse caminho.
2. Escolha **File → Add Local Repository** e selecione a pasta. Se o aplicativo avisar que ainda não é um repositório, use **Create a Repository** nessa pasta.
3. Na lista de alterações, confira que **não há `.env` nem banco da pasta `data`**. Crie o primeiro commit com a mensagem `Initial DevForge release`.
4. Escolha **Publish repository**, dê o nome `devforge` e selecione a visibilidade pública ou privada. Confira no site se aparecem README, `src/`, `docs/` e `.github/workflows/ci.yml`.

### Alternativa pelo terminal

Crie primeiro um repositório vazio chamado `devforge` no site GitHub, sem selecionar as opções de README, `.gitignore` ou licença. Depois abra o terminal na pasta extraída:

```bash
git init -b main
git add .
git status --short
git commit -m "Initial DevForge release"
git remote add origin https://github.com/SEU_USUARIO/devforge.git
git push -u origin main
```

Substitua `SEU_USUARIO` pelo nome real da conta. Faça login pelo GitHub Desktop, Git Credential Manager ou outro método suportado; não cole tokens em comandos, links, commits ou prints. Se a pasta já for um repositório git, pule `git init` e confira `git remote -v` antes de adicionar um remoto. Veja o [guia oficial de criação](https://docs.github.com/pt/repositories/creating-and-managing-repositories/creating-a-new-repository).

### Depois de publicar

- Confira na aba **Actions** se o CI de Node passou. Ele testa e compila sem precisar do token do Discord; não hospeda o bot.
- Deixe Issues e Pull Requests ativos se quiser receber contribuições. Discussions pode receber dúvidas; proteja a branch `main` se tiver colaboradores.
- Adicione o convite real do servidor e o link de instalação do bot ao campo About **após criá-los**. Nenhum desses links deve conter o token.
- Hospede o bot seguindo [Hospedagem](DEPLOYMENT.md) e registre os comandos. Um push para o GitHub não liga o bot.
- Para publicar eventos do repositório no Discord, siga [Integração com GitHub](GITHUB-INTEGRATION.md).

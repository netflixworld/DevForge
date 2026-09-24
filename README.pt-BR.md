# DevForge

[English](README.md) · **Português (Brasil)**

**Construa, aprenda e publique em comunidade.** O DevForge é um bot para servidores de desenvolvedores no Discord. Os 78 comandos abrangem projetos, revisão de código, mentoria, desafios, eventos, suporte, moderação e administração. A interface do bot é em inglês; este guia explica tudo em português. A versão 2.1 adiciona Developer Passport, recomendações, workspaces automáticos, Project Health Score e Project Rescue.

Este repositório reúne **o código do bot e a documentação para montar o servidor DevForge**. O GitHub guarda o código e os guias; para deixar o bot online é necessário executá-lo no computador ou em uma hospedagem.

## Por onde começar

| Quero... | Consulte |
| --- | --- |
| Criar o bot e convidá-lo para meu servidor | [Instalação completa](docs/SETUP.md) ou [passo a passo para Windows](SETUP-PTBR.md) |
| Organizar cargos, canais e entrada dos membros | [Estrutura do servidor](docs/SERVER-BLUEPRINT.md) |
| Aprender cada comando | [Guia de comandos](COMMANDS.pt-BR.md) |
| Conhecer os 58 grupos de funções | [Matriz de recursos](FEATURES.pt-BR.md) |
| Entender o `.env` | [Configuração](docs/CONFIGURATION.md) |
| Hospedar e fazer backup | [Hospedagem e backup](docs/DEPLOYMENT.md) |
| Configurar GitHub e webhooks | [Integração com GitHub](docs/GITHUB-INTEGRATION.md) |
| Atualizar uma instalação antiga | [Migração da versão 1.0](UPGRADE-V2-PTBR.md) |
| Colocar este projeto na minha conta GitHub | [Publicação no GitHub](docs/PUBLISH-GITHUB.md) |
| Contribuir ou relatar um problema | [Contribuições](CONTRIBUTING.md), [segurança](SECURITY.md), [regras de conduta](CODE_OF_CONDUCT.md) |

Os guias na pasta `docs/` têm seções em **inglês e português**.

## Principais recursos

- **Colaboração:** projetos, vagas, revisão de código, pareamento, mentoria, snippets e dev logs.
- **Aprendizado:** desafios diários, Bug Hunt, árvore de habilidades, conquistas e propostas técnicas.
- **Comunidade:** tickets privados, entrada guiada, escolha de cargos, moderação, eventos, enquetes e sugestões.
- **Operação:** eventos do GitHub, releases, monitor de sites, lembretes, análises, permissões e painel web opcional.
- **Reconhecimento:** reputação, sequências de participação, créditos internos e cargos resgatáveis. Créditos **não são dinheiro**.

O `/onboarding` pode entregar o cargo de verificado depois que o membro aceita as regras, e o `/rolemenu` permite escolher cargos. Um `/autorole` que atribua cargos imediatamente na entrada **ainda não existe**.

## Requisitos

- Node.js **24.17.0 ou superior** e npm, ou Docker com Compose.
- Aplicação e bot no Discord, token e ID da aplicação.
- **Server Members Intent** e **Message Content Intent** ativados.
- Permissões para instalar aplicativos e configurar cargos e canais no servidor.

O banco é SQLite, em `data/devforge.sqlite`. O servidor HTTP usa a porta `3000` por padrão para health, webhooks e dashboard opcional.

## Começar no Windows

1. Extraia o projeto e execute `INSTALL_WINDOWS.bat`.
2. Abra o `.env` criado e preencha `DISCORD_TOKEN`, `DISCORD_CLIENT_ID` e `DISCORD_GUILD_ID`.
3. Execute `REGISTER_COMMANDS.bat` e depois `START_BOT.bat`.
4. No Discord, use `/health`, `/config bootstrap`, `/onboarding setup`, `/ticket panel` e `/modules list`.

Veja os detalhes de convite e permissões em [Instalação](docs/SETUP.md). A janela do bot deve continuar aberta se você estiver hospedando no seu PC.

## Para quem desenvolve

```bash
npm ci
npm run check
npm run deploy:commands
npm start
```

O projeto usa TypeScript, discord.js e SQLite. Os comandos ficam em `src/commands/`, os módulos em `src/modules/`, as automações em `src/v2/` e os testes em `tests/`. Leia [Arquitetura](docs/ARCHITECTURE.md) e [Contribuições](CONTRIBUTING.md) antes de editar.

Nunca publique `.env`, tokens, chaves ou a pasta `data`. Consulte [Segurança](SECURITY.md). A licença é MIT; veja [LICENSE](LICENSE) e as alterações em [CHANGELOG.md](CHANGELOG.md).

# Contributing / Como contribuir

[English](#english) · [Português](#português)

## English

Thanks for improving DevForge. Open an issue before a large change so maintainers can agree on scope. Please keep bot-facing commands and messages in English; documentation should remain available in English and Portuguese.

1. Create a branch from `main` and make one focused change.
2. Never include `.env`, Discord IDs from a real private server, private ticket content, database files, or tokens.
3. Add or update documentation for user-visible changes. When adding a slash command, register it in the command/plugin registry and map it to a module when relevant.
4. Run `npm ci` and `npm run check`. If slash command names/options changed, test `npm run deploy:commands` against **your own test server**, not the production server.
5. Open a pull request explaining what changed, why, how you tested it, and any configuration steps.

Bug reports should include the command, what you expected, what happened, Node.js version, and sanitized logs. Use the GitHub issue templates. For security reports, follow [SECURITY.md](SECURITY.md) rather than opening a public issue.

The database migration strategy is additive. Preserve original tables and stored user content when changing persistence. See [Architecture](docs/ARCHITECTURE.md).

## Português

Obrigado por contribuir com o DevForge. Antes de uma mudança grande, abra uma issue para combinar o escopo. Comandos e mensagens do bot continuam em inglês; mantenha a documentação acessível em inglês e português.

1. Crie uma branch a partir de `main` e faça uma alteração com objetivo claro.
2. Nunca envie `.env`, IDs privados de servidores reais, conteúdo de tickets, banco de dados ou tokens.
3. Atualize a documentação quando mudar algo visível aos usuários. Novos comandos precisam ser registrados e associados ao módulo adequado.
4. Execute `npm ci` e `npm run check`. Se mudar comandos, teste `npm run deploy:commands` no **seu servidor de teste**, nunca no servidor de produção.
5. Abra um pull request explicando a alteração, o motivo, os testes e o que precisa configurar.

Em relatórios de erro, informe comando, resultado esperado, resultado obtido, versão do Node.js e logs sem segredos. Use os modelos de issues. Para falhas de segurança, siga [SECURITY.md](SECURITY.md), sem abrir uma issue pública.

As migrações do banco são adicionais: preserve as tabelas e o conteúdo da versão anterior. Leia [Arquitetura](docs/ARCHITECTURE.md).

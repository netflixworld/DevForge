# DevForge server blueprint / Estrutura do servidor DevForge

[English](#english) · [Português](#português)

## English

This describes the **recommended Discord server layout**, not the GitHub repository. Run `/config bootstrap` as a server manager after the bot is online. It finds roles and channels by exact name, creates any that are missing, and connects the channels used by the original bot features. Review existing names and permissions before running it in an established server.

### Roles created by the bootstrap

| Role | Suggested use |
| --- | --- |
| Community Moderator | Message moderation, timeouts, and the private moderation log. The bootstrap grants Manage Messages, Moderate Members, and View Audit Log. |
| Code Mentor | Visible recognition for mentors; register with `/mentor register` separately. |
| Verified Developer | Granted through the onboarding rules button when configured. |
| Dev Events | An optional event notification role. |
| Community Support | Access to ticket channels; the bootstrap grants Manage Messages. |
| Event Organizer | Recognizes people running challenges and events. |
| Hackathon Judge | Recognizes event judges. |

Discord permissions still apply to each command. Some creation and moderation actions require Manage Server, Manage Channels, or the relevant moderation permission. Put the **bot's role above only the roles it must grant or edit**. Verify channel access for staff after bootstrap, especially if existing channels were reused.

### Category and channels

The bootstrap creates a category named **DEV COMMUNITY** and these text channels. Existing text channels with the same exact names are reused even when located elsewhere.

| Channel | Purpose |
| --- | --- |
| `#welcome` | Introductions, rules, onboarding panel. |
| `#dev-chat` | General developer conversation and questions. |
| `#project-showcase` | Public projects, collaborators, and demos. |
| `#code-review` | Review requests and review discussion. |
| `#pair-programming` | Matching and pair sessions. |
| `#daily-challenge` | Daily coding prompts and submissions. |
| `#dev-updates` | GitHub activity and community news. |
| `#dev-logs` | Project progress and changelog posts. |
| `#knowledge-base` | Staff-maintained guides and FAQs. |
| `#suggestions` | Community ideas and server feedback. |
| `#events` | Code battles, code jams, and hackathons. |
| `#support` | The ticket panel and support instructions. |
| `#starboard` | Noteworthy messages selected by reactions. |
| `#mod-log` | Private moderation log; hidden from `@everyone` when created by bootstrap. |

The bootstrap maps welcome, showcase, review, pairing, challenge, GitHub, starboard, and moderation features to their respective channels. It also sets default moderator, mentor, verified, ticket support, transcript log, and ticket category settings. It does **not** publish onboarding or ticket panels automatically.

### Finish the server setup

1. Run `/config bootstrap`, then `/config view` and check permissions for `#mod-log`.
2. In `#welcome`, run `/onboarding setup`. This creates technology roles and the interactive panel. Members accept the rules, pick technologies, and fill in their starting profile.
3. In `#support`, run `/ticket panel`, optionally selecting the support role, category, log channel, and auto-close time. Test a ticket with a regular member account.
4. Use `/rolemenu create` for interest, timezone, or notification roles you want members to choose themselves.
5. Use `/security view` and adjust `/security configure` deliberately. Automatic anti-raid quarantine starts disabled.
6. Use `/modules list` and `/permissions list` to review features and role rules.
7. For voice rooms, create a voice channel and run `/voice setup`. For auto threads, use `/autothread add`; for scheduled posts, use `/standups schedule` and `/digest configure`.
8. Use `/config channel` and `/config role` if your server has a different existing layout.

**Current role behavior:** DevForge does not assign a traditional autorole immediately on join. Verification happens after a member accepts the rules. A member can choose self-roles from a role menu.

### Suggested welcome post (English)

Copy this into `#welcome` after adjusting any server-specific details:

> **Welcome to DevForge!** We build, learn, review, and ship software together. Read the guidelines below, click **Accept rules** on the onboarding panel, select your technologies, and introduce yourself in `#dev-chat`. Share your work in `#project-showcase`, ask for a review in `#code-review`, and open a private ticket in `#support` when you need staff help. Use `/help` to explore the bot.

**Community guidelines:** Be constructive and respectful. Critique code, not people. Credit authors and respect licenses. Do not post private code, credentials, or personal data. Keep discussion relevant to each channel. Report problems privately through a ticket. The bot's onboarding button accepts a short built-in rules summary; publish and pin your full server rules separately if you need more detail.

### Permission review

- Confirm `#mod-log` and ticket transcript channels are visible only to authorized staff and the bot. Check them with a regular member account.
- Confirm the bot can post in `#welcome`, `#support`, `#dev-updates`, and any channel used for digests or event reminders.
- Grant access to project and discussion channels according to your own community rules; the bootstrap does not set up a full verified-only channel policy.
- Keep the bot's role above technology and reward roles it assigns, while keeping privileged staff roles controlled by server managers.

## Português

Este guia descreve a **estrutura recomendada do servidor Discord**, junto com o código deste repositório. Depois de ligar o bot, execute `/config bootstrap` com uma conta que tenha permissão de gestão. O comando procura cargos e canais por nome exato, cria os que faltam e associa canais às funções antigas. Em um servidor existente, confira nomes e permissões antes.

### Cargos criados pelo bootstrap

| Cargo | Uso recomendado |
| --- | --- |
| Community Moderator | Moderação de mensagens, timeouts e acesso ao registro privado. Recebe Manage Messages, Moderate Members e View Audit Log. |
| Code Mentor | Identificação visual de mentores; o cadastro em `/mentor register` é separado. |
| Verified Developer | Entregue quando a pessoa aceita as regras no onboarding configurado. |
| Dev Events | Cargo opcional para avisos de eventos. |
| Community Support | Acesso aos tickets; recebe Manage Messages. |
| Event Organizer | Identifica organizadores de desafios e eventos. |
| Hackathon Judge | Identifica jurados de eventos. |

Os comandos continuam respeitando as permissões do Discord. Algumas ações exigem Gerenciar Servidor, Gerenciar Canais ou permissão específica de moderação. Deixe **o cargo do bot acima somente dos cargos que ele precisa entregar ou alterar**. Confira o acesso da staff se algum canal existente for reaproveitado.

### Categoria e canais

O bootstrap cria a categoria **DEV COMMUNITY** e os canais abaixo. Canais de texto com o mesmo nome exato são reaproveitados, mesmo se estiverem em outra categoria.

| Canal | Uso |
| --- | --- |
| `#welcome` | Boas-vindas, regras e painel de entrada. |
| `#dev-chat` | Conversa geral e dúvidas técnicas. |
| `#project-showcase` | Projetos, demos e colaboradores. |
| `#code-review` | Pedidos e discussões de revisão de código. |
| `#pair-programming` | Pareamento e sessões em dupla. |
| `#daily-challenge` | Desafios diários e soluções. |
| `#dev-updates` | GitHub e notícias da comunidade. |
| `#dev-logs` | Progresso e changelog de projetos. |
| `#knowledge-base` | Guias e FAQs criados pela staff. |
| `#suggestions` | Ideias e sugestões para o servidor. |
| `#events` | Batalhas, code jams e hackathons. |
| `#support` | Painel de tickets e orientações. |
| `#starboard` | Mensagens destacadas por reações. |
| `#mod-log` | Registro privado de moderação; fica oculto de `@everyone` quando criado pelo bootstrap. |

O bootstrap configura os canais de boas-vindas, projetos, reviews, dupla, desafios, GitHub, starboard e moderação, além dos cargos padrão e opções iniciais dos tickets. Ele **não publica os painéis** de onboarding ou tickets por conta própria.

### Finalize a configuração

1. Execute `/config bootstrap`, depois `/config view` e confira o acesso a `#mod-log`.
2. Em `#welcome`, execute `/onboarding setup`. O bot cria cargos de tecnologia e o painel de regras, stack e perfil inicial.
3. Em `#support`, execute `/ticket panel`. Se quiser, defina cargo de suporte, categoria, canal de logs e tempo de fechamento automático. Teste com uma conta de membro comum.
4. Use `/rolemenu create` para cargos de interesse, fuso horário e avisos escolhidos pelos próprios membros.
5. Confira `/security view` antes de ajustar `/security configure`. A quarentena automática contra raids vem desligada.
6. Revise `/modules list` e `/permissions list`.
7. Para salas de voz, crie um canal de voz e use `/voice setup`. Para threads e mensagens programadas, use `/autothread add`, `/standups schedule` e `/digest configure`.
8. Se usar outra estrutura, ajuste os destinos com `/config channel` e `/config role`.

**Sobre cargos automáticos:** ainda não há autorole tradicional na entrada. A verificação acontece após aceitar as regras; cargos opcionais podem ser escolhidos no menu.

### Mensagem de boas-vindas sugerida (português)

Copie em `#welcome` e adapte ao seu servidor:

> **Boas-vindas ao DevForge!** Aqui desenvolvemos, aprendemos, revisamos código e publicamos projetos juntos. Leia as regras abaixo, clique em **Accept rules** no painel de entrada, escolha suas tecnologias e apresente-se em `#dev-chat`. Mostre seus projetos em `#project-showcase`, peça revisões em `#code-review` e abra um ticket privado em `#support` para falar com a equipe. Explore os recursos com `/help`.

**Regras da comunidade:** Converse com respeito e de forma construtiva. Avalie o código, não a pessoa. Dê crédito aos autores e respeite licenças. Não publique código privado, credenciais ou dados pessoais. Use os canais conforme seus temas. Relate problemas em ticket privado. O botão do onboarding aceita um resumo curto embutido no bot; se precisar de regras completas, publique e fixe um texto separado.

### Conferência de permissões

- Verifique com uma conta comum se `#mod-log` e o canal de transcripts só aparecem para staff autorizada e bot.
- Confirme que o bot consegue escrever em `#welcome`, `#support`, `#dev-updates` e nos canais de resumos e avisos.
- Ajuste o acesso aos canais de projetos e conversa conforme as regras do servidor; o bootstrap não aplica uma política completa de canais exclusivos para verificados.
- Mantenha o cargo do bot acima dos cargos de tecnologia e recompensa que ele entrega. A gerência deve controlar separadamente os cargos de staff.

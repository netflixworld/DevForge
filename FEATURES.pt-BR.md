# DevForge 2.0 — Matriz de recursos

[English](FEATURES.md) · **Português (Brasil)**

Os comandos e as mensagens exibidos pelo bot no Discord estão em inglês. Estas descrições explicam em português os 58 grupos de funcionalidades do projeto.

1. **Moderação avançada** — `/ban`, `/kick`, `/timeout`, `/warn`, `/purge`, `/slowmode`, `/lock`, `/unlock`, `/nick`, `/mod`, `/security`, `/appeal`: casos, anotações, escalonamento, anti-spam, anti-convite, anti-raid, menções e alertas de contas novas.
2. **Tickets** — `/ticket`: formulário, canais privados, claim, convidados, prioridade, transcript HTML, avaliação, fechamento por inatividade e estatísticas.
3. **Entrada guiada** — `/onboarding`: regras, verificação, perguntas iniciais, tecnologias, cargos e progresso.
4. **Gerenciador de cargos** — `/rolemenu`: painéis para membros escolherem cargos; não há autorole imediato na entrada.
5. **Análises do servidor** — `/analytics` e `/insights`: crescimento, atividade, membros ativos, horários de pico, canais e entradas/saídas.
6. **Perfis de developers** — `/profile`: stack, GitHub, portfólio, experiência, disponibilidade, objetivos e badges.
7. **Árvore de habilidades** — `/skills`: XP em Frontend, Backend, DevOps, Security, Database, Mobile e Game Dev.
8. **Conquistas** — `/achievements`: First PR, Code Reviewer, Bug Hunter, Mentor, Open Source Contributor, 100 Reviews, Project Founder e badges antigas.
9. **Reputação 2.0** — `/rep`: motivos, categorias, limites contra abuso, histórico e ranking.
10. **Busca de mentores** — `/mentor`: cadastro, pesquisa por área/linguagem, pedido, aceitação e conclusão.
11. **Programação em dupla** — `/pair`: combinação por habilidade, nível e fuso; sessões privadas e recompensas.
12. **Hub de projetos** — `/project`: publicação, candidaturas, membros, etapas, vagas, marcos e changelog.
13. **Bounties** — `/bounty`: desafios com recompensa em créditos internos, soluções e escolha do vencedor.
14. **Fila de revisão** — `/review`: prioridades, atribuição, busca de reviewer, comentários e conclusão.
15. **Biblioteca de snippets** — `/snippet`: trechos públicos/privados, tags, busca, favoritos, votos e versões.
16. **Batalhas de código** — `/battle`: criação, participação, equipes, submissões, votos, jurados e resultados.
17. **Code Jams** — `/codejam`: eventos com prazo, equipes, trabalhos enviados e avaliação.
18. **Hackathons** — `/hackathon`: equipes, projetos, submissões, jurados e resultados.
19. **Incubadora de ideias** — `/idea`: publicação, discussão, interesse, estado e conversão em projeto.
20. **Bug Hunt** — `/bughunt`: pequenos trechos com defeitos para encontrar, explicar e corrigir.
21. **Rubber Duck 2.0** — `/rubberduck`: sessão guiada com perguntas para organizar o debugging.
22. **RFCs** — `/rfc`: propostas técnicas em Draft, Review, Accepted, Rejected e Implemented.
23. **Stand-ups** — `/standup` e `/standups`: ontem/hoje/impedimentos, agenda, sequência e resumo.
24. **Dev Logs** — `/devlog`: histórico de progresso de projetos.
25. **Base de conhecimento** — `/docs`: FAQs e guias pesquisáveis publicados pela staff.
26. **GitHub 2.0** — `/github`: repositórios, perfis, webhooks assinados, PRs, issues, commits e destinos por repositório.
27. **Avisos de versões** — `/release`: canais recebem releases de repositórios configurados.
28. **Status de projetos** — `/project status`: Planning, Development, Testing, Maintenance, Paused e Archived.
29. **Monitor de disponibilidade** — `/uptime`: URLs públicas, latência, quedas e recuperação.
30. **Lembretes** — `/remind`: pessoais, recorrentes e associados a projetos.
31. **Gerenciador de eventos** — `/event`: inscrição, capacidade, lista de espera, lembretes e presença.
32. **Sorteios** — `/giveaway`: duração, cargo exigido, vencedores e novo sorteio.
33. **Enquetes avançadas** — `/poll`: uma ou várias opções, anonimato, restrição por cargo e prazo.
34. **Sugestões** — `/suggest`: propostas, votos, estados e resposta oficial da staff.
35. **Starboard 2.0** — `/starboard`: vários murais com emojis, limites e categorias diferentes.
36. **Voz temporária** — `/voice`: sala criada ao entrar no canal inicial, dono, limite, bloqueio, whitelist e transferência.
37. **Threads automáticas** — `/autothread`: novas mensagens em canais selecionados recebem threads.
38. **Resumo da comunidade** — `/digest`: atividade, projetos e eventos em resumo manual ou diário/semanal.
39. **Sequências de atividade** — `/streak`: participação, aprendizado, foco e colaboração.
40. **Rankings** — `/leaderboard` e `/leaderboards`: XP, reputação, créditos, projetos, reviews, mentoria e desafios.
41. **Créditos internos** — `/credits`: pontos comunitários com histórico, sem valor monetário.
42. **Loja de recompensas** — `/shop`: troca de créditos por cargos de comunidade.
43. **Matriz de permissões** — `/permissions`: regras de acesso por cargo e comando.
44. **Configuração por servidor** — `/config`, `/security` e comandos de setup de cada módulo.
45. **Módulos** — `/modules`: liga/desliga a entrada de comandos por grupo; algumas automações e botões independentes podem continuar ativos.
46. **Preferências de aviso** — `/notifications`: escolhas pessoais; a preferência de lembrete de evento já é aplicada.
47. **Registro de auditoria** — `/audit`: ações importantes de staff, bot, segurança, dashboard e tickets.
48. **Saúde do bot** — `/health`: latência, uptime, memória, banco e integrações.
49. **Estatísticas do bot** — `/botstats`: servidores, usuários, comandos e versão.
50. **Quem é o membro** — `/whois`: cargos, conta, entrada, XP, reputação e perfil.
51. **Ferramentas de developer** — `/tools`: timestamp, UUID, hash, Base64, JSON e conversão de bytes.
52. **Playground** — `/playground`: testes pequenos de regex e JSON e prévia de Markdown.
53. **Favoritos de mensagens** — `/bookmarks`: salva links de mensagens para depois.
54. **Tarefas pessoais** — `/todo`: tarefas privadas ou ligadas a projetos e conclusão.
55. **Sessões de foco** — `/focus`: Pomodoro em grupo, threads temporárias e estatísticas.
56. **Missões diárias** — `/missions`: pequenas metas, evidências, créditos e ranking.
57. **Dashboard web** — painel opcional com token para análises, módulos, tickets, projetos e anotações.
58. **Arquitetura de plugins** — `src/modules/plugins.ts` agrupa comandos e componentes para facilitar extensões internas.

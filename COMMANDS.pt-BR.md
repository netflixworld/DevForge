# DevForge 2.0 — Guia dos comandos

[English](COMMANDS.md) · **Português (Brasil)**

Os 78 comandos principais aparecem **em inglês no Discord**. Digite `/` para ver os campos exigidos. Em `/ticket open`, `open` é um subcomando. Algumas ações exigem permissões da staff.

## Primeiros passos e diagnóstico

| Comando | Uso |
| --- | --- |
| `/help` | Exibe os grupos de comandos. |
| `/ping` | Mostra a latência do bot e da API do Discord. |
| `/health` | Verifica uptime, banco, memória e integrações. |
| `/botstats` | Exibe servidores, usuários, versão e uso. |
| `/config bootstrap` | Cria ou reaproveita os cargos e canais recomendados. |
| `/modules list` | Consulta o estado de cada módulo. |

## Identidade, aprendizado e reconhecimento

| Comando | Subcomandos e uso |
| --- | --- |
| `/profile` | `set` cria o perfil; `view` consulta; `discover` encontra pessoas por habilidade; `clear` exclui o seu. |
| `/rank` | Mostra XP, nível, reputação e badges. |
| `/skills` | `log` registra estudo/prática; `view` consulta a árvore de habilidades; `leaderboard` ranqueia uma área. |
| `/achievements` | `view` mostra conquistas; `catalog` exibe as disponíveis. |
| `/rep` | `give` reconhece alguém com motivo e categoria; `history` mostra o histórico. |
| `/streak` | Mostra sequências de participação. |
| `/leaderboard` | Ranking geral de XP, reputação ou ajuda prestada. |
| `/leaderboards` | Rankings de créditos, projetos, reviews, mentoria, desafios e missões. |
| `/whois` | Perfil Discord e DevForge de um membro. |

## Projetos e colaboração

| Comando | Subcomandos e uso |
| --- | --- |
| `/project` | `create`, `browse`, `mine`, `info`, `close`, `status`, `milestone`, `changelog`, `vacancy`: publicação, busca, fases e vagas de projetos. |
| `/review` | `request`, `queue`, `mine`, `assign`, `match`, `priority`, `comment`: fila e acompanhamento de revisões. |
| `/pair` | `join` procura dupla; `status` acompanha; `leave` sai da fila. |
| `/mentor` | `register` cadastra mentor; `find`, `request`, `accept`, `complete`, `requests` gerenciam a mentoria. |
| `/bounty` | `create` abre desafio com créditos internos; `list`, `submit`, `award` consultam, enviam e escolhem solução. |
| `/idea` | `create`, `list`, `status`, `convert`: discussão e conversão de ideias em projetos. |
| `/rfc` | `create`, `list`, `vote`, `status`: propostas técnicas e suas etapas. |
| `/devlog` | `add` publica progresso; `list` consulta logs. |
| `/snippet` | `save`, `get`, `search`, `delete`, `favorite`, `favorites`, `vote`, `versions`: biblioteca de trechos de código. |

## Desafios e eventos

| Comando | Subcomandos e uso |
| --- | --- |
| `/challenge` | `current` mostra o desafio diário; `submit` envia; `leaderboard` ranqueia; `rotate` troca o desafio, para gestores. |
| `/bughunt` | `current` mostra código com bug; `submit` explica e corrige; `leaderboard` ranqueia. |
| `/battle` | `create`, `list`, `join`, `team`, `submit`, `vote`, `judge`, `results`: batalhas de código. |
| `/codejam` | Mesma dinâmica de eventos e subcomandos de `/battle`, com prazo e equipes. |
| `/hackathon` | Mesmos subcomandos, com equipes, projetos e avaliação. |
| `/event` | `create`, `list`, `join`, `leave`, `checkin`, `cancel`: eventos, inscrições, espera e presença. |
| `/giveaway` | `create`, `join`, `draw`, `reroll`, `list`: sorteios e novos vencedores. |
| `/poll` | `create`, `vote`, `results`, `close`: enquetes com prazo. |
| `/suggest` | `create`, `list`, `vote`, `status`: sugestões e resposta oficial. |

## Conhecimento e produtividade

| Comando | Subcomandos e uso |
| --- | --- |
| `/rubberduck` | Guia de perguntas para depurar um problema. |
| `/standup` | Atualização simples: ontem, hoje e impedimentos. |
| `/standups` | `submit`, `schedule`, `summary`, `streak`, `disable`: rotina de atualização por equipe. |
| `/docs` | `search` pesquisa artigos; `add` publica; `remove` arquiva. Publicação e remoção são da staff. |
| `/bookmarks` | `save`, `list`, `remove`: salva links de mensagens. |
| `/todo` | `add`, `list`, `complete`, `remove`: tarefas pessoais ou ligadas a projetos. |
| `/focus` | `start`, `join`, `end`, `stats`: sessões de foco em grupo. |
| `/missions` | `view`, `complete`, `leaderboard`: missões diárias. |
| `/remind` | `create`, `list`, `cancel`: lembretes únicos, recorrentes ou de projeto. |
| `/tools` | `timestamp`, `uuid`, `hash`, `base64`, `json`, `bytes`: utilidades para developers. |
| `/playground` | `regex`, `json`, `markdown`: testes rápidos e prévia privada. |

## GitHub e funcionamento do servidor

| Comando | Subcomandos e uso |
| --- | --- |
| `/github` | `repo`, `user`, `webhook`, `subscribe`, `subscriptions`: consulta GitHub e direciona eventos. |
| `/release` | `subscribe`, `list`, `remove`: avisos de releases por repositório. |
| `/uptime` | `add`, `list`, `check`, `remove`: monitora URLs públicas. |
| `/digest` | `configure`, `now`, `disable`: resumo diário ou semanal. |
| `/analytics` | Atividade, crescimento, canais e horários de pico. |
| `/insights` | Resumo rápido da comunidade. |

## Cargos, tickets e canais

### Plataforma DevForge 2.1

| Comando | O que faz |
| --- | --- |
| `/passport view [member]` | Mostra identidade verificada: perfil, XP, reputação, projetos, conquistas, skill XP e links. |
| `/passport availability status:` | Atualiza a disponibilidade para colaboração. |
| `/discover [skill]` | Recomenda projetos e code reviews compatíveis com a stack. |
| `/projecthealth check project_id:` | Calcula saúde de 0 a 100 e recomenda ações concretas. |
| `/projecthealth rescue project_id: needs:` | Publica uma campanha controlada para recuperar um projeto em risco. |
| `/workspace create project_id:` | Cria cargo privado, canal central e voz de pareamento para o projeto. |
| `/workspace archive project_id:` | Arquiva os recursos criados para o workspace. |

| Comando | Subcomandos e uso |
| --- | --- |
| `/ticket` | `open`, `panel`, `claim`, `close`, `add`, `remove`, `priority`, `stats`: atendimentos privados com transcript HTML no fechamento manual. |
| `/onboarding` | `setup`, `start`, `status`: regras, verificação, tecnologia e perfil inicial. |
| `/rolemenu` | `create`, `list`: painéis para os membros escolherem cargos. |
| `/starboard` | `add`, `list`, `remove`: murais de mensagens por emoji e mínimo de reações. |
| `/voice` | `setup`, `name`, `limit`, `lock`, `unlock`, `allow`, `deny`, `transfer`: salas temporárias. |
| `/autothread` | `add`, `list`, `remove`: threads automáticas em canais escolhidos. |
| `/notifications` | `view`, `set`: preferências individuais de avisos. |

## Economia interna

| Comando | Subcomandos e uso |
| --- | --- |
| `/credits` | `balance`, `history`, `leaderboard`, `grant`: saldo e histórico; gestores podem ajustar pontos. |
| `/shop` | `list`, `buy`, `add`, `remove`: resgate de cargos com créditos internos. |

Créditos são apenas pontos da comunidade e **não têm valor em dinheiro**.

## Moderação e segurança

| Comando | Uso |
| --- | --- |
| `/ban` | Bane e cria um caso. |
| `/kick` | Expulsa e registra o caso. |
| `/timeout` | Aplica ou remove restrição temporária. |
| `/warn` | Adverte e pode escalar automaticamente. |
| `/purge` | Apaga mensagens recentes. |
| `/slowmode` | Ajusta intervalo entre mensagens do canal. |
| `/lock` e `/unlock` | Bloqueia e libera o envio no canal para o cargo padrão. |
| `/nick` | Altera ou limpa um apelido. |
| `/mod` | Ferramentas antigas: `warn`, `timeout`, `note`, `cases`, `purge`. |
| `/appeal` | `submit`, `status`, `resolve`: recursos de moderação. Usuários banidos não podem executar o comando fora do servidor. |
| `/security` | `view`, `configure`: proteção contra raid, contas novas e excesso de menções. |
| `/audit` | Histórico de ações importantes do bot e da staff. |

## Administração

| Comando | Subcomandos e uso |
| --- | --- |
| `/config` | `bootstrap`, `view`, `channel`, `role`, `feature`, `star-threshold`: configuração geral. |
| `/modules` | `list`, `toggle`: ativa ou desativa módulos de comandos. |
| `/permissions` | `set`, `list`, `remove`: regras de cargo por comando. |
| `/dashboard` | Estado e endereço do painel web opcional. |

**Ordem sugerida:** `/health` → `/config bootstrap` → `/onboarding setup` → `/ticket panel` → `/modules list`.

**Autorole:** a entrega imediata de cargo na entrada ainda não existe. O onboarding entrega o cargo de verificado após aceitar as regras; o role menu permite escolher outros cargos.

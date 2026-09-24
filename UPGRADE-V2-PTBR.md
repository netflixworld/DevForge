# Atualização do DevForge para 2.1.1

Esta atualização mantém o banco e todas as funções antigas. Não apague o arquivo `.env` nem a pasta `data`.

## Correção 2.1.1: comandos duplicados

Esta versão corrige comandos exibidos duas vezes quando havia registros globais e registros do servidor ao mesmo tempo. Preserve `.env` e a pasta `data`, substitua os demais arquivos e execute `REGISTER_COMMANDS.bat`. Mantenha `DISCORD_GUILD_ID` preenchido com o ID do servidor DevForge.

## Passo a passo no Windows

1. Feche a janela do `START_BOT.bat` ou pressione `Ctrl + C` nela.
2. Faça uma cópia de segurança destes itens da instalação atual:
   - `.env`
   - pasta `data` inteira
3. Extraia o pacote 2.0 em uma nova pasta.
4. Copie o seu `.env` antigo para a nova pasta.
5. Copie a pasta `data` antiga para a nova pasta e confirme a substituição somente se o Windows perguntar sobre a pasta vazia do pacote.
6. Execute `INSTALL_WINDOWS.bat`.
7. Execute `REGISTER_COMMANDS.bat`. Isso registra os 78 comandos no seu servidor.
8. Execute `START_BOT.bat`.
9. No Discord, teste `/health` e `/botstats`.
10. Execute `/config bootstrap` novamente. Ele preserva canais/cargos existentes e cria apenas os recursos que estiverem faltando.
11. Configure os novos painéis:
    - `/onboarding setup`
    - `/ticket panel`
    - `/modules list`
    - `/security view`

## Novidades da versão 2.1

- `/passport view` reúne perfil, XP, reputação, projetos, conquistas e experiência por área.
- `/discover` recomenda projetos e revisões de código conforme a stack do membro.
- `/workspace create` cria cargo, canal central e voz privada para uma equipe.
- `/projecthealth check` mede o ritmo de um projeto e sugere próximos passos.
- `/projecthealth rescue` abre uma campanha para recuperar um projeto em risco.

Esses recursos usam as tabelas e perfis existentes. Não é necessário apagar ou recriar o banco.

## Permissões adicionais recomendadas

- Ban Members
- Kick Members
- Moderate Members
- Manage Messages
- Manage Nicknames
- Manage Channels
- Manage Roles
- Manage Threads
- Create Public Threads
- Create Private Threads
- Send Messages in Threads
- Move Members
- View Audit Log

O bot não precisa de `Administrator`. O cargo dele deve ficar acima dos cargos que ele precisará entregar ou moderar.

## Intents no Developer Portal

Em **Bot → Privileged Gateway Intents**, mantenha ativados:

- Server Members Intent
- Message Content Intent

O recurso de voz temporária usa `Guild Voice States`, que não é um intent privilegiado e já está habilitado no código.

## Painel web opcional

Ele vem desligado. Para ativar, edite o `.env`:

```env
DASHBOARD_ENABLED=true
DASHBOARD_TOKEN=crie_um_segredo_unico_com_pelo_menos_24_caracteres
PUBLIC_BASE_URL=https://seu-endereco-publico.example
```

Depois reinicie o bot e use `/dashboard`. Não envie o `DASHBOARD_TOKEN` para ninguém e não mostre essa linha em prints.

## Se os comandos antigos aparecerem

Pressione `Ctrl + R` no Discord. Se ainda estiverem desatualizados, execute `REGISTER_COMMANDS.bat` outra vez e aguarde alguns segundos.

## Se houver erro

Não apague o banco. Copie as últimas linhas da janela preta, escondendo completamente o token, e informe qual comando causou o problema.

# Changelog

## 1.3.7

- corrige deteccao de rotas Next.js protegidas por auth guard (`withAuth`, `withSession` e similares) que antes geravam falsos positivos no `sema drift`
- corrige `consumerFramework` retornando `null` incorretamente em projetos Next.js pure-API com auto-deteccao de fontes legado

## 1.2.17

- faz `Abrir Prompt IA` e `Copiar Prompt IA` usarem o `SEMA_CONTEXT.md` atualizado do projeto como fonte principal
- regenera o contexto de projeto pela extensao antes de abrir ou copiar, em vez de depender de prompt generico solto
- alinha o prompt-base oficial e a extensao para priorizar `SEMA_CONTEXT.md`, `SEMA_BRIEF.md` e `SEMA_INDEX.json`

## 1.2.16

- assume `SEMA_CONTEXT.md` como guia inicial de projeto, sem depender de contrato ativo
- remove o ruído de `nenhum .sema ativo` e troca por escopo de projeto mais claro
- alinha a ordem de fontes de verdade embutida no contexto para começar por `SEMA_CONTEXT.md`, `SEMA_BRIEF.md` e `SEMA_INDEX.json`
- coloca `Preparar Contexto IA do Projeto` como fluxo principal e tira o foco do contexto por alvo na lateral
- adiciona um comando unico para preparar o contexto IA completo do projeto e salvar tudo em `SEMA_CONTEXT.md` na raiz
- salva um `SEMA_CONTEXT.md` explicito na raiz do projeto para a IA consultar antes de abrir codigo cru
- sincroniza `SEMA_BRIEF.md`, `SEMA_INDEX.json` e entrypoints IA-first direto na raiz do projeto pela lateral da extensao
- deixa a extensao resolver `baseProjeto` via CLI antes de gravar contexto, evitando salvar artefato no lugar errado

## 1.2.12

- acompanha a linha publica `1.2.12` da Sema com correcao da CLI na verificacao orientada por `sema.config.json`
- mantem a extensao alinhada com os artefatos e instaladores mais recentes da release

## 1.2.11

- alinha a extensao com a nova semantica de seguranca da Sema
- adiciona highlight e hover para `auth`, `authz`, `dados`, `audit`, `segredos` e `forbidden`
- adiciona snippets para task segura e governanca de segredos

## 1.2.10

- traz de volta uma lateral `Sema` no VS Code com status do workspace, CLI e alvo atual
- adiciona comandos de prompt e contexto no editor para `starter-ia`, `prompt-ia`, `prompt-curto`, `resumo`, `drift` e diagnostico da CLI
- faz `sema.cliPath` virar autoridade total para a extensao, sem fallback silencioso para a CLI do proprio projeto
- executa wrappers `.cmd` no Windows do jeito certo, evitando que a CLI instalada pelo usuario falhe e seja trocada por um candidato errado
- prioriza a CLI instalada no usuario antes do bin local do projeto e remove a dependencia da CLI do repositorio como fallback implicito

## 1.0.2

- consolida a pagina publica da extensao com instalacao oficial, links diretos e fluxo real com a CLI
- mantem a validacao por contexto de projeto e a linha publica pronta para uma nova publicacao da VSIX

## 1.0.1

- troca a validacao isolada por compilacao com contexto de projeto no servidor do VS Code
- resolve `use` cross-module na extensao com a mesma ideia de projeto compartilhado da CLI
- respeita buffers abertos durante o diagnostico e empacota a extensao com o novo loader de projeto
- limpa a pagina publica da extensao para destacar instalacao, links oficiais e fluxo real com a CLI

## 1.0.0

- fecha a primeira linha publica estavel da Sema com camada compacta para IA pequena, media e grande
- acompanha `sema resumo`, `prompt-curto`, `briefing.min.json`, `SEMA_BRIEF.*` e o reposicionamento explicitamente IA-first
- alinha instalacao, release e documentacao publica na linha `1.0.0`

## 0.9.1

- consolida a instalacao publica da CLI e da extensao na linha `0.9.1`
- alinha a documentacao para fluxo IA-first sem depender do monorepo da Sema
- acompanha o pacote publico com exemplos e docs empacotados para agente

## 0.9.0

- alinha a extensao com a linha publica `0.9.x` da Sema
- atualiza a documentacao para instalacao via GitHub Release e VSIX `0.9.0`
- acompanha o reposicionamento da Sema como linguagem de intervencao segura para IA e backend vivo

## 0.8.2

- fortalece o `importar nextjs` em handlers com `request.json()` tipado ou com cast inline
- reconhece melhor `NextResponse.json(...)` quando a resposta passa por variavel local antes do `return`
- fecha o buraco de bootstrap semantico em casos reais como `auth/login` e `local-firestore/query`

## 0.8.1

- melhora o importador `nextjs` com bootstrap semantico mais forte para `params`, `query`, `body`, `status` e `response`
- aceita importacao a partir da raiz do projeto, de `app/`, `src/app/api/` e de subpastas concretas de rota
- mantem o draft revisavel, mas reduz o fallback preguiçoso em handlers que ja carregam sinal forte

## 0.8.0

- alinha a extensao com a linha publica `0.8.x` da Sema
- acompanha a onda backend generica com onboarding e distribuicao mais redondos
- atualiza a documentacao da extensao para o fluxo publico com instaladores e release

## 0.7.0

- alinha a extensao com a linha publica `0.7.x` da Sema
- reposiciona a descricao publica em torno do protocolo e da camada semantica
- atualiza a documentacao da extensao para o fluxo de instalacao e uso atual

## 0.1.1

- melhora o manifesto para publicacao no Marketplace
- adiciona README mais completo para a pagina da extensao
- adiciona changelog oficial da extensao
- mantem highlight, snippets, formatacao e LSP inicial

## 0.1.0

- primeira versao publica da extensao da Sema
- suporte basico a arquivos `.sema`
- destaque de sintaxe
- snippets iniciais
- integracao com formatacao
- diagnosticos semanticos e hover basico via servidor de linguagem inicial

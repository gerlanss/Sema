# Roadmap

## Fase 1. Fundacao do compilador

- status: concluida
- estrutura do monorrepositorio
- lexer funcional
- parser basico
- AST tipada
- CLI inicial

## Fase 2. Semantica operacional do nucleo

- status: concluida
- analise semantica mais rica
- `use` entre modulos do mesmo conjunto de compilacao
- expressoes semanticas com `e`, `ou`, `nao` e parenteses
- `state` com invariantes e transicoes
- vinculo `task -> state`
- `flow` com contexto, ramificacao e roteamento por erro

## Fase 3. Operacionalizacao real da linguagem

- status: concluida
- `effects` tipados por categoria
- `route` forte como contrato publico
- caso piloto de pagamento ponta a ponta

## Fase 4. Ferramentas de adocao

- status: concluida
- `sema formatar`
- JSON estavel na CLI
- extensao de VS Code
- fluxo consolidado com `project:check`

## Marco 0.6 Backend-First

- status: concluido
- reposicionamento oficial para criacao e edicao de backend real
- `sema.config.json` com defaults de projeto
- `sema inspecionar` para resolucao nao destrutiva
- scaffold backend para NestJS
- scaffold backend para FastAPI
- `sema iniciar --template nestjs|fastapi`
- resolucao de `use` em multiplas origens de projeto
- `impl` reforcado como ponte entre contrato e implementacao viva
- diagnosticos melhores para `flow` e `use`

## Marco 0.7 Legado Incremental

- status: concluido
- linha publica: `0.7.x`
- importacao assistida mais forte para NestJS, FastAPI, TypeScript, Python e Dart
- `sema drift` para comparar contrato vs codigo vivo
- `sema inspecionar` com diretorios de codigo, fontes de legado e modo de adocao
- `sema.config.json` ampliado com `diretoriosCodigo`, `fontesLegado` e `modoAdocao`
- foco em adocao incremental de projeto que nao nasceu com Sema
- pacote publico da CLI instalavel fora do monorrepo
- showcase oficial sanitizado para demonstrar valor em backend vivo
- `Next.js App Router` como fonte legado de primeira classe para `importar` e `drift`
- `Node/Firebase worker` como fonte legado de primeira classe para `importar`, `drift` de rota minima e `drift` de recurso vivo
- starters oficiais `nextjs-api` e `node-firebase-worker`
- scorecard formal de compatibilidade por familia de stack

## Marco 0.8 Backend Generico

- status: em andamento
- linha publica: `0.8.x`
- `ASP.NET Core` como fonte legado de primeira classe para `importar` e `drift`
- `Spring Boot` como fonte legado de primeira classe para `importar` e `drift`
- `Go net/http + Gin` como fonte legado de primeira classe para `importar` e `drift`
- `Rust Axum` como fonte legado de primeira classe para `importar` e `drift`
- `C++ bridge/service` como fonte `generic bridge/symbol first-class`
- starters oficiais `aspnet-api`, `springboot-api`, `go-http-api`, `rust-axum-api` e `cpp-service-bridge`
- `sema doctor` para saneamento rapido de ambiente
- instaladores oficiais `install-sema.sh` e `install-sema.ps1`

## Proximo Ciclo

- criacao de scaffolding ainda mais util para projeto vivo
- aprofundar edicao assistida de backends existentes
- ampliar `use` para cenarios ainda maiores
- fortalecer orquestracao backend sem inflar a linguagem
- amadurecer editor e automacao em cima da camada backend-first
- fortalecer o acoplamento entre contrato Sema e codigo real via `impl`, `drift` e mapeamento de arquivo vivo
- explicitar melhor invariantes de dominio em modulos que hoje estao bons de fluxo, mas ainda frouxos de garantia
- introduzir contratos mais estaveis para dominios operacionais recorrentes, como estrategia, gate, slice e versao ativa
- melhorar a trilha "`modulo Sema -> arquivos reais`" para IA conseguir editar projeto vivo com menos adivinhacao
- suavizar ainda mais a instalacao publica depois do estado registry-ready
- transformar o showcase oficial em vitrine curta de valor para adocao
- levar a familia `Next.js App Router` e `Node/Firebase worker` para benchmark `9/10` em mais repos alem do Gestech
- padronizar ainda melhor a ponte Dart consumidora para subir a familia Flutter para `9/10` sem bridge ad hoc
- fechar a segunda onda `0.9.x` para `Angular`, `.NET desktop`, `Flutter consumidor` e outras bordas onde ainda faltar trilha oficial forte

## Sinal de Produto Vindo de Projeto Real

Feedback externo recente, vindo do uso da Sema por IA em um backend operacional real, reforca quatro pontos:

- a Sema ja entrega muito valor em fluxo, efeito, garantia e fronteira de responsabilidade
- `impl` ja ajuda, mas ainda esta mais para ponte de referencia do que acoplamento forte com a implementacao viva
- dominios operacionais mais chatos pedem contratos reutilizaveis e invariantes mais estaveis
- o proximo salto nao e "mais documento bonito"; e "mais rastreabilidade util para editar sem quebrar"

Traduzindo sem perfume: se a IA entende o contrato mas ainda precisa farejar Python na unha para achar a verdade, o produto ainda nao blindou direito a ultima milha.

## Observacao

A Sema se apresenta publicamente como protocolo e continua sendo linguagem de intencao na implementacao. O roadmap backend-first fortalece a capacidade de governar projeto real sem transformar a linguagem em framework ou runtime.

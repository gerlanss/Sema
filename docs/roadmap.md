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

- status: em andamento
- importacao assistida mais forte para NestJS, FastAPI, TypeScript, Python e Dart
- `sema drift` para comparar contrato vs codigo vivo
- `sema inspecionar` com diretorios de codigo, fontes de legado e modo de adocao
- `sema.config.json` ampliado com `diretoriosCodigo`, `fontesLegado` e `modoAdocao`
- foco em adocao incremental de projeto que nao nasceu com Sema

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

## Sinal de Produto Vindo de Projeto Real

Feedback externo recente, vindo do uso da Sema por IA em um backend operacional real, reforca quatro pontos:

- a Sema ja entrega muito valor em fluxo, efeito, garantia e fronteira de responsabilidade
- `impl` ja ajuda, mas ainda esta mais para ponte de referencia do que acoplamento forte com a implementacao viva
- dominios operacionais mais chatos pedem contratos reutilizaveis e invariantes mais estaveis
- o proximo salto nao e "mais documento bonito"; e "mais rastreabilidade util para editar sem quebrar"

Traduzindo sem perfume: se a IA entende o contrato mas ainda precisa farejar Python na unha para achar a verdade, o produto ainda nao blindou direito a ultima milha.

## Observacao

A Sema continua sendo linguagem de intencao. O roadmap backend-first fortalece a capacidade de governar projeto real sem transformar a linguagem em framework ou runtime.

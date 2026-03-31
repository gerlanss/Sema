# Status da Sema

Este arquivo e o ponto de acompanhamento operacional do projeto Sema. Ele resume o que ja foi entregue no MVP, o que esta consolidado por fase e o que passa a ser trabalho pos-Fase 4.

## Quadro-resumo

- Ultima atualizacao: 2026-03-31
- Ultimo commit de referencia: `8572311`
- Convencao de atualizacao: sempre que um item mudar de estado, atualizar este arquivo e registrar o commit de referencia mais recente
- Estagio atual: linha publica `1.0.0` fechada como primeira release estavel, com foco oficial em vinculos, execucao, contexto acionavel, compressao semantica por capacidade de IA e superficies modernas em backend vivo
- Direcao de produto: IA primeiro; legibilidade humana tratada como consequencia da explicitude semantica
- Posicionamento atual: protocolo de governanca de intencao para IA e backend vivo, mantido tecnicamente como linguagem de intencao para governar contrato e significado acima das stacks de implementacao
- Linha publica de release: `1.0.0`, alinhada entre CLI, pacotes internos e extensao do VS Code
- Pacote npm publico da CLI: `@semacode/cli`
- Principais areas concluidas:
  - fundacao do monorrepo em TypeScript
  - lexer, parser, AST, diagnosticos, analise semantica e IR
  - geracao para Python, TypeScript e Dart
  - CLI com validacao, compilacao, inspecao de projeto, teste, verificacao em lote e formatacao
  - exemplos obrigatorios e documentacao-base
  - semantica operacional do nucleo
  - operacionalizacao real inicial da linguagem
  - ferramentas de adocao com JSON estavel, formatador, extensao de editor e servidor de linguagem inicial
  - vertical oficial de pagamento modularizado como referencia do `0.5`
  - modo backend-first com scaffold para NestJS e FastAPI
  - `sema.config.json` com defaults de projeto e multiplas origens
  - importacao assistida de legado com `sema drift` para governar contrato vs codigo vivo
  - empacotamento publico da CLI em tarball instalavel sem dependencia `file:` quebrada
  - showcase oficial sanitizado para provar valor em backend Flask vivo
  - `Flask`, `Next.js App Router` e `Node/Firebase worker` como fontes legado de primeira classe em `importar` e `drift`
  - starters oficiais para `nextjs-api` e `node-firebase-worker`
  - scorecard oficial de compatibilidade por familia de stack
  - `ASP.NET Core`, `Spring Boot`, `Go net/http + Gin`, `Rust Axum` e `C++ bridge/service` como familias backend first-class em `importar` e `drift`
  - `sema doctor` para saneamento rapido de ambiente
  - instaladores oficiais `install-sema.sh` e `install-sema.ps1`
  - importador `Next.js App Router` com bootstrap semantico mais forte para `params`, `query`, `body`, `status` e `response`
  - importador `Next.js App Router` com inferencia melhor de body via `request.json()` tipado/cast inline e resposta HTTP retornada por variavel local
  - fluxo pronto para `npm publish` da CLI com dry-run verificavel e metadados publicos mais completos
  - pacote npm publico alinhado ao scope `@semacode/cli` para distribuicao sem depender de namespace alheio
  - pacote npm publico com docs essenciais de IA embutidos, sem depender da pasta `docs/` do monorrepo para `ajuda-ia`
  - kit oficial de lancamento publico com pitch, release note curta, posts e checklist de anuncio
  - framing de IA e onboarding documental deixando explicito que a Sema e protocolo de governanca semantica, nao gerador automatico de contrato final
  - compressao semantica por capacidade de IA com `sema resumo`, `prompt-curto`, `briefing.min.json`, `resumo.*` e `SEMA_BRIEF.*`
- Principais areas parciais:
  - suporte de editor agora tem LSP inicial, mas ainda pode amadurecer bastante
  - `use` avancado para projetos ainda maiores pode amadurecer mais
  - orquestracao backend ainda pode ficar mais forte sem inflar a linguagem
  - contratos de execucao, efeitos e erros ainda podem ficar mais fortes no pos-MVP

## Fases do Projeto

- Fase 1. Fundacao do compilador
  - Status: `[x]` concluida
  - Escopo: monorrepo, lexer, parser, AST, diagnosticos, IR, CLI base, geradores iniciais, exemplos e documentacao-base

- Fase 2. Semantica operacional do nucleo
  - Status: `[x]` concluida
  - Escopo: `use`, expressoes semanticas, `state`, vinculo `task -> state`, `flow` com contexto, ramificacao e roteamento por erro

- Fase 3. Operacionalizacao real da linguagem
  - Status: `[x]` concluida
  - Escopo: `effects` tipados, `route` mais forte, contratos publicos executaveis iniciais, uso guiado por caso real

- Fase 4. Ferramentas de adocao
  - Status: `[x]` concluida
  - Escopo: `sema formatar`, saida JSON estavel, ergonomia de editor e fluxo operacional de adocao

## Fase Atual

- `[x]` Fase 4 encerrada como marco tecnico do MVP base
- `[x]` Marco `0.5` util de verdade fechado com o vertical oficial de pagamento
- `[x]` Marco `0.6 backend-first` fechado com scaffold backend, configuracao de projeto e integracao inicial com frameworks
- `[x]` Marco `0.7 legado incremental` fechado com importacao assistida fortalecida, `sema drift` e adocao incremental mais clara
- `[x]` Marco `0.8 backend generico` iniciado com familias backend first-class alem do eixo TypeScript/Python
- Foco imediato:
  - aprofundar criacao e edicao de backends reais
  - amadurecer orquestracao backend
  - suporte de editor mais profundo
  - automacao e IA em cima dos contratos ja estabilizados
  - consolidar narrativa publica protocol-first e demonstracao de valor reproduzivel
  - empurrar as familias dominantes de stack para a regua `9/10` com benchmark real

## Proxima Fase

- `[x]` Feedback externo de uso por IA em projeto real consolidado como insumo de produto
- `[ ]` Pos-0.8 backend generico
- Prioridade sugerida:
  - aprofundar criacao de backend em projeto vivo
  - amadurecer `use` para projetos maiores
  - enriquecer contratos de execucao, efeitos e erros
  - ampliar integracao com IA sobre JSON estavel, formatacao canonica e scaffold backend
  - fortalecer `impl` e `drift` como ponte concreta com arquivo, simbolo e rota da implementacao viva
  - subir o nivel de invariantes para modulos operacionais que hoje estao bons de fluxo, mas ainda frouxos de garantia
  - mapear melhor `modulo Sema -> arquivos reais` para reduzir adivinhacao de IA em Python, TypeScript e frameworks
  - estudar contratos mais estaveis para estrategia, gate, slice e versao ativa em dominios operacionais
  - fechar a segunda onda de compatibilidade para `Angular`, `.NET desktop`, `Flutter consumidor` e outras bordas consumer/desktop na linha `0.9.x`

## Criterios de Fechamento do Marco 0.5

- `[x]` dominio-guia de pagamento modularizado com `use`
- `[x]` `route` mais forte como contrato publico resolvido e validado
- `[x]` `effects` com shape operacional e `criticidade`
- `[x]` consistencia melhor entre `task`, `flow`, `route`, `error` e `guarantees`
- `[x]` geracao coerente em Python e TypeScript mesmo com tipos externos referenciados
- `[x]` guia oficial de pagamento ponta a ponta publicado
- `[x]` `npm run build`, `npm test`, `npm run format:check` e `sema verificar exemplos --json` verdes

## Criterios de Encerramento da Fase 4

- `[x]` `sema formatar` como estilo canonico oficial
- `[x]` `formatar --check` com codigo de saida nao zero quando ha divergencia
- `[x]` `formatar --json` com relatorio estruturado por arquivo
- `[x]` `--json` padronizado em `validar`, `diagnosticos`, `ast`, `ir` e `verificar`
- `[x]` schema operacional documentado em `docs/cli.md`
- `[x]` extensao basica de VS Code com associacao `.sema`, gramática, configuracao, snippets e comando de formatacao
- `[x]` `project:check` incorporando `format:check`
- `[x]` documentacao de integracao com IA atualizada para o contrato JSON e o uso do formatador
- `[x]` `npm run build`, `npm test`, `npm run status:check`, `sema formatar exemplos --check` e `sema verificar exemplos --json` verdes como aceite da fase

## Criterios de Encerramento da Fase 3

- `[x]` `effects` tipados com `persistencia`, `consulta`, `evento`, `notificacao` e `auditoria`
- `[x]` validacao semantica de `effects` com rejeicao de categoria invalida e linha malformada
- `[x]` `route` com contrato publico semantico em `input`, `output` e `error`
- `[x]` IR carregando contrato publico resolvido e efeitos estruturados
- `[x]` geracao de contratos executaveis iniciais para `route`, `error`, `effects` e `guarantees`
- `[x]` caso piloto de pagamento cobrindo `task`, `state`, `flow`, `route`, `error` e `effects`
- `[x]` `npm run build`, `npm test`, `npm run status:check` e `sema verificar exemplos` verdes como aceite da fase

## Legenda

- `[x]` concluido
- `[-]` parcial
- `[ ]` pendente
- `[!]` risco ou bloqueio relevante

## Em Andamento Nesta Sprint

- `[x]` Reposicionar a Sema como linguagem backend-first para criacao e edicao de projeto real
- `[x]` Adicionar `sema.config.json` com defaults de backend e multiplas origens
- `[x]` Entregar scaffold backend para NestJS
- `[x]` Entregar scaffold backend para FastAPI
- `[x]` Adicionar `sema inspecionar` para diagnostico nao destrutivo de projeto
- `[x]` Melhorar diagnosticos de `use` e `flow` para contexto real de backend
- `[x]` Fazer `sema drift` e `sema inspecionar` tratarem `contratos/` como origem valida sem depender do nome `sema/`
- `[x]` Atualizar a documentacao operacional para o marco `0.6 backend-first`
- `[x]` Adicionar `sema drift` para governar contrato e codigo vivo em projeto legado
- `[x]` Enriquecer `sema inspecionar` com diretorios de codigo, fontes de legado e modo de adocao
- `[x]` Expandir `sema.config.json` com `diretoriosCodigo`, `fontesLegado` e `modoAdocao`
- `[x]` Registrar feedback externo do FuteBot como validacao de valor e ajuste de prioridade para a ultima milha entre contrato e implementacao viva
- `[x]` Alinhar release publica `0.8.8` entre CLI, pacotes e extensao
- `[x]` Fortalecer o bootstrap semantico de `importar nextjs` sem degradar o fallback honesto
- `[x]` Revisar o `README` como landing page publica mais clara para instalacao, showcase e compatibilidade
- `[x]` Deixar a CLI pronta para `npm publish` com script oficial de dry-run
- `[x]` Consolidar kit oficial de lancamento publico para release, README e canais sociais
- `[x]` Explicitar nas docs centrais e no onboarding de IA o papel da Sema como protocolo de governanca, com limites e postura correta de uso
- `[x]` Entregar pacote publico da CLI instalavel fora do monorrepo
- `[x]` Publicar showcase oficial reproduzivel para demonstrar valor em backend Flask vivo
- `[x]` Tratar `Next.js App Router` como fonte legado de primeira classe
- `[x]` Tratar `Node/Firebase worker` como fonte legado de primeira classe
- `[x]` Formalizar scorecard oficial de compatibilidade por familia de stack
- `[x]` Entregar starters oficiais para `nextjs-api` e `node-firebase-worker`
- `[x]` Tratar `ASP.NET Core` como fonte legado de primeira classe
- `[x]` Tratar `Spring Boot` como fonte legado de primeira classe
- `[x]` Tratar `Go net/http + Gin` como fonte legado de primeira classe
- `[x]` Tratar `Rust Axum` como fonte legado de primeira classe
- `[x]` Tratar `C++ bridge/service` como fonte `generic bridge/symbol first-class`
- `[x]` Entregar `sema doctor`
- `[x]` Entregar instaladores oficiais para Linux/macOS e Windows

## Fundacao do Projeto

- `[x]` Estrutura do monorrepo em TypeScript
- `[x]` Organizacao em `pacotes/nucleo`, `pacotes/gerador-python`, `pacotes/gerador-typescript`, `pacotes/cli` e `pacotes/padroes`
- `[x]` Scripts de build e testes no workspace principal
- `[x]` Scripts operacionais `status:sync`, `status:check`, `docs:prepare` e `project:check`
- `[x]` Repositorio Git criado, commit inicial realizado e remoto privado publicado
- `[x]` `.gitignore` ajustado para evitar build temporario e artefatos indevidos no versionamento
- `[x]` Fluxo operacional documentado para contribuicao, PR e execucao pelo Codex

## Nucleo do Compilador

- `[x]` Lexer com tokens, posicao de origem e diagnosticos iniciais
- `[x]` Parser para `module`, `use`, `type`, `entity`, `enum`, `task`, `flow`, `route`, `tests`, `docs`, `comments` e blocos internos principais
- `[x]` AST tipada para os blocos centrais do MVP
- `[x]` Diagnosticos estruturados com codigo, mensagem, severidade e contexto
- `[x]` IR semantica independente de linguagem-alvo
- `[-]` Gramatica ainda pragmatica e enxuta, com espaco para expressoes mais ricas no pos-MVP
- `[-]` Sistema de expressoes ainda pode amadurecer alem do nivel atual do MVP

## Semantica da Linguagem

- `[x]` Analise semantica inicial com falha antecipada para omissoes importantes
- `[x]` Validacao de tipos conhecidos, simbolos duplicados e contratos basicos de `task`
- `[x]` Rejeicao de `task` sem `input`, `output` ou `guarantees`
- `[x]` Validacao basica de casos de teste embutidos
- `[x]` Resolucao inicial de `use` entre multiplos modulos do mesmo conjunto de compilacao
- `[x]` Modularizacao suficiente de dominio real com `use` para o vertical oficial de pagamento
- `[x]` Expressoes compostas com `e`, `ou`, `nao` e parenteses
- `[x]` `state` com invariantes e transicoes declarativas validadas
- `[x]` `task` com vinculo explicito a `state` e validacao de transicoes permitidas
- `[x]` `flow` com etapas estruturadas, `quando`, `depende_de`, `com`, `em_sucesso`, `em_erro` e `por_erro`
- `[x]` `effects` tipados por categoria com taxonomia inicial de `persistencia`, `consulta`, `evento`, `notificacao` e `auditoria`
- `[x]` `effects` com `criticidade` opcional e validada
- `[x]` `route` fortalecido como contrato publico semantico com `input`, `output` e `error` opcionais
- `[x]` `route` com defaults publicos coerentes, validacao de tipos publicos e assinatura publica unica por metodo+caminho
- `[x]` `use` com multiplas origens declaradas em `sema.config.json`
- `[x]` `use ts|py|dart` tratado como interop declarado e rastreavel
- `[x]` `impl` como bloco estavel para vincular `task` a implementacoes externas em TypeScript, Python e Dart
- `[x]` Diagnosticos de `use` e `flow` com sugestoes mais explicaveis para contexto real de backend
- `[x]` Garantias, erros e efeitos com contratos executaveis iniciais e rastreabilidade consistente nos geradores
- `[ ]` Resolucao mais completa de `use` para projetos maiores, multiplos diretorios e importacao mais sofisticada
- `[-]` Sistema de expressoes semanticas mais formal para regras, comparacoes e pos-condicoes ainda pode amadurecer

## Geracao de Codigo

- `[x]` Geracao para TypeScript com tipos de entrada e saida, validacao e casca de execucao
- `[x]` Geracao para Python com `dataclass`, validacao e casca de execucao
- `[x]` Geracao de testes para TypeScript e Python a partir de `tests`
- `[x]` Comentarios gerados em portugues do Brasil
- `[x]` Saida deterministica suficiente para o MVP atual
- `[x]` Geracao com validacoes estruturadas basicas para regras e garantias
- `[x]` Geracao inicial de contratos executaveis de erro em TypeScript e Python
- `[x]` `effects` tipados refletidos de forma explicita no codigo gerado
- `[x]` `route` refletido no codigo gerado como contrato publico rastreavel
- `[x]` `route` com adaptadores publicos e validacao minima de resposta publica
- `[x]` `guarantees` viram validadores dedicados e reuso executavel nos alvos
- `[x]` Contratos publicos executaveis iniciais e adaptadores neutros de borda
- `[x]` Tipos externos referenciados por `use` sao tratados de forma segura nos alvos gerados
- `[x]` Scaffold backend para NestJS com contrato, DTO, service, controller e testes iniciais
- `[x]` Scaffold backend para FastAPI com contrato, schemas, service, router e testes iniciais
- `[x]` Estrutura de saida `backend` para organizacao mais util de projeto real
- `[x]` Gatilho de `impl` refletido de forma mais clara no scaffold gerado
- `[-]` Os scaffolds backend ainda sao intencionais e uteis, mas nao substituem implementacao real do framework

## CLI

- `[x]` `sema iniciar`
- `[x]` `sema validar`
- `[x]` `sema ast`
- `[x]` `sema ir`
- `[x]` `sema compilar`
- `[x]` `sema gerar`
- `[x]` `sema testar`
- `[x]` `sema diagnosticos`
- `[x]` `sema verificar`
- `[x]` `sema formatar`
- `[x]` `sema inspecionar`
- `[x]` Resumo final de verificacao por modulo e por alvo
- `[x]` Saida JSON dedicada e estavel para `validar`, `diagnosticos`, `ast`, `ir`, `verificar` e `formatar`
- `[x]` Scripts auxiliares para manutencao de status e checklist operacional
- `[x]` Script canonico `project:check` para verificacao completa do projeto
- `[x]` Verificacao dedicada do vertical de pagamento com modularizacao por `use`
- `[x]` `sema iniciar --template <base|nestjs|fastapi>`
- `[x]` `sema iniciar --template <nextjs-api|node-firebase-worker>`
- `[x]` `sema compilar`, `sema gerar` e `sema testar` com `--framework <base|nestjs|fastapi>`
- `[x]` `sema compilar`, `sema gerar` e `sema testar` com `--estrutura <flat|modulos|backend>`
- `[x]` `sema.config.json` com defaults de projeto para alvo, estrutura, framework e multiplas origens
- `[x]` `sema importar <nestjs|fastapi|flask|nextjs|firebase|typescript|python|dart>`

## Exemplos Obrigatorios

- `[x]` Calculadora
- `[x]` Cadastro de usuario
- `[x]` Pagamento
- `[x]` Pagamento dividido em dominio compartilhado e modulo principal de operacao
- `[x]` CRUD simples
- `[x]` Automacao
- `[x]` Tratamento de erro
- `[x]` Testes embutidos
- `[x]` Exemplo de pagamento elevado a caso piloto oficial com `state`, `task`, `flow`, `route`, `error` e `effects` tipados
- `[x]` Exemplos exercitam contratos publicos iniciais, execucao neutra de borda e formatacao canonica

## Documentacao

- `[x]` `README.md`
- `[x]` Manifesto
- `[x]` Visao
- `[x]` Filosofia
- `[x]` Sintaxe
- `[x]` Especificacao inicial
- `[x]` Arquitetura
- `[x]` CLI
- `[x]` Integracao com IA
- `[x]` Roadmap
- `[x]` Riscos
- `[x]` Comparacao com Python e TypeScript
- `[x]` Gramatica inicial
- `[x]` Documento operacional de status
- `[x]` Guia de contribuicao com fluxo orientado a issue, status, verificacao e PR
- `[x]` Template de issue para sprint tecnica
- `[x]` Template de pull request
- `[x]` Posicionamento explicito de que a linguagem prioriza entendimento por IA
- `[x]` Documentacao da Fase 4 para formatacao, JSON estavel e extensao basica de editor
- `[x]` Guia oficial de pagamento ponta a ponta para o marco `0.5`
- `[x]` Guia de onboarding para ensinar a Sema a IA, com prompt-base oficial e fluxo pratico de agente
- `[x]` Starter curto para agente e script para preparar contexto de IA com `validar`, `diagnosticos`, `ast` e `ir`
- `[x]` Guia de instalacao e primeiro uso com requisitos, comandos e problemas comuns
- `[x]` Fluxo de distribuicao publica da CLI com pacote `.tgz` instalavel e smoke automatizado de instalacao
- `[x]` Comandos nativos da CLI para onboarding de IA: `starter-ia`, `prompt-ia` e `contexto-ia`
- `[x]` Guia do ciclo `0.6 backend-first`
- `[x]` Scorecard oficial de compatibilidade por familia e benchmark real
- `[x]` Guias de adocao incremental para NestJS e FastAPI existentes
- `[x]` Guia pratico de uso da Sema com NestJS + Prisma em backend critico
- `[x]` Documentacao de CLI e instalacao atualizada para scaffold backend, `inspecionar` e `sema.config.json`

## Testes e Verificacao

- `[x]` Testes unitarios do compilador
- `[x]` Testes de integracao dos geradores
- `[x]` Testes cobrindo `effects` com `criticidade`
- `[x]` Testes cobrindo `route` com coerencia de tipos publicos e assinatura unica
- `[x]` Testes cobrindo o vertical de pagamento modularizado em multiplos arquivos
- `[x]` Testes do formatador para arquivo, pasta, `--check`, idempotencia e preservacao semantica
- `[x]` Testes de CLI JSON para `validar` e `verificar`
- `[x]` Testes da extensao basica de VS Code para linguagem, snippets e comando de formatacao
- `[x]` Verificacao local dos exemplos com `npm test`
- `[x]` Verificacao em lote com `sema verificar exemplos`
- `[x]` Execucao local de testes gerados para TypeScript
- `[x]` Execucao local de testes gerados para Python com `pytest`
- `[x]` Validacao automatizada de `STATUS.md`
- `[x]` Workflow de CI para `project:check`
- `[x]` Pacote de aceite da Fase 4 com `npm run build`, `npm test`, `npm run status:check`, `sema formatar exemplos --check` e `sema verificar exemplos --json`
- `[x]` Testes cobrindo scaffold backend para NestJS
- `[x]` Testes cobrindo scaffold backend para FastAPI
- `[x]` Testes cobrindo `Next.js App Router` em `importar`, `drift` e `inspecionar`
- `[x]` Testes cobrindo `Node/Firebase worker` em `importar`, `drift` e `inspecionar`
- `[x]` Testes cobrindo bridge Dart consumidor para `impl.dart` e `contexto-ia`
- `[x]` Testes cobrindo `sema.config.json` com multiplas origens e compile por projeto
- `[x]` Testes cobrindo `sema inspecionar --json`
- `[x]` Smokes reais opcionais para `FuteBot` e `Gestech` como benchmark de regressao
- `[-]` A cobertura atual fecha bem o MVP base, mas ainda pode crescer para cenarios maiores no pos-Fase 4

## Proximos Passos do MVP

- `[x]` Reposicionar a Sema como linguagem backend-first para criacao e edicao de projeto real
- `[x]` Entregar `sema.config.json` com defaults de backend e multiplas origens
- `[x]` Gerar scaffold backend util para NestJS
- `[x]` Gerar scaffold backend util para FastAPI
- `[x]` Adicionar `sema inspecionar` para diagnostico nao destrutivo de projeto
- `[x]` Melhorar diagnosticos de `use` e `flow` para contexto real de backend
- `[ ]` Aprofundar adocao incremental em projeto backend existente
- `[ ]` Amadurecer `flow` para orquestracao backend mais rica sem inflar a linguagem
- `[ ]` Fortalecer ainda mais `use` para projeto grande e multiplos diretorios
- `[ ]` Enriquecer contratos de execucao, efeitos, erros e garantias no pos-`0.6`
- `[ ]` Fechar a segunda onda de compatibilidade de primeira classe para `Angular` e `.NET`

## Observacoes

- O projeto ja saiu faz tempo da fase de ideia, fechou o MVP base em quatro fases e agora entrou no ciclo `0.6 backend-first`.
- O maior risco agora nao e falta de fundacao; e crescer sem criterio, especialmente em orquestracao, editor e integracao com framework, depois que a base finalmente ficou redonda.
- Este documento deve ser atualizado sempre que um item mudar de `[-]` ou `[ ]` para `[x]`.

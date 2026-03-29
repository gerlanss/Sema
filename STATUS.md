# Status da Sema

Este arquivo e o ponto de acompanhamento operacional do projeto Sema. Ele resume o que ja foi entregue no MVP, o que esta parcial e o que ainda permanece como proximo passo tecnico.

## Quadro-resumo

- Ultima atualizacao: 2026-03-29
- Ultimo commit de referencia: `e47512f`
- Convencao de atualizacao: sempre que um item mudar de estado, atualizar este arquivo e registrar o commit de referencia mais recente
- Estagio atual: Fase 2 encerrada, com nucleo semantico operacional estabilizado e Fase 3 aberta
- Direcao de produto: IA primeiro; legibilidade humana tratada como consequencia da explicitude semantica
- Principais areas concluidas:
  - fundacao do monorrepo em TypeScript
  - lexer, parser, AST, diagnosticos, analise semantica inicial e IR
  - geracao para Python e TypeScript
  - CLI com validacao, compilacao, teste e verificacao em lote
  - exemplos obrigatorios e documentacao-base
  - semantica operacional do nucleo
- Principais areas parciais:
  - `effects`, `guarantees` e `error` ainda precisam ganhar modelo mais operacional
  - `route` segue deliberadamente mais raso e fica para a Fase 3
  - ferramental de adocao ainda esta em aberto

## Fases do Projeto

- Fase 1. Fundacao do compilador
  - Status: `[x]` concluida
  - Escopo: monorrepo, lexer, parser, AST, diagnosticos, IR, CLI base, geradores iniciais, exemplos e documentacao-base

- Fase 2. Semantica operacional do nucleo
  - Status: `[x]` concluida
  - Escopo: `use`, expressoes semanticas, `state`, vinculo `task -> state`, `flow` com contexto, ramificacao e roteamento por erro

- Fase 3. Operacionalizacao real da linguagem
  - Status: `[-]` fase atual aberta
  - Escopo: `effects` tipados, `route` mais forte, contratos publicos mais executaveis, uso guiado por caso real

- Fase 4. Ferramentas de adocao
  - Status: `[ ]` futura
  - Escopo: `sema formatar`, saida JSON mais rica, IDE/editor, ergonomia para automacao e IA

## Fase Atual

- `[-]` Fase 3. Operacionalizacao real da linguagem
- Foco atual:
  - tipar `effects`
  - fortalecer `route`
  - validar a linguagem num caso de negocio real ponta a ponta

## Proxima Fase

- `[ ]` Proximos marcos da Fase 3
- Prioridade sugerida:
  - tipar `effects`
  - fortalecer `route`
  - validar a linguagem num caso de negocio real de ponta a ponta

## Critérios de Encerramento da Fase 2

- `[x]` `use` entre modulos do mesmo conjunto de compilacao funcionando
- `[x]` expressoes semanticas com `e`, `ou`, `nao` e parenteses funcionando
- `[x]` `state` com invariantes e transicoes validadas
- `[x]` vinculo `task -> state` com verificacao de transicoes permitidas
- `[x]` `flow` com `etapa`, `quando`, `depende_de`, `com`, `em_sucesso`, `em_erro` e `por_erro`
- `[x]` geracao TypeScript e Python refletindo essas estruturas de forma rastreavel
- `[x]` testes unitarios e de integracao cobrindo essas capacidades
- `[x]` `sema verificar exemplos` verde como checagem de aceite da fase

## Fora da Fase 2

- `[ ]` fortalecimento profundo de `route`
- `[ ]` `effects` tipados por categoria
- `[ ]` contratos publicos executaveis mais ricos
- `[ ]` `use` avancado com multiplos diretorios e namespaces maiores
- `[ ]` `sema formatar`
- `[ ]` saida JSON mais rica para automacao e IDE
- `[ ]` caso de negocio real ponta a ponta como driver principal

## Legenda

- `[x]` concluido
- `[-]` parcial
- `[ ]` pendente
- `[!]` risco ou bloqueio relevante

## Em Andamento Nesta Sprint

- `[x]` Encerrar formalmente a Fase 2 como marco tecnico do projeto
- `[ ]` Iniciar a Fase 3 com `effects` tipados
- `[ ]` Fortalecer `route` como contrato publico
- `[-]` Evoluir a geracao de erros, efeitos e garantias para contratos mais executaveis
- `[ ]` Melhorar a saida estruturada para IDE, automacao e IA
- `[x]` Formalizar o fluxo operacional de contribuicao, checagem e revisao para humanos e Codex

## Fundacao do Projeto

- `[x]` Estrutura do monorrepo em TypeScript
- `[x]` Organizacao em `pacotes/nucleo`, `pacotes/gerador-python`, `pacotes/gerador-typescript`, `pacotes/cli` e `pacotes/padroes`
- `[x]` Scripts de build e testes no workspace principal
- `[x]` Scripts operacionais `status:sync`, `status:check` e `docs:prepare`
- `[x]` Repositorio Git criado, commit inicial realizado e remoto privado publicado
- `[x]` `.gitignore` ajustado para evitar build temporario e artefatos indevidos no versionamento
- `[x]` Fluxo operacional documentado para contribuicao, PR e execucao pelo Codex

## Nucleo do Compilador

- `[x]` Lexer com tokens, posicao de origem e diagnosticos iniciais
- `[x]` Parser para `module`, `use`, `type`, `entity`, `enum`, `task`, `flow`, `route`, `tests`, `docs`, `comments` e blocos internos principais
- `[x]` AST tipada para os blocos centrais do MVP
- `[x]` Diagnosticos estruturados com codigo, mensagem, severidade e contexto
- `[x]` IR semantica independente de linguagem-alvo
- `[-]` Gramatica ainda pragmatica e enxuta, com espaco para expressoes mais ricas
- `[-]` Expressoes compostas com `e`, `ou`, `nao` e parenteses no nivel inicial do MVP
- `[!]` O parser e a gramatica ainda precisam amadurecer para reduzir mais texto livre em `rules`, `effects` e `guarantees`

## Semantica da Linguagem

- `[x]` Analise semantica inicial com falha antecipada para omissoes importantes
- `[x]` Validacao de tipos conhecidos, simbolos duplicados e contratos basicos de `task`
- `[x]` Rejeicao de `task` sem `input`, `output` ou `guarantees`
- `[x]` Validacao basica de casos de teste embutidos
- `[x]` Validacao inicial de `route` para `metodo`, `caminho` e referencia de `task`
- `[x]` Validacao inicial de `flow` para etapas e referencias declarativas de `task`
- `[x]` Validacao inicial de `state` para estrutura minima e consistencia de tipos
- `[x]` Resolucao inicial de `use` entre multiplos modulos do mesmo conjunto de compilacao
- `[x]` Expressoes estruturadas basicas em `rules`, `effects` e `guarantees`
- `[x]` Expressoes compostas com `e`, `ou`, `nao` e parenteses para regras e garantias no MVP atual
- `[x]` `state` com invariantes e transicoes declarativas validadas no MVP
- `[x]` `flow` com etapas estruturadas, `quando` e `depende_de` validados no MVP
- `[x]` `flow` com mapeamento de contexto por etapa e ramificacao basica de sucesso/erro
- `[x]` `flow` com roteamento por tipo de erro com base no contrato da `task`
- `[x]` `task` com vinculo explicito a `state` e validacao de transicoes permitidas
- `[x]` Escopo semantico operacional do nucleo consolidado como criterio de encerramento da Fase 2
- `[ ]` Fortalecimento profundo de `route` fica explicitamente para a Fase 3
- `[ ]` Resolucao mais completa de `use` para projetos maiores, multiplos diretorios e importacao mais sofisticada
- `[-]` Garantias, erros e efeitos ja possuem estrutura basica, com erros executaveis iniciais nos geradores
- `[-]` Sistema de expressoes semanticas mais formal para regras, comparacoes e pos-condicoes

## Geracao de Codigo

- `[x]` Geracao para TypeScript com tipos de entrada e saida, validacao e casca de execucao
- `[x]` Geracao para Python com `dataclass`, validacao e casca de execucao
- `[x]` Geracao de testes para TypeScript e Python a partir de `tests`
- `[x]` Comentarios gerados em portugues do Brasil
- `[x]` Saida deterministica suficiente para o MVP atual
- `[x]` Geracao com validacoes estruturadas basicas para regras e garantias
- `[x]` Geracao inicial de contratos executaveis de erro em TypeScript e Python
- `[x]` Geracao inicial de rastreabilidade do vinculo `task -> state` nos alvos
- `[x]` Geracao inicial de rastreabilidade de `flow` com ramificacoes e mapeamentos
- `[x]` Geracao inicial de rastreabilidade de rotas de erro em `flow`
- `[-]` `effects` viram contratos e comentarios, mas ainda nao possuem modelo de execucao mais forte
- `[-]` `guarantees` ja geram contratos basicos, mas ainda nao cobrem cenarios mais ricos e infraestrutura real
- `[-]` `error` ja gera classes e cenarios executaveis basicos, mas ainda nao virou modelagem robusta de falhas no codigo final
- `[ ]` Contratos mais ricos de execucao e adaptadores neutros mais completos

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
- `[x]` Resumo final de verificacao por modulo e por alvo
- `[x]` Scripts auxiliares para manutencao de status e checklist operacional
- `[x]` Script canonico `project:check` para verificacao completa do projeto
- `[ ]` `sema formatar`
- `[ ]` Saida JSON dedicada para o resumo do comando `verificar`

## Exemplos Obrigatorios

- `[x]` Calculadora
- `[x]` Cadastro de usuario
- `[x]` Pagamento
- `[x]` CRUD simples
- `[x]` Automacao
- `[x]` Tratamento de erro
- `[x]` Testes embutidos
- `[x]` Exemplos atualizados para exercitar validacoes iniciais de `flow`, `route` e `state`
- `[x]` Exemplo de pagamento atualizado para exercitar expressoes estruturadas, invariantes e transicoes
- `[x]` Exemplos atualizados para exercitar `flow` estruturado e contratos executaveis de erro
- `[x]` Exemplo de automacao atualizado para exercitar contexto entre etapas e ramificacao de erro
- `[x]` Exemplo de tratamento de erro atualizado para exercitar roteamento por tipo de falha
- `[-]` Os exemplos ainda nao exercitam uma semantica profunda de `flow`, `route` e `state`

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
- `[x]` Convencao de ultima atualizacao e commit de referencia
- `[x]` Secao de sprint em andamento para acompanhamento tatico
- `[x]` Template de issue para sprint tecnica
- `[x]` Template de pull request
- `[x]` `README.md` normalizado para evitar nova bagunca de encoding no trecho corrigido
- `[x]` Posicionamento explicito de que a linguagem prioriza entendimento por IA

## Testes e Verificacao

- `[x]` Testes unitarios do compilador
- `[x]` Testes de integracao dos geradores
- `[x]` Verificacao local dos exemplos com `npm test`
- `[x]` Verificacao em lote com `sema verificar exemplos`
- `[x]` Execucao local de testes gerados para TypeScript
- `[x]` Execucao local de testes gerados para Python com `pytest`
- `[x]` Testes unitarios cobrindo validacoes iniciais de `flow`, `route` e `state`
- `[x]` Testes unitarios e de integracao cobrindo `use` entre arquivos vizinhos
- `[x]` Testes cobrindo expressoes estruturadas e validacao de transicoes em `state`
- `[x]` Testes cobrindo expressoes compostas, negacao semantica, `flow` estruturado e contratos executaveis de erro
- `[x]` Testes cobrindo vinculo entre `task` e `state` com rejeicao de transicoes invalidas
- `[x]` Testes cobrindo `flow` com mapeamento de entrada, saida entre etapas e ramificacao
- `[x]` Testes cobrindo roteamento de `flow` por tipo de erro e rejeicao de erro invalido
- `[x]` Validacao automatizada de `STATUS.md`
- `[x]` Workflow de CI para `project:check`
- `[-]` A cobertura atual valida bem o MVP, mas ainda nao protege cenarios mais avancados de multiplos modulos e semantica expandida

## Proximos Passos do MVP

- `[ ]` Tipar `effects` por categoria e contrato operacional
- `[ ]` Fortalecer `route` como contrato publico e ponte para adaptadores
- `[ ]` Validar a linguagem em um caso de negocio real ponta a ponta
- `[ ]` Ampliar a resolucao de `use` para multiplos diretorios e importacoes mais sofisticadas
- `[ ]` Formalizar ainda melhor expressoes em `rules`, `effects` e `guarantees`
- `[ ]` Evoluir a geracao de erros, efeitos e garantias para contratos mais executaveis
- `[ ]` Adicionar `sema formatar`
- `[ ]` Melhorar a saida estruturada para IDE, automacao e IA

## Observacoes

- O projeto ja saiu da fase de ideia e esta em estado real de implementacao.
- O maior risco agora nao e falta de fundacao; e deixar o crescimento da linguagem ficar solto sem um criterio claro de evolucao semantica.
- Este documento deve ser atualizado sempre que um item mudar de `[-]` ou `[ ]` para `[x]`.

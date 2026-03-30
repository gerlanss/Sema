# Status da Sema

Este arquivo e o ponto de acompanhamento operacional do projeto Sema. Ele resume o que ja foi entregue no MVP, o que esta consolidado por fase e o que passa a ser trabalho pos-Fase 4.

## Quadro-resumo

- Ultima atualizacao: 2026-03-29
- Ultimo commit de referencia: `e47512f`
- Convencao de atualizacao: sempre que um item mudar de estado, atualizar este arquivo e registrar o commit de referencia mais recente
- Estagio atual: Fase 4 encerrada, com MVP base completo e marco `0.5` de utilidade real controlada atingido
- Direcao de produto: IA primeiro; legibilidade humana tratada como consequencia da explicitude semantica
- Principais areas concluidas:
  - fundacao do monorrepo em TypeScript
  - lexer, parser, AST, diagnosticos, analise semantica e IR
  - geracao para Python e TypeScript
  - CLI com validacao, compilacao, teste, verificacao em lote e formatacao
  - exemplos obrigatorios e documentacao-base
  - semantica operacional do nucleo
  - operacionalizacao real inicial da linguagem
  - ferramentas de adocao com JSON estavel, formatador e extensao basica de editor
  - vertical oficial de pagamento modularizado como referencia do `0.5`
- Principais areas parciais:
  - suporte de editor ainda e basico, sem LSP
  - `use` avancado para projetos maiores ainda nao esta maduro
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
- Foco imediato:
  - amadurecimento de ecossistema
  - suporte de editor mais profundo
  - automacao e IA em cima dos contratos ja estabilizados

## Proxima Fase

- `[ ]` Pos-Fase 4
- Prioridade sugerida:
  - aprofundar suporte de editor alem da extensao basica
  - amadurecer `use` para projetos maiores
  - enriquecer contratos de execucao, efeitos e erros
  - ampliar integracao com IA sobre JSON estavel e formatacao canonica

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

- `[x]` Encerrar formalmente a Fase 4 como marco tecnico do MVP base
- `[x]` Adicionar `sema formatar` com estilo canonico oficial
- `[x]` Formalizar saida JSON estavel nos comandos-chave da CLI
- `[x]` Entregar extensao basica de VS Code sem duplicar a regra de formatacao
- `[x]` Integrar `format:check` ao fluxo `project:check`
- `[x]` Atualizar a documentacao operacional de CLI e IA para a Fase 4

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
- `[x]` Resumo final de verificacao por modulo e por alvo
- `[x]` Saida JSON dedicada e estavel para `validar`, `diagnosticos`, `ast`, `ir`, `verificar` e `formatar`
- `[x]` Scripts auxiliares para manutencao de status e checklist operacional
- `[x]` Script canonico `project:check` para verificacao completa do projeto
- `[x]` Verificacao dedicada do vertical de pagamento com modularizacao por `use`

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
- `[-]` A cobertura atual fecha bem o MVP base, mas ainda pode crescer para cenarios maiores no pos-Fase 4

## Proximos Passos do MVP

- `[x]` Tipar `effects` por categoria e contrato operacional
- `[x]` Fortalecer `route` como contrato publico e ponte inicial para adaptadores neutros
- `[x]` Validar a linguagem em um caso de negocio real ponta a ponta
- `[x]` Adicionar `sema formatar`
- `[x]` Melhorar a saida estruturada para IDE, automacao e IA
- `[x]` Entregar ergonomia inicial de editor com extensao basica de VS Code
- `[ ]` Ampliar a resolucao de `use` para multiplos diretorios e importacoes mais sofisticadas
- `[ ]` Formalizar ainda melhor expressoes em `rules`, `effects` e `guarantees`

## Observacoes

- O projeto ja saiu faz tempo da fase de ideia e agora tem o MVP base fechado em quatro fases.
- O maior risco agora nao e falta de fundacao; e crescer sem criterio depois que a base finalmente ficou redonda.
- Este documento deve ser atualizado sempre que um item mudar de `[-]` ou `[ ]` para `[x]`.

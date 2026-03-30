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
- diagnosticos em portugues mais detalhados

## Fase 3. Operacionalizacao real da linguagem

- status: concluida
- `effects` tipados por categoria
- `route` forte como contrato publico
- uso guiado por caso de negocio real ponta a ponta no dominio de pagamento
- contratos publicos executaveis iniciais
- amadurecimento inicial de `error`, `effects` e `guarantees` alem da pura rastreabilidade

## Fase 4. Ferramentas de adocao

- status: concluida
- `sema formatar` como estilo canonico oficial
- saida JSON estavel em `validar`, `diagnosticos`, `ast`, `ir` e `verificar`
- extensao basica de VS Code com associacao `.sema`, gramática, snippets e comando de formatacao
- fluxo operacional consolidado com `format:check` e `project:check`
- documentacao de CLI e integracao com IA alinhadas ao contrato publico da fase

## Pos-Fase 4

- marco atual: `0.5` util de verdade atingido com vertical oficial de pagamento
- suporte de editor mais profundo, com possibilidade de LSP quando fizer sentido
- resolucao mais avancada de `use` para projetos maiores
- enriquecimento adicional do sistema de expressoes
- contratos mais fortes de execucao, efeitos e erros
- ampliacao do ecossistema de adocao alem do MVP atual

## Observacao

O fechamento da Fase 4 nao expande a semantica central da linguagem. Ele fecha a camada de adocao do MVP: formatacao, JSON estavel, automacao e editor basico. O proximo ciclo deixa de ser "fundar" a ferramenta e passa a ser "amadurecer" a experiencia e o ecossistema.

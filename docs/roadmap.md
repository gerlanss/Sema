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

- status: aberta
- `effects` tipados por categoria
- `route` mais forte como contrato publico
- contratos publicos mais executaveis
- uso guiado por caso de negocio real ponta a ponta

## Fase 4. Ferramentas de adocao

- status: futura
- `sema formatar`
- saida JSON mais rica
- suporte de editor e ergonomia para automacao e IA

## Observacao

O fechamento da Fase 2 nao inclui fortalecimento profundo de `route`. Esse trabalho foi explicitamente movido para a Fase 3, junto com `effects` tipados e com a validacao da linguagem em um caso real.

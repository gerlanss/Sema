# Especificacao Inicial do MVP

## Arquivo-fonte

- extensao oficial: `.sema`
- um arquivo descreve um modulo principal
- `use` permite declarar dependencias semanticas

## Sistema de tipos inicial

Tipos primitivos suportados no MVP:

- `Texto`
- `Numero`
- `Inteiro`
- `Decimal`
- `Booleano`
- `Data`
- `DataHora`
- `Id`
- `Email`
- `Url`
- `Json`

## Estruturas centrais

- `type`: definicao reutilizavel de contrato
- `entity`: estrutura de dominio com identidade e campos
- `enum`: conjunto fechado de valores
- `task`: operacao de negocio
- `flow`: encadeamento semantico de etapas
- `route`: exposicao declarativa de interface

## Contratos da task

Uma `task` no MVP deve aceitar:

- `input`
- `output`
- `rules`
- `effects`
- `guarantees`
- `state`
- `error`
- `docs`
- `comments`
- `tests`

`input`, `output` e `guarantees` formam a espinha dorsal da validacao atual. A implementacao rejeita tarefas sem esses contratos essenciais.


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

## Expressoes semanticas do MVP atual

O MVP atual ja aceita e valida formas estruturadas basicas em `rules` e `guarantees`:

- `campo existe`
- `campo > 0`
- `campo == outro_campo`
- `campo em [A, B, C]`
- `campo deve_ser predicado`

Em `effects`, o formato estruturado atual e:

- `acao alvo`
- `acao alvo complemento`

Exemplos:

- `valor > 0`
- `token existe`
- `status em [AUTORIZADO, PROCESSADO]`
- `pagamento.status == status`
- `consulta gateway_pagamento`
- `registra auditoria`

## State no MVP atual

O bloco `state` agora suporta:

- `fields`
- `invariants`
- `transitions`

Exemplo:

```sema
state ciclo_pagamento {
  fields {
    status: StatusPagamento
    conciliado: Booleano
  }
  invariants {
    status existe
    conciliado == falso
  }
  transitions {
    PENDENTE -> AUTORIZADO
    AUTORIZADO -> PROCESSADO
    PENDENTE -> RECUSADO
  }
}
```

No MVP, quando existe um campo `status` ou `estado` ligado a um `enum`, as transicoes passam a ser validadas contra esse conjunto de valores.

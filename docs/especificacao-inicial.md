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

Em `effects`, o formato estruturado atual e tipado por categoria:

- `persistencia alvo`
- `consulta alvo`
- `evento alvo`
- `notificacao alvo`
- `auditoria alvo`
- `categoria alvo detalhe`

Exemplos:

- `valor > 0`
- `token existe`
- `status em [AUTORIZADO, PROCESSADO]`
- `pagamento.status == status`
- `consulta gateway_pagamento`
- `persistencia Pagamento`
- `evento pagamento_autorizado`
- `notificacao cliente comprovante_pagamento`
- `auditoria pagamento`

As categorias suportadas no MVP atual sao:

- `persistencia`
- `consulta`
- `evento`
- `notificacao`
- `auditoria`

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

## Route no MVP atual

O bloco `route` passou a operar como contrato publico mais forte, ainda sem acoplamento a framework. Hoje ele suporta:

- `metodo`
- `caminho`
- `task`
- `input` opcional
- `output` opcional
- `error` opcional

Exemplo:

```sema
route processar_pagamento_publico {
  metodo: POST
  caminho: /pagamentos/processar
  task: processar_pagamento
  input {
    pagamento_id: Id
    valor: Decimal
    token: Texto
  }
  output {
    pagamento: Pagamento
    status: StatusPagamento
  }
  error {
    autorizacao_negada: "Erro publico quando o gateway recusa a operacao."
    timeout_gateway: "Erro publico quando o gateway nao responde."
  }
}
```

Validacoes atuais de `route`:

- a `task` precisa existir
- o `caminho` precisa iniciar com `/`
- campos expostos em `input` e `output` precisam existir no contrato da `task`
- erros expostos em `error` precisam pertencer ao contrato da `task`

## Contratos executaveis iniciais nos geradores

Ao final da Fase 3, os geradores passaram a produzir uma camada neutra de contratos executaveis:

- catalogo estruturado de `effects` por `task`
- catalogo estruturado de `errors` por `task`
- funcao dedicada de verificacao de `guarantees`
- contrato publico de `route`
- adaptador publico neutro que chama a `task` associada e mapeia erros publicos

Esses artefatos ainda nao substituem runtime web ou infraestrutura real, mas ja permitem:

- expor a borda publica de forma previsivel
- testar mapeamento de erro publico sem framework
- rastrear contrato interno e contrato externo no mesmo codigo gerado

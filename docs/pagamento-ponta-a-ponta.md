# Pagamento Ponta a Ponta na Sema

Este documento descreve o vertical oficial de pagamento da Sema no marco `0.5`.

O objetivo nao e mostrar um exemplo fofo. O objetivo e demonstrar que a linguagem ja consegue modelar um fluxo de negocio real com:

- contrato publico
- regras
- efeitos operacionais
- transicoes de estado
- orquestracao
- erros publicos
- testes executaveis

## Arquivos de referencia

- `exemplos/pagamento_dominio.sema`
- `exemplos/pagamento.sema`

## Como o vertical foi dividido

### `exemplos.pagamento.dominio`

Centraliza os contratos compartilhados:

- `entity Pagamento`
- `enum StatusPagamento`
- `state ciclo_pagamento`

### `exemplos.pagamento`

Centraliza a operacao do vertical:

- `task processar_pagamento`
- `task confirmar_pagamento`
- `task notificar_falha_pagamento`
- `task registrar_timeout_pagamento`
- `flow orquestracao_pagamento`
- `route processar_pagamento_publico`

## Narrativa do caso

### Entrada publica

A operacao entra por:

- `route processar_pagamento_publico`

Esse contrato publica:

- `pagamento_id`
- `valor`
- `token`

E expoe:

- `pagamento`
- `status`
- erros publicos coerentes com a `task`

### Task interna

A `task processar_pagamento` faz o trabalho central:

- valida entrada
- consulta o gateway
- persiste o pagamento
- emite evento
- notifica comprovante
- registra auditoria
- garante consistencia da saida

### Estado e transicoes

O `state ciclo_pagamento` ancora o contrato de transicao:

- `PENDENTE -> AUTORIZADO`
- `AUTORIZADO -> PROCESSADO`
- `PENDENTE -> RECUSADO`

A `task` explicita quais transicoes ela realmente usa.

### Flow de orquestracao

O `flow orquestracao_pagamento` demonstra:

- passagem de contexto
- confirmacao em caso de sucesso
- notificacao em caso de recusa
- registro de timeout em caso de indisponibilidade
- ramificacao por erro tipado

### Efeitos operacionais

O vertical usa as 5 categorias oficiais da Sema:

- `persistencia`
- `consulta`
- `evento`
- `notificacao`
- `auditoria`

Tambem usa `criticidade` para deixar claro o peso operacional do efeito.

### Falhas reais

O vertical cobre explicitamente:

- autorizacao negada
- saldo insuficiente
- timeout de gateway

## Fluxo de trabalho recomendado

### 1. Escrever ou ajustar os arquivos `.sema`

Use o dominio compartilhado em um modulo e a operacao em outro modulo.

### 2. Aplicar o formato canonico

```bash
node pacotes/cli/dist/index.js formatar exemplos
```

### 3. Validar semanticamente

```bash
node pacotes/cli/dist/index.js validar exemplos/pagamento.sema
```

### 4. Gerar codigo

```bash
node pacotes/cli/dist/index.js compilar exemplos/pagamento.sema --alvo typescript --saida ./.tmp/pagamento-ts
node pacotes/cli/dist/index.js compilar exemplos/pagamento.sema --alvo python --saida ./.tmp/pagamento-py
```

### 5. Verificar o vertical completo

```bash
node pacotes/cli/dist/index.js verificar exemplos/pagamento.sema --json --saida ./.tmp/verificacao-pagamento
```

## O que esse vertical prova

Se esse vertical passa, a Sema ja consegue demonstrar que:

- modela contrato publico
- modela efeitos operacionais
- modela falhas reais
- modulariza dominio com `use`
- gera artefatos coerentes para TypeScript e Python
- executa testes gerados sem gambiarra conceitual

Esse e o criterio pratico que sustenta o marco `0.5` da linguagem.

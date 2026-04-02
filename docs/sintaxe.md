# Sintaxe Canonica

A Sema usa blocos declarativos com chaves e forma previsivel. A regra aqui nao e "ficar bonitinho para humano"; e reduzir ambiguidade para parser, IR, drift e contexto de IA.

## Regras basicas

- um arquivo `.sema` contem um `module` principal
- cada bloco abre com palavra-chave e fecha com `}`
- campos usam `nome: valor`
- linhas declarativas continuam validas para regra, efeito, garantia, transicao e etapa de flow
- `tests` contem blocos `caso`
- quando uma palavra reservada aparece seguida de `:`, ela continua sendo campo, nao bloco

## Blocos de primeira classe

- `module`
- `use`
- `type`
- `entity`
- `enum`
- `state`
- `task`
- `flow`
- `route`
- `worker`
- `evento`
- `fila`
- `cron`
- `webhook`
- `cache`
- `storage`
- `policy`
- `tests`
- `docs`
- `comments`

## Subblocos mais usados

- `input`
- `output`
- `rules`
- `effects`
- `auth`
- `authz`
- `dados`
- `audit`
- `segredos`
- `forbidden`
- `impl`
- `vinculos`
- `execucao`
- `guarantees`
- `error`
- `fields`
- `invariants`
- `transitions`
- `given`
- `when`
- `expect`

## Tipos compostos

A Sema agora aceita formas canonicas para payload mais denso sem empurrar tudo para `Json`.

```sema
input {
  ids: Lista<Id> required
  metadata: Mapa<Texto, Texto>
  responsavel: Opcional<Usuario>
  chave_publica: Texto|Id
}
```

Formas suportadas:

- `Lista<T>`
- `Mapa<K, V>`
- `Opcional<T>`
- `T1|T2`
- `T?`

## Task com contrato operacional

```sema
task processar_pedido {
  input {
    pedido_id: Id required
    itens: Lista<Texto> required
  }
  output {
    protocolo: Id
    status: Texto
  }
  impl {
    ts: app.pedidos.processar
  }
  vinculos {
    arquivo: "src/pedidos/processar.ts"
    simbolo: app.pedidos.processar
    fila: pedidos_processamento
  }
  execucao {
    idempotencia: verdadeiro
    timeout: "30s"
    retry: "3x exponencial"
    compensacao: "reverter_reserva"
    criticidade_operacional: alta
  }
  effects {
    persistencia pedidos criticidade = alta
    auditoria pedidos criticidade = media
  }
  guarantees {
    protocolo existe
    status existe
  }
  error {
    pedido_invalido {
      mensagem: "payload invalido"
      categoria: dominio
      recuperabilidade: permanente
      acao_chamador: corrigir_input
      impacta_estado: falso
      requer_compensacao: falso
    }
  }
  tests {
    caso "processa pedido valido" {
      given {
        pedido_id: "ped_1"
      }
      expect {
        sucesso: verdadeiro
      }
    }
  }
}
```

## `impl`

`impl` liga a task ou a superficie ao simbolo real do runtime.

```sema
impl {
  ts: app.pedidos.processar
  py: services.orders.processar
  cs: Pedidos.Api.Controllers.PedidosController.Processar
}
```

Regras:

- cada origem aparece no maximo uma vez por bloco
- o caminho aponta para simbolo, nao para chamada com `()`
- `ts|typescript`, `py|python`, `dart`, `cs|csharp|dotnet`, `java`, `go|golang`, `rust|rs`, `cpp|cxx|cc|c++` sao origens validas

## `vinculos`

`vinculos` nao substitui `impl`. Ele complementa o contrato com rastros operacionais que ajudam IA e drift a mapear o sistema vivo.

Campos comuns:

- `arquivo`
- `simbolo`
- `rota`
- `superficie`
- `recurso`
- `tabela`
- `fila`
- `worker`
- `evento`
- `cron`
- `webhook`
- `cache`
- `storage`
- `policy`

Exemplo:

```sema
vinculos {
  arquivo: "pacotes/cli/src/index.ts"
  simbolo: cli.src.index.gerarContextoIa
  webhook: "/interno/contexto-ia"
}
```

## `execucao`

`execucao` explicita comportamento operacional em vez de deixar isso espalhado pelo codigo ou pela cabeca da IA.

```sema
execucao {
  idempotencia: verdadeiro
  timeout: "15s"
  retry: "fila"
  compensacao: "nenhuma"
  criticidade_operacional: media
}
```

Campos canonicos:

- `idempotencia`
- `timeout`
- `retry`
- `compensacao`
- `criticidade_operacional`

## Seguranca semantica

Em `task`, `route` e superficies modernas, a Sema agora aceita contratos de seguranca explicitos para reduzir adivinhacao em producao.

- `auth`: como a chamada autentica, com `modo`, `estrategia`, `principal` e `origem`
- `authz`: quem pode executar, com `papel`, `escopo`, `politica` e `tenant`
- `dados`: classificacao de input/output, `redacao_log` e `retencao`
- `audit`: trilha obrigatoria com `evento`, `ator`, `correlacao`, `retencao` e `motivo`
- `segredos`: origem, escopo, rotacao e protecoes de segredo
- `forbidden`: proibicoes explicitas como `shell.exec`, `network.egress`, `log.segredo` e `retorno.credencial`

Exemplo:

```sema
task processar_pagamento {
  input {
    cliente_id: Id required
    token_gateway: Texto required
  }
  output {
    protocolo: Id
    status: Texto
  }
  effects {
    db.write Pagamento criticidade=alta privilegio=escrita isolamento=tenant
    secret.read gateway_api_key criticidade=media privilegio=leitura isolamento=processo
  }
  auth {
    modo: interno
    estrategia: jwt
    principal: servico
    origem: worker
  }
  authz {
    papel: pagamentos_admin
    escopo: pagamentos.processar
    tenant: isolado
  }
  dados {
    classificacao_padrao: interno
    redacao_log: obrigatoria
    retencao: "90d"
    input {
      cliente_id: pii
      token_gateway: credencial
    }
    output {
      protocolo: interno
      status: interno
    }
  }
  audit {
    evento: pagamentos.processado
    ator: auth.servico
    correlacao: request_id
    retencao: "180d"
    motivo: obrigatorio
  }
  segredos {
    gateway_api_key {
      origem: vault
      escopo: runtime
      acesso: gateway_pagamento
      rotacao: "30d"
      nao_logar: verdadeiro
      nao_retornar: verdadeiro
      mascarar: verdadeiro
    }
  }
  forbidden {
    shell.exec
    retorno.credencial
    log.segredo
  }
  guarantees {
    protocolo existe
    status existe
  }
}
```

Esses blocos nao tentam implementar seguranca magica. Eles tornam a intencao auditavel por parser, IR, `drift`, `contexto-ia` e verificacao semantica.

## Superficies modernas

A Sema nao fica presa em HTTP. As bordas abaixo sao blocos irmaos de `route`, com shape minimo compativel com `task`, `impl`, `vinculos`, `execucao` e `effects`.

```sema
worker preparar_briefing {
  task: medir_drift
  vinculos {
    arquivo: "pacotes/cli/src/index.ts"
    worker: contexto_ia
  }
  execucao {
    retry: "fila_contexto"
    criticidade_operacional: alta
  }
}

webhook confirmar_contexto {
  task: mapear_projeto
  vinculos {
    webhook: "/interno/contexto-ia"
  }
  execucao {
    timeout: "15s"
    criticidade_operacional: media
  }
}
```

## Flow com dependencia explicita

```sema
flow operar_contexto_ia {
  entrada: Texto
  etapa mapear usa mapear_projeto com entrada = entrada
  etapa drift usa medir_drift com contrato = entrada depende_de mapear
  etapa briefing usa preparar_briefing com entrada = entrada depende_de drift
  effects {
    auditoria contexto_ia criticidade = alta
  }
  vinculos {
    simbolo: cli.src.index.comandoContextoIa
  }
}
```

## Forma canonica

O formatador passa a preferir:

- `vinculos` com `arquivo` antes de `simbolo`
- `auth` com `modo`, `estrategia`, `principal` e `origem`
- `authz` com `papel|papeis`, `escopo|escopos`, `politica` e `tenant`
- `dados` com `classificacao_padrao`, `redacao_log` e `retencao`
- `audit` com `evento`, `ator`, `correlacao`, `retencao` e `motivo`
- `execucao` com `idempotencia`, `timeout`, `retry`, `compensacao` e `criticidade_operacional`
- strings operacionais como `arquivo`, `timeout`, `retry`, `compensacao`, `retencao` e `rotacao` com aspas
- tipos compostos sem espacos quebrados em `Lista<T>` e `Mapa<K, V>`

## Resumo pratico

Se a duvida for "isso vai ajudar a IA a editar com menos chute?", a sintaxe nova aponta para quatro coisas:

- contrato rico
- seguranca semantica explicita
- vinculo rastreavel
- execucao explicita
- superficie moderna de primeira classe

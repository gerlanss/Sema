# Sintaxe Canonica

A Sema usa blocos declarativos previsiveis para reduzir ambiguidade no parser, na IR, no drift e no contexto de IA.

## Regras basicas

- um arquivo `.sema` contem um `module` principal
- cada bloco abre com palavra-chave e fecha com `}`
- campos usam `nome: valor`
- blocos declarativos podem aparecer aninhados quando o contrato exigir
- `tests` usa blocos `caso`

## Blocos de primeira classe

- `module`
- `use`
- `database`
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

## Subblocos comuns

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

## Persistencia vendor-first

O bloco `database` modela banco e recursos persistidos sem apagar as diferencas entre engines.

Estrutura base:

```sema
database principal_postgres {
  engine: postgres
  consistency: forte
  durability: alta
  transaction_model: mvcc
  query_model: sql
}
```

Recursos canonicamente suportados:

- `table`
- `index`
- `relationship`
- `query`
- `retention`
- `lock`
- `replication`
- `collection`
- `document`
- `keyspace`
- `stream`
- `capabilities`

Exemplo relacional:

```sema
database principal_postgres {
  engine: postgres
  schema: public
  capabilities {
    joins
    views
    foreign_keys
  }
  table pedidos {
    entity: Pedido
  }
  relationship pedido_cliente {
    from: Pedido
    to: Cliente
  }
  query buscar_pedidos {
    mode: sql
  }
}
```

Exemplo documental:

```sema
database principal_mongodb {
  engine: mongodb
  query_model: documento
  collection pedidos {
    collection: pedidos
  }
  document pedido_snapshot {
    entity: PedidoSnapshot
  }
  query pipeline_pedido {
    mode: pipeline
  }
}
```

Exemplo key-value:

```sema
database principal_redis {
  engine: redis
  query_model: chave_valor
  keyspace cache_pedidos {
    ttl: "300s"
  }
  stream eventos_pedido {
    surface: fila
  }
}
```

## Compatibilidade declarada

O IR de persistencia calcula compatibilidade por recurso com quatro estados:

- `nativo`
- `adaptado`
- `parcial`
- `invalido`

Isso existe para deixar explicito quando um contrato esta pedindo de um banco algo que ele nao entrega do mesmo jeito.

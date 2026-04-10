# Persistencia Vendor-First

Sema 1.4.0 trata banco como superficie semantica de primeira classe. Isso significa assumir diferencas reais entre engines e coloca-las no contrato, no semantico, no IR, no drift e na extensao.

## Engines publicas

- `postgres`
- `mysql`
- `sqlite`
- `mongodb`
- `redis`

## Exemplo PostgreSQL

```sema
database principal_postgres {
  engine: postgres
  schema: public
  consistency: forte
  durability: alta
  transaction_model: mvcc
  query_model: sql
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

## Exemplo MySQL

```sema
database principal_mysql {
  engine: mysql
  consistency: forte
  durability: alta
  transaction_model: bloqueio
  query_model: sql
  table faturamento {
    table: faturamento
  }
  index faturamento_status {
    table: faturamento
  }
  query buscar_faturas {
    mode: sql
  }
}
```

## Exemplo SQLite

```sema
database principal_sqlite {
  engine: sqlite
  consistency: snapshot
  durability: media
  transaction_model: single_thread
  query_model: sql
  table cache_local {
    table: cache_local
  }
  retention limpeza_local {
    retention: "7d"
  }
}
```

## Exemplo MongoDB

```sema
database principal_mongodb {
  engine: mongodb
  consistency: eventual
  durability: alta
  transaction_model: documento
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

## Exemplo Redis

```sema
database principal_redis {
  engine: redis
  consistency: eventual
  durability: media
  transaction_model: single_thread
  query_model: chave_valor
  keyspace cache_pedidos {
    ttl: "300s"
  }
  stream eventos_pedido {
    surface: fila
  }
  retention expurgo_cache {
    retention: "300s"
  }
}
```

## Compatibilidade calculada

Cada recurso recebe compatibilidade por engine:

- `nativo`
- `adaptado`
- `parcial`
- `invalido`

Isso deixa explicito quando o contrato esta pedindo portabilidade falsa, por exemplo:

- `table` em `redis`
- `foreign_keys` em engine sem suporte equivalente
- transacao multi-documento tratada como universal

## Onde isso aparece

- parser e AST
- IR canonica
- analisador semantico
- formatador
- `sema drift`
- `sema importar`
- extensao VS Code

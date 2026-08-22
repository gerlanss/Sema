<!-- sema:agent-entrypoint:start -->
# Sema Syntax for Codex

Use this file as a compact reference before creating or fixing `.sema` contracts.

## Golden Rule

Contract comes before code. Before writing `.sema`, read the local examples in `exemplos/`.

## Minimal Example

```sema
module app.example {
  entity Item {
    fields {
      id: Id
      name: Texto
      active: Booleano
    }
  }

  task create_item {
    input {
      name: Texto required
    }
    output {
      item: Item
    }
    rules {
      name deve_ser preenchido
    }
    effects {
      persistencia Item
      auditoria item_created
    }
    guarantees {
      item existe
    }
    tests {
      caso "creates valid item" {
        given { name: "Item" }
        expect { sucesso: verdadeiro }
      }
    }
  }
}
```

## Common Blocks

- `docs`: module summary and notes.
- `entity`: domain model.
- `task`: governed operation.
- `input` and `output`: input and output contracts.
- `rules`: validations and business rules.
- `effects`: persistence, reads, events, audit, and external calls.
- `guarantees`: what the task must provide after success.
- `error`: named errors and messages.
- `tests`: minimal behavior examples.
- `route`: public surface linked to a task.
- `impl` and `vinculos`: links between the contract and real code.

## Canonical `use` and `impl` Origins

Use these origins before inventing a new one (aliases after `ou`):

- `ts` ou `typescript`
- `js` ou `javascript`
- `py` ou `python`
- `dart`
- `lua`
- `cs`, `csharp` ou `dotnet`
- `java`
- `go` ou `golang`
- `rust` ou `rs`
- `cpp`, `cxx`, `cc` ou `c++`
- `php`

Examples:

```sema
use javascript app.web.expenses

impl {
  js: src.app.saveExpense
}
```

```sema
use php app.legacy.pedidos

impl {
  php: pedidos.criarPedido
}
```

`sema compilar --alvo javascript` defines a generation target. `impl { js: ... }` defines the live-code origin linked to the contract. They are different layers and both are valid.

## Layered `impl` Roles

Layered code (route + service + persistence in the same language) can declare one `impl` per role. Append a supported role to any origin: `rota`, `servico`, `persistencia` or `repositorio`.

```sema
impl {
  ts_rota: server.routes.monitores.criarMonitor
  ts_servico: server.services.monitores.criarMonitor
  ts_persistencia: server.repositories.monitores.criar
}
```

The role suffix combines with every origin, not only TypeScript:

```sema
impl {
  php_rota: pedidos.rota.criarPedido
  php_servico: pedidos.servico.criarPedido
  php_persistencia: pedidos.repositorio.criar
}
```

Each origin-plus-role pair must appear at most once; the bare origin (for example `ts`) stays valid for single-layer tasks, and drift resolves every role independently.

## Small Canonical Lists

- `effects`: `persistencia`, `consulta`, `evento`, `auditoria`, `db.write`, `queue.publish`, `fs.write`, `network.egress`, `secret.read`, `shell.exec`.
- `audit.motivo`: `obrigatorio`, `opcional`, `dispensado`.

## Contract Size

- up to 300 lines: healthy
- 301-500 lines: diagnostic warning, plan a split
- above 500: blocks creation, edits, drift, finalization, generation, and snapshots
- split by real domain/capability, such as `expenses_entry.sema`, `expenses_totals.sema`, `expenses_persistence.sema`
- never use `parte_1`, `parte_2`, `part_3`, or equivalent names
- do not remove `guarantees`, `tests`, `authz`, `dados`, or `vinculos` just to fit under the limit
- multiple `.sema` contracts may govern the same code file through `vinculos`; this is expected

## JavaScript Is Supported

The CLI supports JavaScript generation:

```bash
sema compilar contratos/orders.sema --alvo javascript --saida ./generated/javascript
```

The project can also generate TypeScript, Python, PHP, Dart, Lua, HTML, CSS, C#/.NET (`dotnet`), and C++ (`cpp`) when those targets are enabled in `sema.config.json`.

## Support Files

- `AGENTS.md`: official Codex repository rules, loaded automatically.
- `SEMA_BOOT.md`: first Sema read for Codex.
- `SEMA_SMALL_MODEL.md`: compact guidance for a small context budget.
- `AGENT_CONTEXT_PACK.json`: structured Codex context pack.
- `SEMA_INDEX.json`: project index.
- `docs/commands.md`: command catalog, gates, and `--saida` rule.
- `exemplos/`: official DSL examples.

If Codex does not know which shape to use, it must open `exemplos/calculadora.sema`, `exemplos/crud_simples.sema`, `exemplos/pagamento.sema`, or `exemplos/tratamento_erro.sema` before inventing syntax.

Platform policy: Sema governs project contracts, scope, drift, evidence, and quality. It never bypasses platform policies, permissions, security controls, terms, or laws.
<!-- sema:agent-entrypoint:end -->

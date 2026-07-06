<!-- sema:agent-entrypoint:start -->
# Sema Syntax for AI Agents

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

Use these origins before inventing a new one:

- `ts` ou `typescript`
- `js` ou `javascript`
- `py` ou `python`
- `dart`
- `lua`
- `cs` ou `dotnet`
- `java`
- `go`
- `rust`
- `cpp`
- `php`

Examples:

```sema
use javascript app.web.expenses

impl {
  js: src.app.saveExpense
}
```

`sema compilar --alvo javascript` defines a generation target. `impl { js: ... }` defines the live-code origin linked to the contract. They are different layers and both are valid.

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

The CLI supports JavaScript and PHP generation:

```bash
sema compilar contratos/orders.sema --alvo javascript --saida ./generated/javascript
```

The project can also generate TypeScript, Python, PHP, Dart, Lua, HTML, and CSS when those targets are enabled in `sema.config.json`.

## Support Files

- `AGENTS.md`: required agent rules.
- `SEMA_BOOT.md`: first read for every AI agent.
- `SEMA_SMALL_MODEL.md`: short version for weaker agents.
- `AGENT_CONTEXT_PACK.json`: structured agent context pack.
- `SEMA_INDEX.json`: project index.
- `docs/commands.md`: command catalog, gates, and `--saida` rule.
- `exemplos/`: official DSL examples.

If an AI agent does not know which shape to use, it must open `exemplos/calculadora.sema`, `exemplos/crud_simples.sema`, `exemplos/pagamento.sema`, or `exemplos/tratamento_erro.sema` before inventing syntax.

Platform policy: O Sema governa contrato, escopo, drift, evidência e qualidade do projeto. Ele não pede, não autoriza e não contorna políticas da plataforma, termos de uso, permissões, segurança ou leis.
<!-- sema:agent-entrypoint:end -->

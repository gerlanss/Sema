# CLI da Sema

## Papel da CLI

A CLI e a interface oficial da Sema para:

- validar contratos `.sema`
- exportar AST e IR
- medir `drift` entre contrato e codigo vivo
- importar legado para rascunho revisavel
- gerar codigo derivado
- preparar contexto IA-first
- verificar multiplos alvos de geracao

## Tres modos de operacao

Projeto novo:

- `sema iniciar`
- `sema validar`
- `sema compilar`
- `sema verificar`

Projeto ja semantizado:

- `sema inspecionar`
- `sema resumo`
- `sema drift`
- `sema contexto-ia`

Adocao incremental:

- `sema importar`
- `sema formatar`
- `sema validar`
- `sema drift`

## Persistencia vendor-first

A linha 1.5.1 adiciona uma secao canonica de persistencia no contrato, no semantico, no IR e no formatador, alem de `drift` com escopo real, `impacto` e renomeacao semantica assistida.

Cobertura publica:

- `postgres`: `table`, `relationship`, `query`, `schema`, capacidades relacionais
- `mysql`: `table`, `index`, consultas SQL e diferencas operacionais do engine
- `sqlite`: `table`, `retention`, uso local e edge
- `mongodb`: `collection`, `document`, `query` em `pipeline`
- `redis`: `keyspace`, `stream`, `retention`, TTL e superficies de estado

## Drift e codigo vivo

`sema drift` agora cruza contrato com recursos reais encontrados em:

- codigo de backend
- DDL `.sql`
- schema `.prisma`
- uso de MongoDB
- uso de Redis, incluindo keyspaces e streams

O objetivo nao e adivinhar tudo; e produzir um score explicavel com lacunas claras.

## Ajuda IA-first

- `sema ajuda-ia`
- `sema starter-ia`
- `sema resumo <arquivo-ou-pasta> --micro|--curto|--medio`
- `sema prompt-curto <arquivo-ou-pasta> --micro|--curto|--medio`
- `sema contexto-ia <arquivo.sema> --saida <diretorio>`
- `sema sync-ai-entrypoints --json`

## Importadores publicos

- `nestjs`
- `fastapi`
- `flask`
- `nextjs`
- `nextjs-consumer`
- `react-vite-consumer`
- `angular-consumer`
- `flutter-consumer`
- `firebase`
- `dotnet`
- `java`
- `go`
- `rust`
- `cpp`
- `typescript`
- `python`
- `dart`

## Comandos mais usados

```bash
sema validar <arquivo-ou-pasta> --json
sema diagnosticos <arquivo.sema> --json
sema ir <arquivo.sema> --json
sema drift <arquivo-ou-pasta> --json
sema importar <fonte> <diretorio> --saida <diretorio> --json
sema compilar <arquivo-ou-pasta> --alvo <typescript|python|dart|lua> --saida <diretorio>
sema verificar <arquivo-ou-pasta> --saida <diretorio>
```

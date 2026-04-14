# Importacao de Legado

`sema importar` existe para bootstrap revisavel, nao para produzir contrato final perfeito sem revisao humana.

## Fluxo recomendado

```bash
sema importar <fonte> <diretorio> --saida ./contratos-importados --json
sema formatar ./contratos-importados
sema validar ./contratos-importados --json
sema drift ./contratos-importados --json
```

## Fontes publicas

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

## Persistencia na linha 1.5.7

A importacao legada agora tenta reconhecer sinais de persistencia vendor-first, incluindo:

- SQL e DDL para recursos relacionais
- `schema.prisma` e artefatos semelhantes
- uso de MongoDB com `collection`, `document` e consultas documentais
- uso de Redis com keyspaces, TTL e streams
- apps `angular-consumer` standalone sem `.routes`, usando `src/app.component.ts` como shell inicial e componentes alcançaveis como superfícies consumer

O contrato gerado continua sendo rascunho. A confirmacao final vem de:

- `sema validar`
- `sema drift`
- revisao do proprio contrato

## Regras de uso

- importe pela raiz do projeto sempre que possivel
- use a saida em pasta separada
- formate e valide antes de tentar compilar
- trate o primeiro `drift` como score inicial de adocao, nao como sentenca final

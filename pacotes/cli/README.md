# Sema CLI

`@semacode/cli` e a interface publica principal da Sema.

Ela valida contratos `.sema`, mede `drift` entre contrato e codigo vivo, importa legado, gera codigo derivado, produz contexto IA-first e agora governa persistencia vendor-first para `postgres`, `mysql`, `sqlite`, `mongodb` e `redis`.

## Instalar

Global:

```bash
npm install -g @semacode/cli
sema --help
sema doctor
```

Local ao projeto:

```bash
npm install @semacode/cli
npx sema --help
```

Tarball da release:

```bash
npm install -g https://github.com/gerlanss/Sema/releases/latest/download/sema-cli-latest.tgz
```

## Fluxos principais

Projeto novo:

```bash
sema iniciar
sema validar contratos/pedidos.sema --json
sema compilar contratos --alvo typescript --saida ./generated/typescript
sema verificar contratos --json
```

Projeto que ja usa Sema:

```bash
sema inspecionar . --json
sema resumo contratos/pedidos.sema --micro --para mudanca
sema drift contratos/pedidos.sema --json
sema contexto-ia contratos/pedidos.sema --saida ./.tmp/contexto --json
```

Adocao incremental em legado:

```bash
sema importar nextjs ./app --saida ./contratos-importados --json
sema formatar ./contratos-importados
sema validar ./contratos-importados --json
sema drift ./contratos-importados --json
```

## Persistencia vendor-first

A CLI 1.5.4 entende blocos `database` e recursos de persistencia no IR, no formatador, no semantico, na importacao, no drift, no impact map, na renomeacao semantica assistida e no `verificar`. O objetivo nao e esconder diferencas entre bancos, e sim capturar essas diferencas no contrato.

Nesta linha, o `drift` tambem passa a resolver melhor metodos JS/TS browser-side definidos via `Object.assign(...prototype...)` e a entrada padrao da CLI para de tropeçar em `exemplos/` quando o projeto real ja tem `contratos/`, `sema/` ou arquivos `.sema` na raiz.

Cobertura publica:

- `postgres`: tabela, relacao, query SQL, schema e capacidades relacionais
- `mysql`: tabela, indice e diferencas operacionais do engine
- `sqlite`: armazenamento local, retencao curta e modos de transacao simples
- `mongodb`: `collection`, `document`, pipeline e indices documentais
- `redis`: `keyspace`, `stream`, TTL e superficies de estado/cache

## Pacote publico

O tarball publico da CLI inclui:

- `dist/`
- docs IA-first e docs de operacao
- pasta `exemplos/`
- `AGENTS.md`, `llms.txt`, `SEMA_BRIEF.*` e `SEMA_INDEX.json`

## Comandos uteis

- `sema validar <arquivo-ou-pasta> --json`
- `sema drift <arquivo-ou-pasta> --json`
- `sema resumo <arquivo-ou-pasta> --micro --para onboarding`
- `sema prompt-curto <arquivo-ou-pasta> --curto --para mudanca`
- `sema contexto-ia <arquivo.sema> --saida <diretorio> --json`
- `sema compilar <arquivo-ou-pasta> --alvo <typescript|python|dart|lua> --saida <diretorio>`
- `sema verificar <arquivo-ou-pasta> --saida <diretorio>`

## Links

- repositorio: <https://github.com/gerlanss/Sema>
- docs: <https://github.com/gerlanss/Sema/tree/main/docs>

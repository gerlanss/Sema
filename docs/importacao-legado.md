# Importacao de Legado para Sema

A Sema agora consegue importar projetos que **nao nasceram com ela** e gerar um rascunho `.sema` revisavel.

Isso nao e magia nem papo de coach semantico.

Leitura honesta:

- a CLI nao reconstrói perfeitamente toda a intencao do sistema
- ela puxa um rascunho forte a partir de codigo vivo
- esse rascunho serve para adocao incremental
- depois voce revisa, lapida, valida e conecta com o projeto real
- depois voce mede `drift` para saber onde contrato e codigo vivo estao se afastando

## Fontes suportadas

- `nestjs`
- `fastapi`
- `flask`
- `nextjs`
- `firebase`
- `dotnet`
- `java`
- `go`
- `rust`
- `cpp`
- `typescript`
- `python`
- `dart`

## Comando

```bash
sema importar <nestjs|fastapi|flask|nextjs|firebase|dotnet|java|go|rust|cpp|typescript|python|dart> <diretorio> [--saida <diretorio>] [--namespace <base>] [--json]
```

## O que a importacao tenta puxar

- `task`
- `route`, quando a fonte tiver borda publica identificavel
- `entity`
- `enum`
- `error`
- `impl`

## O que ela faz bem

- cortar o trabalho bruto de migracao
- dar um ponto de partida semantico coerente
- transformar service/controller/router/funcao em rascunho de contrato
- acelerar a adocao da Sema em projeto vivo

No caso de `Next.js App Router`, o bootstrap automatico ficou mais forte:

- aceita raiz do repo, `app/`, `src/app/`, `app/api/`, `src/app/api/` e subpasta concreta de rota
- puxa `params`, `query`, `body`, `status` e `response` quando o handler entrega sinal forte
- entende melhor `request.json()` com cast inline, destructuring comum, `searchParams`, `NextResponse.json(...)` direto ou via variavel local e schema local simples com `zod`
- continua caindo em `Json` so quando nao houver informacao confiavel

## O que ela nao promete

- entender toda a intencao do dominio sem revisao humana
- substituir leitura do projeto legado
- inferir perfeitamente regras implicitas espalhadas em if, banco, decorator e middleware

## Fluxo recomendado

1. rode `sema importar`
2. abra os `.sema` gerados
3. ajuste nomes, contratos, `rules`, `guarantees`, `effects` e `flow`
4. rode `sema formatar`
5. rode `sema validar --json`
6. conecte implementacoes reais com `impl`
7. rode `sema drift --json`
8. rode `sema compilar` para gerar scaffold quando fizer sentido

## Governar drift

Depois que o rascunho virou contrato revisado e voce ligou `impl`, a CLI consegue inspecionar o afastamento entre a Sema e o projeto vivo:

```bash
sema drift --json
```

O `drift` acusa:

- `impl` valido
- `impl` quebrado
- `task` sem implementacao
- rota publica divergente em NestJS/FastAPI/Flask/Next.js quando houver sinal suficiente
- recurso vivo divergente em worker Firebase quando o contrato declarar persistencia verificavel

Leitura certa:

- `drift` nao substitui revisao humana
- `drift` existe para impedir que o contrato apodreca enquanto o projeto anda

## Exemplos

### NestJS

```bash
sema importar nestjs ./backend --saida ./sema/importado --json
```

### FastAPI

```bash
sema importar fastapi ./app --saida ./sema/importado --json
```

### Flask

```bash
sema importar flask ./Gestech --saida ./sema/importado --json
```

### Next.js App Router

```bash
sema importar nextjs ./src/app/api --saida ./sema/importado --json
```

Tambem funciona a partir de:

- raiz do projeto Next
- `app/`
- `src/app/`
- `app/api/`
- subpasta concreta como `src/app/api/auth/session`

### Firebase worker

```bash
sema importar firebase ./worker --saida ./sema/importado --json
```

### Python generico

```bash
sema importar python ./servicos --saida ./sema/importado
```

### TypeScript generico

```bash
sema importar typescript ./src --saida ./sema/importado
```

### Dart

```bash
sema importar dart ./lib --saida ./sema/importado
```

## Quando isso vale muito a pena

- backend legado com regra critica
- projeto onde o contrato esta espalhado e mal documentado
- migracao incremental para NestJS ou FastAPI governados por contrato
- migracao incremental para Flask governado por contrato sem perder `Blueprint` e `url_prefix`
- migracao incremental para `Next.js App Router` sem perder inventario real de rota publica
- bootstrap forte de contrato HTTP em `Next.js App Router`, mesmo quando o handler ainda nao esta bonitinho
- migracao incremental para worker `Node/Firebase` sem ficar cego para bridge, health endpoint e recurso persistido
- onboarding de IA em projeto velho sem jogar a coitada no pantano sem mapa

## Regra de ouro

Use a importacao como **ponte para governanca semantica**, nao como desculpa para confiar cegamente em inferencia automatica.

# Sema Backend-First

A Sema continua sendo uma linguagem de intencao, mas o produto agora se apresenta primeiro como **Protocolo de Governanca de Intencao para IA e backend vivo**.

Leitura direta:

- a Sema manda no contrato e no significado
- a stack real continua em NestJS, FastAPI, Flask, TypeScript, Python ou Dart
- o foco pratico e criar, importar e editar backends reais sem perder a trilha semantica

## O que isso significa hoje

No marco publico `0.8.x backend generico`, a Sema cobre:

- scaffold base para TypeScript, Python e Dart
- scaffold orientado a framework para NestJS e FastAPI
- starters oficiais para `nextjs-api` e `node-firebase-worker`
- importacao assistida de legado para NestJS, FastAPI, Flask, Next.js App Router, Node/Firebase worker, TypeScript, Python e Dart
- configuracao de projeto com `sema.config.json`
- resolucao de `use` em multiplas origens do projeto
- inspecao nao destrutiva com `sema inspecionar`
- governanca de `drift` com `sema drift`
- ligacao de `task` com implementacao externa via `impl`

## O que muda no fluxo

Antes, o uso comum era:

1. escrever `.sema`
2. validar
3. compilar para uma pasta generica

Agora, em projeto vivo, o fluxo util fica:

1. importar ou curar o contrato
2. revisar a intencao
3. ligar `impl`
4. rodar `sema inspecionar`
5. rodar `sema drift`
6. preparar contexto para IA com `sema contexto-ia`
7. compilar scaffold quando fizer sentido

## Compatibilidade legado

- `NestJS`, `FastAPI`, `Flask`: importar + `drift` de rota publica
- `Next.js App Router`: importar + `drift` de rota publica por `route.ts`
- `Node/Firebase worker`: importar + `drift` de health endpoint e recurso persistido
- `TypeScript`, `Python`, `Dart`: importacao generica + resolucao de simbolo

No caso de Flask, isso cobre:

- `Application Factory`
- `Blueprint`
- `url_prefix`
- `@app.route`
- `@bp.route`

No caso de `Next.js App Router`, isso cobre:

- `app/api/**/route.ts`
- `src/app/api/**/route.ts`
- segmentos dinamicos `[id]`, `[...slug]` e `[[...slug]]`

No caso de `Node/Firebase worker`, isso cobre:

- bridge explicita para `impl`
- endpoint HTTP minimo do worker
- recurso persistido descoberto em colecoes/constantes do runtime

## Showcase oficial

Se voce quiser ver isso sem depender de benchmark externo, o case oficial esta em [showcases/ranking-showroom](../showcases/ranking-showroom/).

Ele demonstra:

- backend Flask pequeno e real
- contrato `.sema` curado
- `impl` resolvendo simbolo vivo
- `drift` sem divergencia
- `contexto-ia` com `drift.json`

## O papel de `impl`

`impl` continua sendo a ponte mais limpa entre intencao e codigo vivo.

Exemplo:

```sema
task processar_pagamento {
  input {
    pagamento_id: Id required
  }
  output {
    protocolo: Id
  }
  impl {
    ts: app.pagamentos.processar
    py: servicos.pagamentos.processar
  }
  guarantees {
    protocolo existe
  }
}
```

Leitura pratica:

- a Sema manda no contrato
- o framework mantem a execucao real
- `impl` deixa rastreavel onde a verdade vive

## O que isso nao e

- nao e runtime proprio
- nao e framework acoplado a sintaxe
- nao e promessa de "gerar backend inteiro sem tocar em nada"

E protocolo semantico aplicado a sistema vivo. Esse e justamente o ponto.

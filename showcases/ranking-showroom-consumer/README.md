# Ranking Showroom Consumer

Este showcase companion abre a trilha oficial de front da Sema sem vender fumaça: um consumer Next.js App Router consumindo o showroom Flask ja mostrado em `showcases/ranking-showroom`.

## Slice oficial desta fase

- `consumer bridge` canonico em `src/lib/sema_consumer_bridge.ts`
- superficies App Router em `src/app/**/page.tsx`, `loading.tsx` e `error.tsx`
- `impl` apontando so para bridge exportado
- `vinculos` rastreando bridge, arquivos e superficie `/ranking`

## O que este showcase nao promete

- nao gera UI completa sozinho
- nao faz visual drift
- nao tenta modelar CSS, layout fino ou arvore de componentes na linguagem

## Walkthrough rapido

Na raiz deste showcase:

```bash
sema validar contratos/showroom_consumer.sema --json
sema inspecionar . --json
sema drift contratos/showroom_consumer.sema --json
sema contexto-ia contratos/showroom_consumer.sema --saida ./.tmp/contexto-ranking-consumer --json
```

Saida esperada:

- `inspecionar` detecta `nextjs-consumer`
- `drift` resolve bridge e superficies App Router
- `contexto-ia` gera `resumo.*`, `briefing*.json` e `drift.json` com `consumerFramework`, `appRoutes`, `consumerSurfaces` e `consumerBridges`

## Observacao honesta

O bridge abaixo aponta para o endpoint Flask do showroom backend (`/api/ranking-showroom`), mas os testes deste repositorio validam so a trilha semantica e o rastreamento consumer. Nao precisa subir o backend para `validar`, `inspecionar`, `drift` ou `contexto-ia`.

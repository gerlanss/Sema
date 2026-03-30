# Scorecard de Compatibilidade

Este documento existe para matar uma confusao comum: "suporta" nao significa porra nenhuma se a gente nao disser **o que** a Sema realmente consegue verificar em cada familia de stack.

## Regua oficial

Cada familia recebe nota de `0` a `10` com a mesma rubrica:

- `4 pontos`: `drift` verificavel da superficie principal
- `2 pontos`: `importar` produz rascunho util e revisavel
- `2 pontos`: existe trilha oficial de criacao
- `1 ponto`: `contexto-ia` e edicao assistida ficam acionaveis
- `1 ponto`: docs, showcase ou trilha de adocao estao honestos

Regras duras:

- stack HTTP nao ganha `9` sem `route drift` verde
- stack de dados/eventos nao ganha `9` sem `drift` de recurso vivo verde
- stack generic bridge/symbol nao ganha `9` sem `impl`/bridge drift verde

## Classes oficiais de compatibilidade

- `HTTP first-class`
- `dados/eventos first-class`
- `generic bridge/symbol first-class`
- `inventariado/backlog`

## Linha publica atual

- linha backend publica: `0.8.x`
- foco desta onda: familias backend genericas com nota `9+`
- proxima onda declarada: `0.9.x` para consumidor, desktop, mobile e frontend que ainda nao fecharem `9`

## Benchmark oficial por familia

- `Python / Flask`: `Gestech` e `FuteBot`
- `Next.js App Router / Node HTTP`: `Gestech/Ferramentas` e `Gestech/Lothar.io dashboard`
- `Firebase / Node worker`: `Gestech/Lothar.io worker`
- `ASP.NET Core`: fixture sintetico oficial + smoke local opcional
- `Spring Boot`: fixture sintetico oficial + smoke local opcional
- `Go net/http + Gin`: fixture sintetico oficial + smoke local opcional
- `Rust Axum`: fixture sintetico oficial + smoke local opcional
- `C++ bridge/service`: fixture sintetico oficial + smoke local opcional
- `Flutter / Dart consumidor`: `Gestech/Ranking_App`

## Matriz oficial

| Familia | Classe | Criacao | Importar | Drift principal | Contexto-IA | Nota |
| --- | --- | --- | --- | --- | --- | --- |
| NestJS | HTTP first-class | scaffold oficial | sim | rota publica | forte | 9.2 |
| FastAPI | HTTP first-class | scaffold oficial | sim | rota publica | forte | 9.2 |
| Flask | HTTP first-class | starter/adocao incremental | sim | rota publica | forte | 9.5 |
| Next.js App Router | HTTP first-class | `nextjs-api` | sim | rota publica | forte | 9.1 |
| ASP.NET Core | HTTP first-class | `aspnet-api` | sim | rota publica | forte | 9.0 |
| Spring Boot | HTTP first-class | `springboot-api` | sim | rota publica | forte | 9.0 |
| Go net/http + Gin | HTTP first-class | `go-http-api` | sim | rota publica | forte | 9.0 |
| Rust Axum | HTTP first-class | `rust-axum-api` | sim | rota publica | forte | 9.0 |
| Node / Firebase worker | dados/eventos first-class | `node-firebase-worker` | sim | recurso vivo + rota worker | forte | 9.1 |
| TypeScript generico | generic bridge/symbol first-class | base | sim | simbolo/bridge | forte | 9.0 |
| Python generico | generic bridge/symbol first-class | base | sim | simbolo/bridge | forte | 9.0 |
| Dart generico | generic bridge/symbol first-class | base | sim | simbolo/bridge | forte | 9.0 |
| C++ bridge/service | generic bridge/symbol first-class | `cpp-service-bridge` | sim | simbolo/bridge | forte | 9.0 |
| Flutter / Dart consumidor | generic bridge/symbol first-class | base + bridge | parcial forte | bridge/consumer | forte | 9.0 |
| Angular consumidor | inventariado/backlog | nao | parcial por TypeScript | bridge parcial | medio | 7.5 |
| .NET desktop/MAUI/WPF | inventariado/backlog | nao | parcial por `cs:` | bridge parcial | medio | 7.5 |

## Limites honestos por familia

### Next.js App Router

- cobre `app/api/**/route.ts` e `src/app/api/**/route.ts`
- cobre `[id]`, `[...slug]` e `[[...slug]]`
- `Pages API`, `Express`, `Hono` e derivados continuam fora desta fatia oficial

### Node / Firebase worker

- cobre worker, bridge e recurso persistido
- nao cobre "todo o ecossistema Google", porque isso seria papo de vendedor picareta

### C++

- nesta onda entra como `generic bridge/symbol first-class`
- nao promete `route drift` HTTP
- codigo gerado de Flutter, vendor, build e runner nao entra na nota

### Consumer/desktop/mobile

- a linha `0.8.x` fecha backend
- a linha `0.9.x` fecha consumidor e desktop onde ainda faltar trilha mais redonda

## O que significa `9/10` na pratica

Se uma familia estiver `9/10`, a promessa minima e esta:

- `validar` fica verde
- `importar` gera um rascunho decente
- `drift` cobre a superficie principal de verdade
- existe trilha oficial de criacao
- IA consegue editar sem sair cacando simbolo igual barata tonta

Se nao fechar isso, a nota nao sobe por caridade.

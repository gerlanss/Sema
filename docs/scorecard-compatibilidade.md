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

## Nivel de genericidade

Esta e a outra metade da conversa. A classe diz **onde** a Sema atua; o nivel de genericidade diz **quao amplo** e o slice oficial dessa atuacao.

- `framework slice oficial`: a familia tem um recorte publico fechado, com surface concreta de framework e `drift` da borda principal
- `generic backend`: a familia entra por simbolo, bridge, service ou recurso vivo, sem fingir que todo framework do ecossistema esta coberto
- `consumer bridge oficial`: a familia consumidora entra por bridge/consumer formal e contexto acionavel para IA
- `inventariado`: a familia foi mapeada e documentada, mas ainda nao tem promessa first-class

Regra de honestidade:

- o nivel generico pode subir com o tempo
- a nota so acompanha quando o escopo oficial realmente aumentar
- o produto promete o slice atual, nao a fantasia do “qualquer coisa deve funcionar”

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

| Familia | Classe | Nivel de genericidade | Slice oficial hoje | Criacao | Importar | Drift principal | Contexto-IA | Nota |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| NestJS | HTTP first-class | framework slice oficial | controller/route NestJS | scaffold oficial | sim | rota publica | forte | 9.2 |
| FastAPI | HTTP first-class | framework slice oficial | route/handler FastAPI | scaffold oficial | sim | rota publica | forte | 9.2 |
| Flask | HTTP first-class | framework slice oficial | `Blueprint`, `url_prefix`, `@route` | starter/adocao incremental | sim | rota publica | forte | 9.5 |
| Next.js App Router | HTTP first-class | framework slice oficial | `app/api/**/route.ts` | `nextjs-api` | sim | rota publica + bootstrap semantico forte | forte | 9.1 |
| ASP.NET Core | HTTP first-class | framework slice oficial | controller + Minimal API | `aspnet-api` | sim | rota publica | forte | 9.0 |
| Spring Boot | HTTP first-class | framework slice oficial | `@RestController` + `@*Mapping` | `springboot-api` | sim | rota publica | forte | 9.0 |
| Go net/http + Gin | HTTP first-class | framework slice oficial | `HandleFunc`, `ServeMux`, `Gin` | `go-http-api` | sim | rota publica | forte | 9.0 |
| Rust Axum | HTTP first-class | framework slice oficial | `Router::route` + `nest` simples | `rust-axum-api` | sim | rota publica | forte | 9.0 |
| Node / Firebase worker | dados/eventos first-class | generic backend | worker + bridge + recurso persistido | `node-firebase-worker` | sim | recurso vivo + rota worker | forte | 9.1 |
| TypeScript generico | generic bridge/symbol first-class | generic backend | simbolo, classe, bridge e service | base | sim | simbolo/bridge | forte | 9.0 |
| Python generico | generic bridge/symbol first-class | generic backend | simbolo, classe, metodo e bridge | base | sim | simbolo/bridge | forte | 9.0 |
| Dart generico | generic bridge/symbol first-class | generic backend | simbolo, classe e consumer bridge | base | sim | simbolo/bridge | forte | 9.0 |
| C++ bridge/service | generic bridge/symbol first-class | generic backend | namespace, classe, metodo e service bridge | `cpp-service-bridge` | sim | simbolo/bridge | forte | 9.0 |
| Flutter / Dart consumidor | generic bridge/symbol first-class | consumer bridge oficial | bridge/consumer formal do app | base + bridge | parcial forte | bridge/consumer | forte | 9.0 |
| Angular consumidor | inventariado/backlog | inventariado | consumer TypeScript com bridge parcial | nao | parcial por TypeScript | bridge parcial | medio | 7.5 |
| .NET desktop/MAUI/WPF | inventariado/backlog | inventariado | `cs:` generico fora do slice HTTP | nao | parcial por `cs:` | bridge parcial | medio | 7.5 |

## Limites honestos por familia

### Next.js App Router

- cobre `app/api/**/route.ts` e `src/app/api/**/route.ts`
- cobre `[id]`, `[...slug]` e `[[...slug]]`
- `importar nextjs` aceita raiz do repo, `app/`, `src/app/`, `app/api/`, `src/app/api/` e subpastas de rota
- o bootstrap puxa melhor `params`, `query`, `body`, `status` e `response` quando houver sinal forte, inclusive com `request.json()` tipado/cast inline e `NextResponse.json(...)` retornado via variavel local
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

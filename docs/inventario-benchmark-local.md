# Inventario Local de Benchmark

Este documento **nao** define a compatibilidade oficial do produto. Ele existe para separar benchmark local de realidade de uso da matriz publica do `Sema`.

## Regra de leitura

- compatibilidade oficial do produto: [scorecard-compatibilidade.md](./scorecard-compatibilidade.md)
- benchmark local de `C:\\GitHub`: este arquivo

Nao confunda uma coisa com a outra, senao vira aquela palhacada de desenhar produto ao redor da sua propria gaveta de repositorio.

## Heuristica local usada

Inventario feito por marcadores de stack em profundidade curta:

- manifestos (`package.json`, `firebase.json`, `pubspec.yaml`, `.csproj`, `Cargo.toml`, `go.mod`, `pom.xml`)
- padroes de framework (`@Controller`, `FastAPI`, `Blueprint`, `@RestController`, `WebApplication.CreateBuilder`, `gin`, `axum`)
- exclusao de lixo gerado (`node_modules`, `build`, `dist`, `vendor`, runners de plataforma e equivalentes)

Leitura honesta:

- `java`, `cpp` e parte de `dart` aparecem inflados porque muito projeto Flutter traz codigo/plataforma gerada
- esse inventario serve para regressao e priorizacao, nao para dizer que tudo e backend puro

## Contagem heuristica atual em `C:\\GitHub`

- `node`: `24`
- `python`: `33`
- `dart`: `18`
- `cpp`: `16`
- `dotnet`: `11`
- `java`: `21`
- `nextjs`: `5`
- `firebase`: `6`
- `fastapi`: `5`
- `angular`: `2`
- `go`: `1`
- `rust`: `1`

## Familias que o produto ja trata como first-class no backend

- `NestJS`
- `FastAPI`
- `Flask`
- `Next.js App Router`
- `Node/Firebase worker`
- `ASP.NET Core`
- `Spring Boot`
- `Go net/http + Gin`
- `Rust Axum`
- `TypeScript`, `Python`, `Dart` genericos
- `C++ bridge/service`

## Familias que ainda ficam como segunda onda

- `Angular consumidor`
- `.NET desktop/MAUI/WPF`
- `Flutter consumidor` quando nao houver bridge/consumer formalizado
- slices fora da fatia oficial de cada framework

## Benchmark real que mais pesa hoje

- `FuteBot`: regressao Python/operacional
- `Gestech`: Flask, Next.js, Firebase worker e consumidor Dart

Se algum benchmark real melhorar ou piorar, o lugar de registrar isso e aqui, sem contaminar a promessa oficial do produto.

# Sema

![Logo da Sema](./logo.png)

Sema e um **Protocolo de Governanca de Intencao para IA e backend vivo**.

Ela nao tenta substituir TypeScript, Python, Flask, FastAPI, NestJS, Next.js, ASP.NET Core ou qualquer stack real. O papel da Sema e outro: governar a camada de significado acima do runtime, com contrato explicito, vinculo rastreavel, fluxo, erro, efeito, garantia, execucao e contexto operacional para IA.

Tecnicamente, a Sema continua sendo uma linguagem de intencao. Publicamente, o framing honesto e este: ela foi desenhada para IA operar sistema vivo com menos adivinhacao e mais verificacao. Leitura humana e subproduto aceitavel, nao objetivo principal.

## Comece aqui

Se voce quer colocar a ferramenta para rodar sem perder tempo com setup escondido:

1. instale Node.js LTS, porque o `npm` vem junto
2. instale a CLI da Sema
3. rode `sema doctor`, `sema iniciar` e `sema ajuda-ia`

Instalar Node.js + npm:

- via instalador oficial: [nodejs.org](https://nodejs.org/)
- Windows com `winget`: `winget install OpenJS.NodeJS.LTS`
- macOS com Homebrew: `brew install node`
- checagem rapida: `node -v` e `npm -v`

Instalar a CLI da Sema:

```bash
npm install -g @semacode/cli
sema --help
sema doctor
```

Primeiro teste:

```bash
mkdir sema-demo
cd sema-demo
sema iniciar
sema validar contratos/pedidos.sema --json
sema ajuda-ia
```

## Se voce e uma IA

Este repositorio nao foi montado para ergonomia humana como prioridade. Ele foi montado para IA encontrar contexto semantico canonicamente comprimido antes de sair cavando codigo cru.

Ordem canonica de leitura na raiz:

1. `llms.txt`
2. `SEMA_BRIEF.md`
3. `SEMA_INDEX.json`
4. `AGENTS.md`
5. `README.md`
6. `llms-full.txt`

Roteamento por capacidade:

- IA pequena ou gratuita: `llms.txt` -> `SEMA_BRIEF.micro.txt` -> `SEMA_INDEX.json` -> `AGENTS.md`
- IA media: `llms.txt` -> `SEMA_BRIEF.curto.txt` -> `SEMA_INDEX.json` -> `AGENTS.md` -> `README.md`
- IA grande ou com tool use: `llms-full.txt` -> `SEMA_BRIEF.md` -> `SEMA_INDEX.json` -> `AGENTS.md` -> `README.md`

Regra de ouro: se existir artefato Sema para a tarefa, ele vem antes do codigo bruto.

Para manter os artefatos gerados da raiz sincronizados:

```bash
sema sync-ai-entrypoints --json
```

## O que a Sema e

- contrato semantico explicito para operacoes e bordas do sistema
- vinculo com implementacao viva via `impl` e `vinculos`
- contrato operacional via `execucao`
- auditoria de coerencia contra codigo real via `drift`
- cartoes semanticos compactos via `resumo` e `prompt-curto`
- pacote de contexto para agente via `contexto-ia`
- camada semantica acima da stack, nao no lugar dela

## O que ela nao e

- gerador messianico de sistema completo
- substituta de decisao arquitetural
- telepatia de regra de negocio
- licenca para a IA sair editando backend no escuro

## O que ela entrega hoje

- `task`, `flow`, `route`, `state`, `type`, `entity`, `enum` e `tests`
- superficies modernas de primeira classe: `worker`, `evento`, `fila`, `cron`, `webhook`, `cache`, `storage`, `policy`
- `impl` para ligar contrato a simbolo real
- `vinculos` para ligar contrato a arquivo, simbolo, recurso e superficie
- `execucao` para timeout, retry, compensacao, idempotencia e criticidade
- tipos compostos como `Lista<T>`, `Mapa<K, V>`, `Opcional<T>` e uniao controlada
- `drift` com score semantico, confianca, risco e lacunas
- `resumo` com modos `micro`, `curto` e `medio` para IA de capacidade diferente
- `prompt-curto` para colar contexto compacto em IA gratuita ou com janela curta
- `contexto-ia` com `ast.json`, `ir.json`, `drift.json`, `briefing.json`, `briefing.min.json` e resumos locais
- scaffold e geracao para TypeScript, Python e Dart
- scaffold backend para NestJS e FastAPI
- importacao incremental de legado

## Tres modos de uso

A Sema foi desenhada para entrar em tres cenarios sem forcar teatro conceitual:

- producao inicial ou projeto novo: voce modela contrato, valida, compila e verifica antes de deixar codigo derivado correr solto
- edicao em projeto que ja usa Sema: voce comeca por `inspecionar`, `resumo`, `drift` e `contexto-ia`, e so depois mexe no codigo vivo
- adocao incremental em projeto que ainda nao tem Sema: voce usa `importar` como rascunho revisavel, lapida o contrato e deixa `drift` arbitrar o acoplamento com o runtime real

Se alguem tentar vender a ferramenta como "serve so pra greenfield" ou "serve so pra legado", esta falando merda com conviccao. O valor da Sema e justamente atravessar os tres momentos sem trocar de cerebro no meio do caminho.

## Quickstart

Instalacao oficial via npm:

```bash
npm install -g @semacode/cli
sema --help
sema doctor
```

Instalacao alternativa via GitHub Release:

```bash
npm install -g https://github.com/gerlanss/Sema/releases/latest/download/sema-cli-latest.tgz
sema --help
sema doctor
```

Instalacao local ao projeto:

```bash
npm install @semacode/cli
npx sema --help
```

Primeiro teste:

```bash
mkdir sema-demo
cd sema-demo
sema iniciar
sema validar contratos/pedidos.sema --json
```

## Exemplo rapido

```sema
module exemplos.pedidos {
  task processar_pedido {
    input {
      pedido_id: Id required
      itens: Lista<Texto> required
    }
    output {
      protocolo: Id
      status: Texto
    }
    impl {
      ts: app.pedidos.processar
    }
    vinculos {
      arquivo: "src/pedidos/processar.ts"
      simbolo: app.pedidos.processar
      fila: pedidos_processamento
    }
    execucao {
      idempotencia: verdadeiro
      timeout: "30s"
      retry: "3x exponencial"
      compensacao: "reverter_reserva"
      criticidade_operacional: alta
    }
    effects {
      persistencia pedidos criticidade = alta
      auditoria pedidos criticidade = media
    }
    guarantees {
      protocolo existe
      status existe
    }
    tests {
      caso "pedido valido" {
        given {
          pedido_id: "ped_1"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }

  route processar_pedido_publico {
    metodo: POST
    caminho: /pedidos/processar
    task: processar_pedido
  }
}
```

## Fluxo recomendado para projeto vivo

Quando a tarefa envolver backend ja existente, o fluxo canonico agora e:

```bash
sema inspecionar . --json
sema resumo contratos/modulo.sema --micro --para mudanca
sema drift contratos/modulo.sema --json
sema contexto-ia contratos/modulo.sema --saida ./.tmp/contexto --json
```

Leitura pratica:

1. `inspecionar` descobre base do projeto, diretorios de codigo e fontes legado.
2. `resumo` gera o menor cartao semantico util para a IA atual.
3. `drift` mede impls, vinculos, rotas, score, confianca, risco e lacunas.
4. `contexto-ia` gera o pacote completo, incluindo `briefing.json`, `briefing.min.json`, `resumo.micro.txt` e `resumo.curto.txt`.

Se a IA for mexer em sistema real sem olhar isso, ela esta basicamente pedindo para fazer merda.

## Capacidade da IA

Use o menor artefato que resolva a tarefa:

- IA pequena ou gratuita: `sema resumo --micro`, `resumo.micro.txt`, `briefing.min.json`, `prompt-curto.txt`
- IA media: `sema resumo --curto`, `resumo.curto.txt`, `briefing.min.json`, `drift.json`
- IA grande ou com tool use: `resumo.md`, `briefing.json`, `drift.json`, `ir.json`, `ast.json`

O erro classico e entupir modelo pequeno com JSON gigante e depois reclamar que ele virou um animal confuso. O protocolo agora deixa explicito o que cada faixa aguenta.

Para descobrir isso sem decorar comando no grito:

```bash
sema --help
sema ajuda-ia
```

Essas duas saidas agora separam fluxo de projeto novo, edicao guiada e adocao em legado, alem de mostrar o que cabe em IA pequena, media e grande sem ficar naquela bagunca de help que parece manifesto de seita.

## Compatibilidade atual

- `NestJS`: importacao de rotas e `drift` de rota publica
- `FastAPI`: importacao de rotas e `drift` de rota publica
- `Flask`: importacao de rotas e `drift` com `Blueprint`, `url_prefix` e decoradores
- `Next.js App Router`: importacao e `drift` por `route.ts`, incluindo segmentos dinamicos
- `Next.js consumer`: bridge canonico + superficies `page.tsx`, `layout.tsx`, `loading.tsx` e `error.tsx`
- `React/Vite consumer`: bridge canonico + `react-router` explicito em `src/router.tsx|routes.tsx` + `src/pages/**`
- `Angular consumer`: bridge canonico + `app.routes.ts`, `**/*.routes.ts`, lazy routes e feature folders vinculados
- `Flutter consumer`: bridge canonico + `lib/router.dart`, `lib/screens/**` e superfícies consumer rastreaveis
- `ASP.NET Core`: importacao de controllers e Minimal API com `drift` via `cs:`
- `Spring Boot`: importacao de controllers com `drift` via `java:`
- `Go net/http + Gin`: importacao de handlers com `drift` via `go:`
- `Rust Axum`: importacao de handlers com `drift` via `rust:`
- `Node/Firebase worker`: importacao focada em bridge, worker route e recurso persistido
- `C++ bridge/service`: importacao generica e `drift` de simbolo via `cpp:`
- `TypeScript`, `Python`, `Dart`: resolucao de simbolo e importacao generica

Observacao importante: essas familias entram como fontes de legado para `importar` e `drift`. A criacao oficial agora cobre `base`, `nestjs`, `fastapi`, `nextjs-api`, `nextjs-consumer`, `react-vite-consumer`, `angular-consumer` e `flutter-consumer`.

## Showcases oficiais

Os showcases oficiais desta fase estao em:

- [showcases/ranking-showroom](./showcases/ranking-showroom/): backend Flask com contrato, `impl`, `vinculos`, `drift` e contexto de IA
- [showcases/ranking-showroom-consumer](./showcases/ranking-showroom-consumer/): consumer Next.js App Router com `consumer bridge + App Router surfaces`
- [showcases/ranking-showroom-react-vite-consumer](./showcases/ranking-showroom-react-vite-consumer/): consumer React/Vite com `consumer bridge + react-router surfaces`
- [showcases/ranking-showroom-angular-consumer](./showcases/ranking-showroom-angular-consumer/): consumer Angular com `consumer bridge + lazy route config surfaces`
- [showcases/ranking-showroom-flutter-consumer](./showcases/ranking-showroom-flutter-consumer/): consumer Flutter com `consumer bridge + router/screens`
- [showcases/ranking-showroom-stack-nextjs](./showcases/ranking-showroom-stack-nextjs/): backend Flask + `Next.js consumer` na mesma raiz operacional
- [showcases/ranking-showroom-stack-react-vite](./showcases/ranking-showroom-stack-react-vite/): backend Flask + `React/Vite consumer` na mesma raiz operacional
- [showcases/ranking-showroom-stack-angular](./showcases/ranking-showroom-stack-angular/): backend Flask + `Angular consumer` na mesma raiz operacional
- [showcases/ranking-showroom-stack-flutter](./showcases/ranking-showroom-stack-flutter/): backend Flask + `flutter-consumer` na mesma raiz operacional

O showcase backend mostra:

- contrato semantico curado
- `impl` e `vinculos` apontando para codigo vivo
- `drift` sem falso positivo idiota
- `contexto-ia` com `drift.json` e `briefing.json`
- adocao incremental em backend Flask real

O showcase consumer mostra:

- `impl` apontando apenas para o bridge canonico
- `vinculos` rastreando bridge, arquivos e superficie `/ranking`
- `drift` leve de consumer sem fingir visual drift
- `contexto-ia` com `consumerFramework`, `appRoutes`, `consumerSurfaces` e `consumerBridges`
- o mesmo contrato operacional funcionando em `Next.js`, `React/Vite`, `Angular` e `Flutter`, cada um no seu slice oficial

Fluxo:

```bash
cd showcases/ranking-showroom
sema inspecionar . --json
sema drift contratos/ranking_showroom.sema --json
sema contexto-ia contratos/ranking_showroom.sema --saida ./.tmp/contexto-ranking --json

cd ../ranking-showroom-consumer
sema inspecionar . --json
sema drift contratos/showroom_consumer.sema --json
sema contexto-ia contratos/showroom_consumer.sema --saida ./.tmp/contexto-ranking-consumer --json

cd ../ranking-showroom-react-vite-consumer
sema inspecionar . --json
sema drift contratos/showroom_consumer.sema --json
sema contexto-ia contratos/showroom_consumer.sema --saida ./.tmp/contexto-ranking-react-vite --json

cd ../ranking-showroom-angular-consumer
sema inspecionar . --json
sema drift contratos/showroom_consumer.sema --json
sema contexto-ia contratos/showroom_consumer.sema --saida ./.tmp/contexto-ranking-angular --json

cd ../ranking-showroom-flutter-consumer
sema inspecionar . --json
sema drift contratos/showroom_consumer.sema --json
sema contexto-ia contratos/showroom_consumer.sema --saida ./.tmp/contexto-ranking-flutter --json
```

## Proxima camada de front

As familias consumer oficiais agora estao abertas. A proxima onda semantica de front esta documentada em [docs/front-semantic-roadmap.md](./docs/front-semantic-roadmap.md), cobrindo `screen`, `action`, `query`, `form` e `navigation` como trilha oficial futura, sem fingir que essa sintaxe ja existe hoje.

## A Sema governa a propria Sema

O repo agora usa contratos internos em [contratos/sema](./contratos/sema/) para modelar parte da evolucao do proprio produto:

- [contratos/sema/governanca_ia.sema](./contratos/sema/governanca_ia.sema)
- [contratos/sema/ergonomia_e_dominio.sema](./contratos/sema/ergonomia_e_dominio.sema)
- [contratos/sema/linguagem_composta.sema](./contratos/sema/linguagem_composta.sema)

Isso nao e pose de framework emocionado. E dogfooding com governanca semantica de verdade.

## Configuracao de projeto

A Sema usa `sema.config.json` para tratar projeto real com menos chute.

```json
{
  "origens": ["./contratos"],
  "saida": "./generated",
  "alvos": ["typescript", "python"],
  "alvoPadrao": "typescript",
  "estruturaSaida": "backend",
  "framework": "nestjs",
  "modoEstrito": true,
  "diretoriosSaidaPorAlvo": {
    "typescript": "./generated/nestjs",
    "python": "./generated/fastapi"
  },
  "convencoesGeracaoPorProjeto": "backend"
}
```

Na pratica:

- `origens` controla onde a CLI procura `.sema`
- `diretoriosCodigo` ajuda a localizar implementacao viva
- `fontesLegado` orienta `importar` e `drift`
- `framework`, `estruturaSaida` e `alvos` deixam scaffold previsivel

## Extensao VS Code

Instalar via release:

```bash
curl -L -o sema-language-tools.vsix https://github.com/gerlanss/Sema/releases/latest/download/sema-language-tools-latest.vsix
code --install-extension ./sema-language-tools.vsix --force
```

Windows PowerShell:

```powershell
Invoke-WebRequest -Uri https://github.com/gerlanss/Sema/releases/latest/download/sema-language-tools-latest.vsix -OutFile sema-language-tools.vsix
code --install-extension .\sema-language-tools.vsix --force
```

Pagina oficial:

- [https://github.com/gerlanss/Sema/releases/latest](https://github.com/gerlanss/Sema/releases/latest)
- [https://github.com/gerlanss/Sema/blob/main/pacotes/editor-vscode/README.md](https://github.com/gerlanss/Sema/blob/main/pacotes/editor-vscode/README.md)

Se voce estiver contribuindo no repositorio, ai sim entra a trilha local:

```bash
npm run extensao:empacotar
npm run extensao:instalar-local
```

## Fluxo de contribuicao

Se o objetivo for desenvolver a propria Sema:

```bash
npm install
npm run build
npm test
npm run ia:sync-entrypoints
node pacotes/cli/dist/index.js verificar exemplos --json
```

Para validar tudo no modo mais paranoico:

```bash
npm run project:check
```

Se quiser rodar os smokes reais contra repos externos locais e mutaveis:

```bash
npm run test:smoke-real
```

## Documentacao principal

- [STATUS.md](./STATUS.md)
- [docs/sintaxe.md](./docs/sintaxe.md)
- [docs/integracao-com-ia.md](./docs/integracao-com-ia.md)
- [docs/instalacao-e-primeiro-uso.md](./docs/instalacao-e-primeiro-uso.md)
- [docs/cli.md](./docs/cli.md)
- [docs/backend-first.md](./docs/backend-first.md)
- [docs/scorecard-compatibilidade.md](./docs/scorecard-compatibilidade.md)
- [docs/arquitetura.md](./docs/arquitetura.md)
- [docs/distribuicao-da-cli.md](./docs/distribuicao-da-cli.md)
- [docs/kit-lancamento-publico.md](./docs/kit-lancamento-publico.md)

## Resumo honesto

Se voce quer uma linguagem para escrever tese sobre pureza sintatica, a Sema nao esta tentando ganhar esse concurso.

Se voce quer contrato, vinculo, drift e contexto operacional para IA mexer em backend vivo sem confiar na sorte, ai sim ela comeca a ficar interessante.

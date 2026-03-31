# Sema

![Logo da Sema](./logo.png)

Sema e um **Protocolo de Governanca de Intencao para IA e backend vivo**.

Ela nao tenta substituir TypeScript, Python, Flask, FastAPI, NestJS, Next.js, ASP.NET Core ou qualquer stack real. O papel da Sema e outro: governar a camada de significado acima do runtime, com contrato explicito, vinculo rastreavel, fluxo, erro, efeito, garantia, execucao e contexto operacional para IA.

Tecnicamente, a Sema continua sendo uma linguagem de intencao. Publicamente, o framing fica mais honesto: ela e o protocolo que ajuda humano e IA a mexer em sistema vivo com menos adivinhacao e mais verificacao.

## O que a Sema e

- contrato semantico explicito para operacoes e bordas do sistema
- vinculo com implementacao viva via `impl` e `vinculos`
- contrato operacional via `execucao`
- auditoria de coerencia contra codigo real via `drift`
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
- `contexto-ia` com `ast.json`, `ir.json`, `drift.json`, `briefing.json` e README local
- scaffold e geracao para TypeScript, Python e Dart
- scaffold backend para NestJS e FastAPI
- importacao incremental de legado

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
sema drift contratos/modulo.sema --json
sema contexto-ia contratos/modulo.sema --saida ./.tmp/contexto --json
```

Leitura pratica:

1. `inspecionar` descobre base do projeto, diretorios de codigo e fontes legado.
2. `drift` mede impls, vinculos, rotas, score, confianca, risco e lacunas.
3. `contexto-ia` gera o pacote para a IA editar com contexto, incluindo `briefing.json`.

Se a IA for mexer em sistema real sem olhar isso, ela esta basicamente pedindo para fazer merda.

## Compatibilidade atual

- `NestJS`: importacao de rotas e `drift` de rota publica
- `FastAPI`: importacao de rotas e `drift` de rota publica
- `Flask`: importacao de rotas e `drift` com `Blueprint`, `url_prefix` e decoradores
- `Next.js App Router`: importacao e `drift` por `route.ts`, incluindo segmentos dinamicos
- `ASP.NET Core`: importacao de controllers e Minimal API com `drift` via `cs:`
- `Spring Boot`: importacao de controllers com `drift` via `java:`
- `Go net/http + Gin`: importacao de handlers com `drift` via `go:`
- `Rust Axum`: importacao de handlers com `drift` via `rust:`
- `Node/Firebase worker`: importacao focada em bridge, worker route e recurso persistido
- `C++ bridge/service`: importacao generica e `drift` de simbolo via `cpp:`
- `TypeScript`, `Python`, `Dart`: resolucao de simbolo e importacao generica

Observacao importante: essas familias entram como fontes de legado para `importar` e `drift`. A geracao continua oficial para `base`, `nestjs` e `fastapi`.

## Showcase oficial

O showcase oficial esta em [showcases/ranking-showroom](./showcases/ranking-showroom/).

Ele mostra:

- contrato semantico curado
- `impl` e `vinculos` apontando para codigo vivo
- `drift` sem falso positivo idiota
- `contexto-ia` com `drift.json` e `briefing.json`
- adocao incremental em backend Flask real

Fluxo:

```bash
cd showcases/ranking-showroom
sema inspecionar . --json
sema drift contratos/ranking_showroom.sema --json
sema contexto-ia contratos/ranking_showroom.sema --saida ./.tmp/contexto-ranking --json
```

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

Empacotar:

```bash
npm run extensao:empacotar
```

Instalar via release:

```bash
curl -L -o sema-language-tools.vsix https://github.com/gerlanss/Sema/releases/latest/download/sema-language-tools-latest.vsix
code --install-extension ./sema-language-tools.vsix --force
```

Instalar localmente:

```bash
npm run extensao:instalar-local
```

## Fluxo de contribuicao

Se o objetivo for desenvolver a propria Sema:

```bash
npm install
npm run build
npm test
node pacotes/cli/dist/index.js verificar exemplos --json
```

Para validar tudo no modo mais paranoico:

```bash
npm run project:check
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

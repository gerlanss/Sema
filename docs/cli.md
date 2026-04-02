# CLI da Sema

## Visao geral

A CLI da Sema e a interface oficial do protocolo Sema para:

- validacao semantica
- exportacao de AST e IR
- compressao semantica por capacidade de IA
- compilacao e scaffold de codigo
- formatacao canonica
- verificacao em lote
- inspecao de projeto
- onboarding de IA

No marco publico `0.9.x intervencao segura para IA`, ela tambem virou a fonte de verdade para:

- configuracao de projeto via `sema.config.json`
- scaffold orientado a framework para NestJS e FastAPI
- resolucao de multiplas origens `.sema`
- importacao assistida de legado para rascunho `.sema`
- governanca de drift entre contrato e codigo vivo
- inspecao nao destrutiva de projeto antes de gerar qualquer coisa

Matriz curta de compatibilidade legado:

- `nestjs`: importar + `drift` de rota publica
- `fastapi`: importar + `drift` de rota publica
- `flask`: importar + `drift` de rota publica
- `nextjs`: importar + `drift` de rota publica via `App Router`
- `nextjs-consumer`: importar + `drift` leve de `consumer bridge + App Router surfaces`
- `react-vite-consumer`: importar + `drift` leve de `consumer bridge + react-router surfaces`
- `angular-consumer`: importar + `drift` leve de `consumer bridge + lazy route config surfaces`
- `flutter-consumer`: importar + `drift` leve de `consumer bridge + router/screens`
- `dotnet`: importar + `drift` de rota publica via ASP.NET Core
- `java`: importar + `drift` de rota publica via Spring Boot
- `go`: importar + `drift` de rota publica via `net/http` e Gin
- `rust`: importar + `drift` de rota publica via Axum
- `firebase`: importar + `drift` de rota worker e recurso vivo
- `typescript`, `python`, `dart`, `cpp`: importacao generica e resolucao de simbolo

## Tres modos de operacao

A CLI da Sema nao serve so para um tipo de projeto. O fluxo oficial hoje cobre:

- producao inicial: `iniciar` -> `validar` -> `compilar` -> `verificar`
- edicao em projeto que ja usa Sema: `inspecionar` -> `resumo` -> `drift` -> `contexto-ia`
- adocao incremental em legado: `importar` -> `formatar` -> `validar` -> `drift`

Essa divisao tambem aparece no `sema --help`, com a intencao de reduzir adivinhacao operacional e parar de deixar usuario caindo no limbo entre “tool de greenfield” e “importador de legado”.

## IA por capacidade

A CLI organiza os artefatos de contexto pensando no tamanho da janela do modelo:

- IA pequena ou gratuita: `sema resumo --micro`, `briefing.min.json`, `prompt-curto.txt`
- IA media: `sema resumo --curto`, `drift.json`, `briefing.min.json`
- IA grande ou com tool use: `sema contexto-ia`, `briefing.json`, `ir.json`, `ast.json`

Use `sema ajuda-ia` quando quiser a versao guiada disso. A regra continua simples: nao empurre JSON gigante em modelo curto e depois reclame que ele ficou biruta.

## Distribuicao publica

O caminho publico principal da CLI agora e:

1. instalar da GitHub Release
2. usar `sema`

Comando publico:

```bash
npm install -g https://github.com/gerlanss/Sema/releases/latest/download/sema-cli-latest.tgz
```

`npm link` continua existindo, mas virou fluxo de desenvolvimento do proprio repo.

Primeiro uso sem clonar o repo:

```bash
mkdir sema-demo
cd sema-demo
sema iniciar
sema validar contratos/pedidos.sema --json
```

Checar a versao instalada:

```bash
sema --versao
```

## Sintaxe canonica de `impl`

A CLI usa o bloco `impl` para ligar uma `task` a simbolos reais do codigo vivo. `drift`, `inspecionar`, `contexto-ia` e a importacao assistida dependem dessa forma estar bem escrita.

Forma canonica:

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
  }
  guarantees {
    protocolo existe
  }
}
```

Regra pratica:

- `impl` e um bloco dentro de `task`
- cada linha do bloco usa `origem: caminho`
- a `origem` aceita `ts|typescript`, `py|python`, `dart`, `cs|csharp|dotnet`, `java`, `go|golang`, `rust|rs`, `cpp|cxx|cc|c++`
- cada origem pode aparecer no maximo uma vez dentro da mesma `task`
- o `caminho` deve ser um identificador por pontos, como `pacote.modulo.funcao` ou `app.servico.metodo`
- caminhos privados continuam validos quando declarados explicitamente, por exemplo `py: services.telegram_bot._callback_handler`

Exemplos validos:

```sema
impl {
  ts: app.pagamentos.processar
  py: servicos.pagamentos.processar
  cs: Pagamentos.Api.Controllers.PedidosController.Criar
  java: br.com.acme.pagamentos.PedidosController.criar
  go: internal.pagamentos.criarPedido
  rust: app.pagamentos.criar_pedido
  cpp: bridge.pagamentos.processar
}
```

Exemplos invalidos:

```sema
impl: app.pagamentos.processar
```

Motivo: `impl` nao e campo simples; ele precisa abrir um bloco.

```sema
impl {
  ts: app/pagamentos/processar
}
```

Motivo: o caminho usa pontos, nao barras.

```sema
impl {
  ts: app.pagamentos.processar()
}
```

Motivo: o caminho aponta para simbolo, nao chamada com parenteses.

```sema
impl {
  ts: app.pagamentos.processar
  ts: app.pagamentos.processarFallback
}
```

Motivo: a mesma origem nao pode ser repetida dentro da mesma `task`.

## Comandos disponiveis

### `sema --versao` | `sema --version` | `sema -v`

Imprime a versao atual da CLI instalada.

### `sema iniciar [--template <base|nestjs|fastapi|nextjs-api|nextjs-consumer|react-vite-consumer|angular-consumer|flutter-consumer|node-firebase-worker|aspnet-api|springboot-api|go-http-api|rust-axum-api|cpp-service-bridge>]`

Cria uma estrutura inicial de projeto.

Templates:

- `base`: projeto minimo neutro
- `nestjs`: projeto voltado a scaffold backend TypeScript/NestJS
- `fastapi`: projeto voltado a scaffold backend Python/FastAPI
- `nextjs-api`: starter de adocao para `Next.js App Router`
- `nextjs-consumer`: starter oficial de `Next.js App Router consumer` com bridge canonico e superficies inventariadas
- `react-vite-consumer`: starter oficial de `React/Vite consumer` com bridge canonico, `src/router.tsx` e paginas rastreaveis
- `angular-consumer`: starter oficial de `Angular consumer` com bridge canonico, `app.routes.ts`, `**/*.routes.ts` e feature folders
- `flutter-consumer`: starter oficial de `flutter-consumer` com bridge canonico, `lib/router.dart` e `lib/screens/**`
- `node-firebase-worker`: starter de worker/bridge Firebase
- `aspnet-api`: starter de ASP.NET Core
- `springboot-api`: starter de Spring Boot
- `go-http-api`: starter de `net/http` + Gin
- `rust-axum-api`: starter de Axum
- `cpp-service-bridge`: starter de bridge/service em C++

Artefatos iniciais tipicos:

- `sema.config.json`
- `contratos/pedidos.sema`
- pastas base para `src/` e `test/` ou `app/` e `tests/`, conforme o template

### `sema validar <arquivo-ou-pasta> [--json]`

Executa lexer, parser e analise semantica sem gerar codigo.

Quando existir `sema.config.json`, a CLI carrega o projeto pelo contexto configurado.

### `sema ast <arquivo.sema> [--json]`

Imprime a AST do modulo.

- sem `--json`, imprime a AST serializada diretamente
- com `--json`, envolve a AST em um envelope estavel com metadados do comando

### `sema ir <arquivo.sema> [--json]`

Imprime a representacao intermediaria semantica.

- sem `--json`, imprime a IR diretamente
- com `--json`, envolve a IR em um envelope estavel com metadados do comando

### `sema compilar [arquivo-ou-pasta] --alvo <python|typescript|dart> --saida <diretorio> [--estrutura <flat|modulos|backend>] [--framework <base|nestjs|fastapi>]`

Gera artefatos compilados para o alvo escolhido.

Estruturas disponiveis:

- `flat`: tudo direto dentro da pasta de saida
- `modulos`: organiza por namespace do modulo `.sema`
- `backend`: usa convencoes de scaffold backend por contexto de dominio

Frameworks:

- `base`: scaffold neutro
- `nestjs`: scaffold TypeScript com controller, service, dto e testes iniciais
- `fastapi`: scaffold Python com router, service, schemas e testes iniciais

Regras de compatibilidade:

- `nestjs` exige alvo `typescript`
- `fastapi` exige alvo `python`
- `dart` hoje so aceita `framework base`

Se houver `sema.config.json`, a CLI aceita rodar sem argumento de entrada e usa o projeto atual.

### `sema gerar <python|typescript|dart> [arquivo-ou-pasta] --saida <diretorio> [--estrutura <flat|modulos|backend>] [--framework <base|nestjs|fastapi>]`

Atalho para compilacao por alvo.

### `sema testar [arquivo-ou-pasta] --alvo <python|typescript|dart> --saida <diretorio> [--estrutura <flat|modulos|backend>] [--framework <base|nestjs|fastapi>]`

Gera os artefatos de teste e tenta executa-los.

Observacao importante:

- para `framework base`, a CLI tenta executar os testes gerados
- para `framework nestjs` e `framework fastapi`, a CLI gera o scaffold e encerra sem rodar a suite do framework por voce

### `sema diagnosticos <arquivo.sema> [--json]`

Imprime diagnosticos em texto ou JSON estruturado.

### `sema verificar [arquivo-ou-pasta] [--saida <diretorio-base>] [--json]`

Executa o fluxo completo de verificacao em lote:

- valida os arquivos `.sema`
- gera artefatos para os alvos configurados
- executa os testes gerados dos scaffolds base
- imprime um resumo final com modulos, alvos, arquivos gerados e quantidade de testes

Quando existir `sema.config.json`, os alvos de verificacao passam a respeitar a configuracao do projeto.

### `sema formatar <arquivo-ou-pasta> [--check] [--json]`

Aplica o estilo canonico oficial da linguagem.

Escopo do formatador:

- indentacao de blocos
- linhas em branco estaveis entre secoes
- normalizacao de espacos em campos, listas, comparacoes, `flow` e `route`
- normalizacao de `caminho` em `route`
- ordenacao canonica dos blocos do `module`
- ordenacao canonica dos subblocos de `task`
- preservacao do conteudo semantico observavel

Comportamento:

- sem `--check`, reescreve os arquivos fora do formato
- com `--check`, falha com codigo de saida nao zero quando houver diferencas
- com `--json`, emite relatorio estruturado por arquivo

### `sema inspecionar [arquivo-ou-pasta] [--json]`

Mostra como a CLI esta enxergando o projeto atual antes de gerar scaffold.

Campos tipicos:

- arquivo de configuracao encontrado
- base do projeto resolvida
- framework ativo
- estrutura de saida
- alvos
- origens resolvidas
- diretorios de codigo candidatos
- fontes de legado detectadas
- modo de adocao
- modulos encontrados
- resumo de implementacao viva por modulo, com `impls` validos, quebrados, tasks sem `impl` e arquivos relacionados

Esse comando existe para evitar aquela merda de “a CLI nao achou meu modulo” sem ninguem saber qual contexto ela estava usando.

Heuristica importante quando nao existe `sema.config.json`:

- entrada na raiz usa a propria raiz como base do projeto
- entrada em `.../sema` ou `.../sema/arquivo.sema` sobe para o projeto pai antes de inferir codigo vivo
- `baseProjeto`, `origens` e `diretoriosCodigo` devem ficar estaveis entre esses tres jeitos de chamar a CLI
- para Python, a deteccao automatica agora diferencia `fastapi`, `flask` e `python` generico; se o projeto tiver FastAPI e Flask juntos, as duas fontes aparecem

### `sema drift <arquivo-ou-pasta> [--json]`

Compara o contrato `.sema` com o codigo vivo ligado por `impl`.

O comando aponta:

- `impl` valido
- `impl` quebrado
- `task` sem implementacao ligada
- rota publica divergente em NestJS/FastAPI/Flask/Next.js/Firebase worker, quando houver contexto suficiente
- recurso vivo divergente em bridges Firebase/worker, quando o contrato explicitar persistencia verificavel

No caso de Python, o `drift` indexa:

- funcoes de modulo
- metodos de classe
- simbolos com `_` quando foram declarados explicitamente no `impl`
- rotas Flask via `@app.route`, `@blueprint.route` e `Blueprint(..., url_prefix=...)`

Traduzindo: se o contrato apontar para `services.telegram_bot._callback_handler`, a CLI tenta resolver esse simbolo de verdade, em vez de fingir que privado nao existe.

No caso de Flask, a comparacao de rota tambem normaliza parametros como:

- `<id>` -> `{id}`
- `<int:id>` -> `{id}`
- `<float:valor>` -> `{valor}`
- `<uuid:item_id>` -> `{item_id}`
- `<path:arquivo>` -> `{arquivo}`

No caso de TypeScript HTTP, o `drift` agora cobre:

- `Next.js App Router` via `app/api/**/route.ts` e `src/app/api/**/route.ts`
- segmentos dinamicos `[id]`, `[...slug]` e `[[...slug]]`
- worker Node/Firebase com `req.url === "/..."` + `req.method === "GET"` no servidor HTTP minimo

No caso dos backends adicionais, o `drift` agora cobre:

- `ASP.NET Core`: `[Route]`, `[HttpGet|Post|Put|Patch|Delete]` e `MapGet|MapPost|MapPut|MapPatch|MapDelete`
- `Spring Boot`: `@RestController`, `@RequestMapping` e `@GetMapping|PostMapping|PutMapping|PatchMapping|DeleteMapping`
- `Go`: `http.HandleFunc`, `ServeMux.HandleFunc`, `gin.Engine` e `gin.RouterGroup`
- `Rust Axum`: `Router::route`, `get|post|put|patch|delete` e `nest`
- `C++`: `drift` de simbolo/bridge, sem prometer HTTP nesta fatia

### `sema doctor`

Faz uma checagem rapida de ambiente para reduzir atrito idiota antes de voce culpar a ferramenta.

Hoje ele verifica:

- `node`
- `npm`
- `python` ou `py`
- `dotnet`
- `go`
- `cargo`
- `java`
- `code`

Com `--json`, a saida inclui:

- `modulos`
- `tasks`
  - `arquivosReferenciados`
  - `simbolosReferenciados`
  - `candidatosImpl`
- `impls_validos`
  - `arquivo`
  - `simbolo`
  - `caminhoResolvido`
- `impls_quebrados`
  - `candidatos`
- `rotas_divergentes`
- `diagnosticos`
- `sucesso`

### `sema importar <nestjs|fastapi|flask|nextjs|nextjs-consumer|react-vite-consumer|angular-consumer|flutter-consumer|firebase|typescript|python|dart|dotnet|java|go|rust|cpp> <diretorio> [--saida <diretorio>] [--namespace <base>] [--json]`

Importa um projeto legado e gera um **rascunho Sema revisavel**.

Leitura importante: `flask`, `nextjs`, `nextjs-consumer`, `react-vite-consumer`, `angular-consumer`, `flutter-consumer`, `firebase`, `dotnet`, `java`, `go`, `rust` e `cpp` aqui sao **fontes legado de importacao/drift**, nao novos `frameworks` de geracao. A geracao continua `base`, `nestjs`, `fastapi` e os starters oficiais de adocao (`nextjs-api`, `nextjs-consumer`, `react-vite-consumer`, `angular-consumer`, `flutter-consumer`, `node-firebase-worker` etc.).

O comando:

- analisa codigo existente
- infere tasks, routes, entities, enums, errors e `impl`
- grava modulos `.sema` formatados na pasta de saida
- valida o rascunho gerado antes de encerrar

Leitura correta:

- `importar` nao promete converter toda a intencao do projeto automaticamente
- ele entrega um ponto de partida forte para migracao incremental
- a ideia e revisar, lapidar e depois conectar com codigo vivo usando `impl`

Casos praticos:

- `nestjs`: controller, service e DTO para rascunho backend TypeScript
- `nextjs-consumer`: bridge exportado e superficies App Router para rascunho consumer revisavel
- `react-vite-consumer`: bridge exportado, `src/router.tsx|routes.tsx` e `src/pages/**` para rascunho consumer revisavel
- `angular-consumer`: bridge exportado, `app.routes.ts`, `**/*.routes.ts` e componentes vinculados para rascunho consumer revisavel
- `flutter-consumer`: bridge exportado, `lib/router.dart` e `lib/screens/**` para rascunho consumer revisavel
- `fastapi`: router, service e schema para rascunho backend Python
- `flask`: `Blueprint`, `url_prefix`, `@app.route` e `@blueprint.route` para rascunho backend Python
- `nextjs`: `App Router` com `route.ts`, metodos HTTP e segmentos dinamicos
- `firebase`: bridge de worker, endpoint de health e recursos persistidos descobertos no runtime
- `dotnet`: controllers ASP.NET Core, Minimal API e simbolos `cs:`
- `java`: controllers Spring Boot e simbolos `java:`
- `go`: handlers `net/http` / Gin e simbolos `go:`
- `rust`: handlers Axum e simbolos `rust:`
- `typescript`, `python`, `dart`, `cpp`: importacao generica focada em funcoes, classes e contratos basicos

### `sema starter-ia`

Imprime o texto curto de onboarding para colar em qualquer agente antes de editar arquivos `.sema`.
O texto assume postura IA-first e deixa claro que a linguagem nao foi desenhada para ergonomia humana como prioridade.

### `sema ajuda-ia`

Imprime um guia curto e direto explicando qual comando de IA usar em cada situacao.

### `sema sync-ai-entrypoints [--json]`

Regenera os entrypoints IA-first da raiz do projeto:

- `SEMA_BRIEF.md`
- `SEMA_BRIEF.micro.txt`
- `SEMA_BRIEF.curto.txt`
- `SEMA_INDEX.json`

Use isso depois de mudanca semantica relevante no repo para manter o ponto de entrada da IA sincronizado.

- sem `--json`, imprime a ordem canonica de leitura por capacidade
- com `--json`, devolve base do projeto, artefatos e `entradaCanonica`

### `sema resumo <arquivo-ou-pasta> [--micro|--curto|--medio] [--para <resumo|onboarding|review|mudanca|bug|arquitetura>] [--saida <diretorio>] [--raiz] [--json]`

Gera o menor resumo semantico util para a capacidade atual da IA.

- `--micro`: cartao minimo para IA gratuita ou de contexto curto
- `--curto`: resumo operacional intermediario
- `--medio`: markdown mais rico, ainda menor que o pacote completo
- `--para`: ajusta a enfase do resumo para onboarding, review, mudanca, bug ou arquitetura
- `--saida`: grava artefatos compactos no diretorio informado
- `--raiz`: quando a entrada for projeto, grava `SEMA_BRIEF.*` e `SEMA_INDEX.json` na raiz
- `--json`: devolve envelope estruturado com resumo, guia por capacidade e caminhos gerados

### `sema prompt-curto <arquivo-ou-pasta> [--micro|--curto|--medio] [--para <resumo|onboarding|review|mudanca|bug|arquitetura>] [--json]`

Imprime um prompt curto e pronto para colar em IA pequena, derivado do resumo compacto.

### `sema prompt-ia`

Imprime o prompt-base oficial para orientar uma IA a trabalhar com a Sema sem improvisar sintaxe ou semantica.

### `sema prompt-ia-ui`

Imprime um prompt oficial para tarefas em que a Sema deve ser usada junto com interface grafica.

### `sema prompt-ia-react`

Imprime um prompt especifico para projeto com Sema + React + TypeScript.

### `sema prompt-ia-sema-primeiro`

Imprime um prompt oficial para forcar a estrategia "Sema primeiro".

### `sema exemplos-prompt-ia`

Imprime exemplos prontos de prompt para estrategias como:

- `Sema primeiro`
- `Sema + React + TypeScript`
- revisao e correcao de modulo `.sema`

### `sema contexto-ia <arquivo.sema> [--saida <diretorio>] [--json]`

Gera um pacote de contexto para IA com:

- `resumo.micro.txt`
- `resumo.curto.txt`
- `resumo.md`
- `briefing.min.json`
- `prompt-curto.txt`
- `validar.json`
- `diagnosticos.json`
- `ast.json`
- `ir.json`
- `drift.json`
- `briefing.json`
- `README.md` com fluxo operacional por capacidade de IA

Sem `--json`, imprime um resumo operacional e informa a pasta gerada.
Com `--json`, retorna um envelope estruturado com arquivo, modulo, pasta de saida e artefatos gerados.

## Ordem canonica do formatador

### Blocos de `module`

1. `docs`
2. `comments`
3. `use`
4. `type`
5. `entity`
6. `enum`
7. `state`
8. `task`
9. `flow`
10. `route`
11. `tests`

### Subblocos de `task`

1. `docs`
2. `comments`
3. `input`
4. `output`
5. `rules`
6. `effects`
7. `auth`
8. `authz`
9. `dados`
10. `audit`
11. `segredos`
12. `forbidden`
13. `impl`
14. `vinculos`
15. `execucao`
16. `state`
17. `guarantees`
18. `error`
19. `tests`

## Saida JSON estavel

### `validar --json`

Campos minimos:

- `comando`
- `sucesso`
- `resultados[]`

Cada item de `resultados` inclui:

- `caminho`
- `modulo`
- `sucesso`
- `diagnosticos`

### `diagnosticos --json`

Campos minimos:

- `codigo`
- `mensagem`
- `severidade`
- `intervalo`
- `dica`
- `contexto`

### `ast --json`

Campos minimos:

- `comando`
- `caminho`
- `modulo`
- `sucesso`
- `diagnosticos`
- `ast`

### `ir --json`

Campos minimos:

- `comando`
- `caminho`
- `modulo`
- `sucesso`
- `diagnosticos`
- `ir`

### `verificar --json`

Campos minimos:

- `comando`
- `sucesso`
- `modulos[]`
- `totais`

Cada item de `modulos` inclui:

- `modulo`
- `arquivoFonte`
- `alvos[]`
- `saidaTestes[]`

Cada item de `alvos` inclui:

- `alvo`
- `arquivosGerados`
- `quantidadeTestes`
- `pastaSaida`
- `sucesso`

`totais` inclui:

- `modulos`
- `alvos`
- `arquivos`
- `testes`

### `formatar --json`

Campos minimos:

- `comando`
- `sucesso`
- `modo`
- `arquivos[]`
- `totais`

Cada item de `arquivos` inclui:

- `caminho`
- `alterado`
- `sucesso`
- `diagnosticos`

### `inspecionar --json`

Campos tipicos:

- `comando`
- `sucesso`
- `configuracao`
- `framework`
- `estruturaSaida`
- `alvos`
- `origens`
- `modulos`

## Exemplos de uso

### Iniciar um projeto backend ou consumer

```bash
sema iniciar --template nestjs
sema iniciar --template fastapi
sema iniciar --template nextjs-api
sema iniciar --template nextjs-consumer
sema iniciar --template react-vite-consumer
sema iniciar --template angular-consumer
sema iniciar --template flutter-consumer
sema iniciar --template node-firebase-worker
sema iniciar --template aspnet-api
sema iniciar --template springboot-api
sema iniciar --template go-http-api
sema iniciar --template rust-axum-api
sema iniciar --template cpp-service-bridge
```

### Inspecionar a configuracao resolvida

```bash
sema inspecionar --json
```

### Compilar scaffold base

```bash
node pacotes/cli/dist/index.js compilar exemplos/calculadora.sema --alvo typescript --saida ./generated --estrutura modulos
```

### Compilar scaffold NestJS

```bash
node pacotes/cli/dist/index.js compilar contratos/pedidos.sema --alvo typescript --framework nestjs --estrutura backend --saida ./generated/nestjs
```

### Compilar scaffold FastAPI

```bash
node pacotes/cli/dist/index.js compilar contratos/pagamentos.sema --alvo python --framework fastapi --estrutura backend --saida ./generated/fastapi
```

### Importar um backend NestJS legado

```bash
sema importar nestjs ./backend --saida ./sema/importado --json
```

### Importar um backend FastAPI legado

```bash
sema importar fastapi ./app --saida ./sema/importado --json
```

### Importar um backend Next.js App Router legado

```bash
sema importar nextjs ./frontend --saida ./sema/importado --json
```

### Importar um consumer Next.js App Router legado

```bash
sema importar nextjs-consumer ./frontend --saida ./sema/importado --json
```

### Importar um consumer React/Vite legado

```bash
sema importar react-vite-consumer ./frontend --saida ./sema/importado --json
```

### Importar um consumer Angular legado

```bash
sema importar angular-consumer ./frontend --saida ./sema/importado --json

sema importar flutter-consumer ./frontend --saida ./sema/importado --json
```

### Importar um worker Node/Firebase legado

```bash
sema importar firebase ./worker --saida ./sema/importado --json
```

### Importar projeto TypeScript, Python ou Dart generico

```bash
sema importar typescript ./src --saida ./sema/importado
sema importar python ./servicos --saida ./sema/importado
sema importar dart ./lib --saida ./sema/importado
```

### Starter, prompts e exemplos para IA

```bash
sema starter-ia
sema ajuda-ia
sema sync-ai-entrypoints --json
sema resumo contratos/pedidos.sema --micro --para onboarding
sema prompt-curto contratos/pedidos.sema --curto --para mudanca
sema prompt-ia
sema prompt-ia-ui
sema prompt-ia-react
sema prompt-ia-sema-primeiro
sema exemplos-prompt-ia
```

### Formatar todos os exemplos

```bash
node pacotes/cli/dist/index.js formatar exemplos
```

### Verificar se os exemplos ja estao canonicamente formatados

```bash
node pacotes/cli/dist/index.js formatar exemplos --check
```

### Rodar verificacao completa com saida JSON

```bash
node pacotes/cli/dist/index.js verificar exemplos --json --saida ./.tmp/verificacao-0-6
```

## Fluxo canonico do projeto

Fluxo operacional recomendado:

```bash
npm run status:check
npm test
npm run ia:sync-entrypoints
npm run format:check
node pacotes/cli/dist/index.js verificar exemplos --saida ./.tmp/verificacao-project-check
```

Na pratica, isso ja esta consolidado em:

```bash
npm run project:check
```

Smokes reais contra repos externos locais ficam fora do fluxo padrao e agora sao opt-in:

```bash
npm run test:smoke-real
```

# CLI da Sema

## Visao geral

A CLI da Sema e a interface oficial para:

- validacao semantica
- exportacao de AST e IR
- compilacao e scaffold de codigo
- formatacao canonica
- verificacao em lote
- inspecao de projeto
- onboarding de IA

No marco `0.6 backend-first`, ela tambem virou a fonte de verdade para:

- configuracao de projeto via `sema.config.json`
- scaffold orientado a framework para NestJS e FastAPI
- resolucao de multiplas origens `.sema`
- importacao assistida de legado para rascunho `.sema`
- inspecao nao destrutiva de projeto antes de gerar qualquer coisa

## Comandos disponiveis

### `sema iniciar [--template <base|nestjs|fastapi>]`

Cria uma estrutura inicial de projeto.

Templates:

- `base`: projeto minimo neutro
- `nestjs`: projeto voltado a scaffold backend TypeScript/NestJS
- `fastapi`: projeto voltado a scaffold backend Python/FastAPI

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
- framework ativo
- estrutura de saida
- alvos
- origens resolvidas
- modulos encontrados

Esse comando existe para evitar aquela merda de “a CLI nao achou meu modulo” sem ninguem saber qual contexto ela estava usando.

### `sema importar <nestjs|fastapi|typescript|python|dart> <diretorio> [--saida <diretorio>] [--namespace <base>] [--json]`

Importa um projeto legado e gera um **rascunho Sema revisavel**.

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
- `fastapi`: router, service e schema para rascunho backend Python
- `typescript`, `python`, `dart`: importacao generica focada em funcoes, classes e contratos basicos

### `sema starter-ia`

Imprime o texto curto de onboarding para colar em qualquer agente antes de editar arquivos `.sema`.

Tambem informa:

- origem da instalacao atual da CLI
- base detectada da instalacao
- documentos locais encontrados, quando existirem

### `sema ajuda-ia`

Imprime um guia curto e direto explicando qual comando de IA usar em cada situacao.

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

- `validar.json`
- `diagnosticos.json`
- `ast.json`
- `ir.json`
- `README.md` com o fluxo operacional recomendado

Sem `--json`, imprime um resumo humano e informa a pasta gerada.
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
7. `impl`
8. `state`
9. `guarantees`
10. `error`
11. `tests`

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

### Iniciar um projeto backend

```bash
sema iniciar --template nestjs
sema iniciar --template fastapi
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
npm run format:check
node pacotes/cli/dist/index.js verificar exemplos --saida ./.tmp/verificacao-project-check
```

Na pratica, isso ja esta consolidado em:

```bash
npm run project:check
```

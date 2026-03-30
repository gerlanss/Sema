# CLI da Sema

## Visao geral

A CLI da Sema e a interface oficial para validacao, compilacao, formatacao, inspecao semantica e verificacao operacional do projeto.

No estado atual do MVP, ela cobre:

- validacao semantica
- exportacao de AST e IR
- compilacao para Python e TypeScript
- execucao de testes gerados
- verificacao em lote
- formatacao canonica
- saida JSON estavel para automacao, IDE e IA

## Comandos disponiveis

### `sema iniciar`

Cria uma estrutura minima de projeto com configuracao e um exemplo inicial.

### `sema validar <arquivo-ou-pasta> [--json]`

Executa lexer, parser e analise semantica sem gerar codigo.

### `sema ast <arquivo.sema> [--json]`

Imprime a AST do modulo.

- sem `--json`, imprime a AST serializada diretamente
- com `--json`, envolve a AST em um envelope estavel com metadados do comando

### `sema ir <arquivo.sema> [--json]`

Imprime a representacao intermediaria semantica.

- sem `--json`, imprime a IR diretamente
- com `--json`, envolve a IR em um envelope estavel com metadados do comando

### `sema compilar <entrada> --alvo <python|typescript> --saida <diretorio>`

Gera artefatos compilados para o alvo escolhido.

### `sema gerar <python|typescript> <entrada> --saida <diretorio>`

Atalho para compilacao por alvo.

### `sema testar <arquivo.sema> --alvo <python|typescript> --saida <diretorio>`

Gera os artefatos de teste e tenta executa-los.

### `sema diagnosticos <arquivo.sema> [--json]`

Imprime diagnosticos em texto ou JSON estruturado.

### `sema verificar <arquivo-ou-pasta> [--saida <diretorio-base>] [--json]`

Executa o fluxo completo de verificacao em lote:

- valida todos os arquivos `.sema`
- gera artefatos para TypeScript e Python
- executa os testes gerados para cada modulo
- imprime um resumo final com modulos, alvos, arquivos gerados e quantidade de testes

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

### `sema starter-ia`

Imprime o texto curto de onboarding para colar em qualquer agente antes de editar arquivos `.sema`.

Tambem informa:

- origem da instalacao atual da CLI
- base detectada da instalacao
- documentos locais encontrados, quando existirem na instalacao atual

### `sema ajuda-ia`

Imprime um guia curto e direto explicando qual comando de IA usar em cada situacao.

Esse comando serve como porta de entrada unica para nao deixar onboarding, prompting e contexto espalhados igual bagunca de feira.

### `sema prompt-ia`

Imprime o prompt-base oficial para orientar uma IA a trabalhar com a Sema sem improvisar sintaxe ou semantica.

Assim como `starter-ia`, tambem mostra a origem da instalacao e os documentos locais detectados.

### `sema prompt-ia-ui`

Imprime um prompt oficial para tarefas em que a Sema deve ser usada junto com interface grafica, especialmente em combinacao com React + TypeScript.

Esse comando existe para evitar aquela cagada classica de pedir "um app bonito" e a IA devolver so um `index.html` solto, ignorando a camada semantica.

### `sema prompt-ia-react`

Imprime um prompt mais especifico para projeto com Sema + React + TypeScript, incluindo orientacao de arquitetura, componentes e separacao entre contrato semantico e interface.

### `sema prompt-ia-sema-primeiro`

Imprime um prompt oficial para forcar a estrategia "Sema primeiro".

Esse modo exige que a IA modele primeiro o dominio em `.sema` e so depois gere interface, backend ou qualquer implementacao derivada.

### `sema exemplos-prompt-ia`

Imprime exemplos prontos de prompt para:

- estrategia `Sema primeiro`
- `Sema + React + TypeScript`
- revisao e correcao de modulo `.sema`
- casos de UI sem perder a ancora semantica

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
7. `state`
8. `guarantees`
9. `error`
10. `tests`

## Saida JSON estavel

Na Fase 4, `--json` passou a ser contrato publico nos comandos-chave da CLI.

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

Retorna uma lista estruturada de diagnosticos com, no minimo:

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

## Exemplos de uso

### Validar em modo humano

```bash
node pacotes/cli/dist/index.js validar exemplos
```

### Validar em modo JSON

```bash
node pacotes/cli/dist/index.js validar exemplos --json
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
node pacotes/cli/dist/index.js verificar exemplos --json --saida ./.tmp/verificacao-fase4
```

## Fluxo canonico do projeto

O fluxo operacional recomendado da Sema agora e:

```bash
npm run status:check
npm test
npm run format:check
node pacotes/cli/dist/index.js verificar exemplos --saida ./.tmp/verificacao-project-check
```

Na pratica, isso ja esta consolidado no script:

```bash
npm run project:check
```

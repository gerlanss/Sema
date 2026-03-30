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

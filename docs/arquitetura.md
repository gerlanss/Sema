# Arquitetura Tecnica

## Leitura geral

A arquitetura da Sema continua simples no centro:

1. ler `.sema`
2. tokenizar
3. parsear AST
4. analisar semanticamente
5. converter para IR
6. gerar artefatos por alvo
7. validar e verificar

O que mudou no ciclo backend-first e que a saida agora pode assumir duas camadas:

- **base**: contratos e scaffold generico por alvo
- **framework**: scaffold orientado a NestJS ou FastAPI

## Pipeline

1. leitura dos arquivos `.sema`
2. resolucao de projeto a partir de:
   - entrada da CLI
   - `sema.config.json`
   - origens declaradas
3. tokenizacao pelo `lexer`
4. parsing em AST
5. analise semantica
6. conversao para IR
7. geracao para:
   - TypeScript
   - Python
   - Dart
8. opcionalmente, geracao backend orientada a framework:
   - NestJS
   - FastAPI
9. emissao de diagnosticos e verificacao

## Camadas

### `pacotes/nucleo`

Contem:

- `lexer`
- `parser`
- `ast`
- `semantico`
- `ir`
- `diagnosticos`
- `formatador`
- utilitarios de arquivos

Essa camada continua sendo o coracao da linguagem.

### `pacotes/gerador-typescript`

Gera:

- scaffold base TypeScript
- contratos executaveis
- validadores de `rules`
- verificadores de `guarantees`
- erros e adaptadores publicos
- scaffold backend para NestJS

### `pacotes/gerador-python`

Gera:

- scaffold base Python
- `dataclasses`
- validadores e verificadores
- erros e adaptadores publicos
- scaffold backend para FastAPI

### `pacotes/gerador-dart`

Gera:

- scaffold base Dart
- tipos e comentarios rastreaveis para interop

### `pacotes/cli`

Expose os comandos operacionais da linguagem:

- iniciar projeto
- validar
- inspecionar AST e IR
- compilar
- testar
- verificar
- formatar
- inspecionar projeto
- onboarding de IA

### `pacotes/editor-vscode`

Entrega ergonomia de editor:

- associacao `.sema`
- destaque de sintaxe
- snippets
- formatacao
- servidor de linguagem inicial

## Configuracao de projeto

O arquivo `sema.config.json` passa a ser a ancora do modo backend-first.

Campos suportados no estado atual:

- `origem` ou `origens`
- `saida`
- `alvos`
- `alvoPadrao`
- `estruturaSaida`
- `framework`
- `diretoriosSaidaPorAlvo`
- `convencoesGeracaoPorProjeto`

Isso permite:

- multiplas origens `.sema`
- defaults por projeto
- scaffold orientado a backend
- adocao incremental em projeto existente

## Responsabilidade da Sema

A Sema continua acima das stacks de implementacao.

Ela governa:

- contrato
- intencao
- estado
- fluxo
- erro
- efeito
- garantia

TypeScript, Python, Dart, NestJS e FastAPI continuam governando execucao concreta.

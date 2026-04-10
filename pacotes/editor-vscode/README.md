# Sema Language Tools

Sema Language Tools e a extensao oficial do VS Code para a Sema.

Ela cobre escrita, validacao e navegacao da camada semantica no editor enquanto a CLI fecha `drift`, importacao, contexto IA-first e verificacao completa.

## O que a extensao entrega

- associacao automatica de arquivos `.sema`
- highlight de sintaxe para os blocos principais da linguagem
- hover para palavras-chave centrais, incluindo os blocos de persistencia vendor-first
- diagnosticos semanticos no editor
- formatacao de documento
- comandos para abrir `starter-ia`, `prompt-ia`, `prompt-curto`, `resumo` e `drift`
- lateral `Sema` com status do workspace e da CLI

## Novidades na linha 1.5.3

- snippets para `database`, `postgres`, `mysql`, `sqlite`, `mongodb` e `redis`
- exemplos embutidos de persistencia gerados no workspace:
  - `persistencia_postgres.sema`
  - `persistencia_mysql.sema`
  - `persistencia_sqlite.sema`
  - `persistencia_mongodb.sema`
  - `persistencia_redis.sema`
- hover e highlight para `database`, `table`, `collection`, `document`, `keyspace`, `stream`, `query`, `index`, `retention` e correlatos
- alinhamento da extensao com a linha publica `1.5.3` e o patch do `drift` para JS/TS browser-side

## Instalar a extensao

Baixe a VSIX mais recente:

- <https://github.com/gerlanss/Sema/releases/latest/download/sema-language-tools-latest.vsix>

Instale:

```bash
code --install-extension ./sema-language-tools-latest.vsix --force
```

## Instalar a CLI

Para a experiencia completa:

```bash
npm install -g @semacode/cli
sema doctor
```

## Fluxo recomendado

1. abra o projeto no VS Code
2. configure a CLI se necessario
3. use a extensao para editar, formatar e revisar o contrato
4. rode a CLI para `drift`, `contexto-ia` e `verificar`

## O que a extensao nao tenta fazer sozinha

- substituir a CLI
- empacotar release
- publicar npm
- fazer adocao legada completa sem apoio da CLI

## Desenvolvimento

Empacotar a VSIX a partir do repo:

```bash
npm run extensao:empacotar
```

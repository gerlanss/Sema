# Sema Backend-First

A Sema entrou num ciclo em que o backend deixa de ser caso secundario e vira o terreno principal.

Leitura direta:

- a Sema continua sendo linguagem de intencao
- ela continua governando contrato e significado
- mas agora o foco pratico e **criar e editar backends reais**

No marco `0.6 backend-first`, a Sema ja cobre:

- scaffold base para TypeScript, Python e Dart
- scaffold orientado a framework para:
  - NestJS
  - FastAPI
- importacao assistida de legado para NestJS, FastAPI, TypeScript, Python e Dart
- configuracao de projeto com `sema.config.json`
- resolucao de `use` em multiplas origens do projeto
- inspecao nao destrutiva com `sema inspecionar`
- vinculacao de `task` com implementacao externa via `impl`

## O que isso muda na pratica

Antes, o fluxo mais comum era:

1. escrever `.sema`
2. validar
3. compilar um arquivo para uma pasta generica

Agora o fluxo backend-first pode ser:

1. iniciar um projeto com template
2. modelar o dominio em `contratos/*.sema`
3. inspecionar como a Sema esta resolvendo o projeto
4. compilar scaffold de backend
5. ligar implementacoes reais via `impl`

Para projeto que nao nasceu com Sema, o fluxo vira:

1. importar o legado com `sema importar`
2. revisar o rascunho `.sema`
3. validar, formatar e lapidar a intencao
4. compilar scaffold quando fizer sentido
5. usar `impl` para amarrar o contrato ao codigo vivo

## Templates iniciais

### NestJS

```bash
sema iniciar --template nestjs
```

Isso cria um projeto com:

- `sema.config.json`
- `contratos/pedidos.sema`
- convencao de geracao backend para TypeScript

### FastAPI

```bash
sema iniciar --template fastapi
```

Isso cria um projeto com:

- `sema.config.json`
- `contratos/pedidos.sema`
- convencao de geracao backend para Python

## Inspecionar antes de gerar

Para evitar aquela zona de projeto em que ninguem sabe de onde a CLI esta lendo ou para onde vai escrever:

```bash
sema inspecionar --json
```

Esse comando mostra:

- configuracao encontrada
- framework ativo
- estrutura de saida
- alvos do projeto
- origens resolvidas
- modulos encontrados

## Gerar scaffold NestJS

```bash
sema compilar --framework nestjs
```

Saida tipica:

- `src/<contexto>/<modulo>.contract.ts`
- `src/<contexto>/dto/<modulo>.dto.ts`
- `src/<contexto>/<modulo>.service.ts`
- `src/<contexto>/<modulo>.controller.ts`
- `test/<contexto>/<modulo>.contract.test.ts`
- `test/<contexto>/<modulo>.controller.spec.ts`

## Gerar scaffold FastAPI

```bash
sema compilar --framework fastapi
```

Saida tipica:

- `app/<contexto>/<modulo>_contract.py`
- `app/<contexto>/<modulo>_schemas.py`
- `app/<contexto>/<modulo>_service.py`
- `app/<contexto>/<modulo>_router.py`
- `tests/<contexto>/test_<modulo>_contract.py`
- `tests/<contexto>/test_<modulo>_router.py`

## O papel de `impl`

`impl` continua sendo a ponte mais limpa entre intencao e codigo vivo.

Exemplo:

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
    py: servicos.pagamentos.processar
  }
  guarantees {
    protocolo existe
  }
}
```

Leitura pratica:

- a Sema manda no contrato
- NestJS ou FastAPI mantem execucao real
- `impl` deixa rastreavel onde a implementacao vive

## Importacao assistida de legado

Exemplos:

```bash
sema importar nestjs ./backend --saida ./sema/importado
sema importar fastapi ./app --saida ./sema/importado
sema importar python ./servicos --saida ./sema/importado
```

O resultado e um **rascunho Sema valido para revisao**, nao uma promessa de engenharia reversa perfeita. A intencao aqui e poupar o trabalho bruto de migracao, dar visibilidade semantica e acelerar a adocao incremental.

## O que ainda nao e o foco

- UI
- runtime proprio
- framework acoplado a sintaxe da linguagem
- "gerar backend inteiro e subir sem tocar em nada"

A Sema aqui faz o trabalho pesado de:

- travar dominio
- explicitar contrato
- gerar scaffold coerente
- reduzir improviso conceitual

E deixa o framework fazer o resto com dignidade.

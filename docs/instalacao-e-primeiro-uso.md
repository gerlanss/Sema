# Instalacao e Primeiro Uso

Este guia explica o minimo necessario para instalar, compilar e usar a Sema pela primeira vez sem cair naquela confusao de “instalei a linguagem” quando, na real, voce so linkou a CLI do repositorio.

## Requisitos

Para rodar a Sema hoje, voce precisa de:

- Node.js instalado
- npm funcionando
- este repositorio clonado ou baixado

Para rodar o fluxo completo com testes gerados em Python:

- Python 3
- `pytest` instalado no ambiente

## Instalacao basica do projeto

Na raiz do repositorio:

```bash
npm install
npm run build
```

Se quiser validar o projeto inteiro logo de cara:

```bash
npm run project:check
```

## Instalar a CLI da Sema no Windows

Esse fluxo instala a **CLI da Sema a partir deste repositorio**.

Ele:

- nao baixa o projeto por conta propria
- nao instala a extensao do VS Code
- nao publica nada na maquina alem do comando linkado da CLI

Na raiz do projeto:

```powershell
npm install
npm run build
npm run cli:instalar-local
```

O `cli:instalar-local`:

1. garante que o prefixo global do npm entre no `PATH` do usuario no Windows
2. executa o `npm link` da CLI da Sema

Depois disso:

```powershell
sema
sema validar exemplos/calculadora.sema
```

Se o PowerShell ainda nao reconhecer `sema`, feche e abra o terminal de novo.

Se mesmo assim o comando ainda nao estiver visivel, use temporariamente:

```powershell
node pacotes/cli/dist/index.js validar exemplos/calculadora.sema
```

Para remover o comando instalado:

```powershell
npm run cli:desinstalar-local
```

## Primeiro fluxo util

### Validar um modulo

```bash
node pacotes/cli/dist/index.js validar exemplos/calculadora.sema
```

### Ver AST

```bash
node pacotes/cli/dist/index.js ast exemplos/calculadora.sema --json
```

### Ver IR

```bash
node pacotes/cli/dist/index.js ir exemplos/calculadora.sema --json
```

### Formatar

```bash
node pacotes/cli/dist/index.js formatar exemplos/calculadora.sema
```

### Verificar tudo

```bash
node pacotes/cli/dist/index.js verificar exemplos --saida ./.tmp/verificacao
```

## Primeiro fluxo backend-first

Se o objetivo for usar a Sema do jeito mais forte dela hoje, o caminho certo e backend.

### Iniciar um projeto NestJS

```bash
sema iniciar --template nestjs
sema inspecionar --json
sema compilar --framework nestjs
```

### Iniciar um projeto FastAPI

```bash
sema iniciar --template fastapi
sema inspecionar --json
sema compilar --framework fastapi
```

O `sema inspecionar` serve para mostrar:

- configuracao encontrada
- framework ativo
- estrutura de saida
- alvos
- origens resolvidas
- modulos encontrados

Ou seja: ele evita aquela cagada de a CLI estar lendo um projeto diferente do que voce pensou.

## `sema.config.json`

O estado atual da Sema assume projeto configurado.

Exemplo:

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

## Gerar codigo

### Scaffold base

```bash
node pacotes/cli/dist/index.js compilar exemplos/calculadora.sema --alvo typescript --saida ./saida/typescript
node pacotes/cli/dist/index.js compilar exemplos/calculadora.sema --alvo python --saida ./saida/python
node pacotes/cli/dist/index.js compilar exemplos/calculadora.sema --alvo dart --saida ./saida/dart
```

### Scaffold NestJS

```bash
node pacotes/cli/dist/index.js compilar contratos/pedidos.sema --alvo typescript --framework nestjs --estrutura backend --saida ./generated/nestjs
```

### Scaffold FastAPI

```bash
node pacotes/cli/dist/index.js compilar contratos/pagamentos.sema --alvo python --framework fastapi --estrutura backend --saida ./generated/fastapi
```

### Estruturas de saida

- `flat`: tudo direto na pasta de saida
- `modulos`: pasta por namespace/contexto e arquivo por modulo
- `backend`: convencoes de scaffold backend

## Modularizar com `use`

Se voce nao quiser transformar o projeto num `.sema` gigante, use multiplos arquivos.

Exemplo:

```sema
module app.pagamentos {
  use base.contratos
  use ts app.gateway.pagamentos
  use py servicos.conciliacao
  use dart app.mobile.pagamentos
}
```

Leitura pratica:

- `use base.contratos`: importa outro modulo `.sema`
- `use ts ...`, `use py ...`, `use dart ...`: declara interop externo

No estado atual:

- a resolucao semantica completa acontece entre arquivos `.sema`
- `ts`, `py` e `dart` entram como contratos externos declarados
- `origens` no `sema.config.json` ajudam a resolver projeto maior

## Ligar uma `task` a implementacoes externas com `impl`

Quando voce quiser declarar onde a implementacao concreta mora:

```sema
task processar_pagamento {
  input {
    pagamento_id: Id required
  }
  output {
    protocolo: Id
  }
  impl {
    ts: app.gateway.pagamentos.processar
    py: servicos.pagamentos.processar
    dart: app.mobile.pagamentos.processar
  }
  guarantees {
    protocolo existe
  }
}
```

Na pratica:

- `impl` nao substitui a semantica da task
- ele so declara onde a implementacao concreta mora
- isso aparece na IR e nos geradores como rastreabilidade multi-stack

## Preparar contexto para IA

Se voce quiser preparar um pacote de contexto para uma IA trabalhar num modulo especifico:

```bash
sema contexto-ia exemplos/pagamento.sema
```

Esse comando gera um pacote em `.tmp/contexto-ia/...` com:

- `validar.json`
- `diagnosticos.json`
- `ast.json`
- `ir.json`
- `README.md` com o fluxo recomendado para o agente

Se a tarefa pedir codigo derivado, o comando que nao pode ser ignorado e:

```bash
sema compilar contratos/pedidos.sema --alvo typescript --framework nestjs --estrutura backend --saida ./generated/nestjs
```

## Extensao VS Code

A extensao fica em [../pacotes/editor-vscode](../pacotes/editor-vscode) e cobre:

- highlight de sintaxe
- snippets
- formatacao
- diagnosticos semanticos em tempo real
- hover basico
- reinicio manual do servidor de linguagem

Configuracoes importantes:

- `sema.cliPath`: caminho explicito para a CLI da Sema
- `sema.diagnosticosAoDigitar`: liga ou desliga recalculo durante digitacao

### Empacotar a extensao

```bash
npm run extensao:empacotar
```

O `.vsix` sai em:

- `.tmp/editor-vscode/sema-language-tools-0.1.1.vsix`

### Instalar a extensao no VS Code

```bash
npm run extensao:instalar-local
```

Ou manualmente:

```bash
code --install-extension .tmp/editor-vscode/sema-language-tools-0.1.1.vsix --force
```

## Usar a CLI em outro projeto

Se voce quiser levar a CLI para outro projeto sem arrastar o repositorio inteiro:

```bash
npm run cli:empacotar
```

Isso gera um pacote `.tgz` em `.tmp/pacotes`.

Depois, no outro projeto:

```bash
npm install caminho/para/o/pacote/sema-cli-0.1.0.tgz
npx sema validar contratos/exemplo.sema
```

## Problemas comuns

### `node` ou `npm` nao encontrados

Seu ambiente ainda nao tem Node.js corretamente instalado ou configurado no `PATH`.

### `pytest` nao encontrado

O fluxo de verificacao com alvo Python depende de `pytest`.

### `validar` falha em modulo com `use`

Confira:

- se o `sema.config.json` do projeto foi encontrado
- se `origens` aponta para a pasta certa
- se o modulo existe no conjunto de arquivos `.sema` resolvido

Para `use ts`, `use py` e `use dart`, o comportamento e diferente: esses imports sao tratados como interoperabilidade declarada, nao como modulo `.sema` que precisa existir no projeto.

### `formatar --check` falha

Isso significa que o arquivo ainda nao esta no estilo canonico. Rode o formatador sem `--check` e tente de novo.

### `compilar --framework nestjs` ou `fastapi` falha

Confere se:

- `nestjs` esta sendo usado com alvo `typescript`
- `fastapi` esta sendo usado com alvo `python`
- `dart` esta sendo usado com `framework base`

## Caminho recomendado para comecar

1. ler [../README.md](../README.md)
2. rodar `npm install`
3. rodar `npm run build`
4. rodar `sema inspecionar --json`
5. validar [../exemplos/calculadora.sema](../exemplos/calculadora.sema)
6. inspecionar [../exemplos/pagamento.sema](../exemplos/pagamento.sema)
7. rodar `npm run project:check`

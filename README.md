# Sema

![Logo da Sema](./logo.png)

Sema e uma linguagem estruturada para IA, voltada a modelagem explicita de contratos e intencao. Ela existe para reduzir ambiguidade semantica e permitir que IA e humanos operem sobre significado explicito.

Na pratica, a Sema nasce como linguagem de intencao. Ela nao quer substituir TypeScript, Python, Dart ou framework nenhum. Ela governa a camada de significado acima deles: contrato, fluxo, estado, erro, efeito, garantia e teste.

No marco atual, `0.6 backend-first`, o foco deixou de ser so “fechar MVP” e virou algo bem mais util: **criar e editar projetos backend reais** com scaffold forte, configuracao de projeto, integracao com frameworks e adocao incremental em codigo vivo.

## O que significa ser uma linguagem estruturada para IA

Significa que a Sema nao foi desenhada para obrigar a IA a adivinhar o sistema.

Ela explicita:

- intencao da operacao
- contrato de entrada e saida
- regras obrigatorias
- efeitos operacionais
- erros esperados
- garantias finais
- fluxo e estado do dominio

Ou seja: a Sema nao existe para substituir stacks maduras. Ela existe para governar significado acima delas.

## Backend-first em 30 segundos

Hoje a Sema ja faz bem estas porras aqui:

- modela dominio, contrato, borda publica, erro, garantia, efeito e fluxo
- gera scaffold base para TypeScript, Python e Dart
- gera scaffold orientado a framework para NestJS e FastAPI
- organiza projeto via `sema.config.json`
- resolve `use` em multiplas origens de projeto
- vincula `task` a implementacao real via `impl`
- ajuda IA e humanos a editar backend sem virar pantano semantico

### Iniciar um backend NestJS

```bash
sema iniciar --template nestjs
sema inspecionar --json
sema compilar --framework nestjs
```

Saida tipica:

- `src/<contexto>/<modulo>.contract.ts`
- `src/<contexto>/dto/<modulo>.dto.ts`
- `src/<contexto>/<modulo>.service.ts`
- `src/<contexto>/<modulo>.controller.ts`
- `test/<contexto>/<modulo>.contract.test.ts`
- `test/<contexto>/<modulo>.controller.spec.ts`

### Iniciar um backend FastAPI

```bash
sema iniciar --template fastapi
sema inspecionar --json
sema compilar --framework fastapi
```

Saida tipica:

- `app/<contexto>/<modulo>_contract.py`
- `app/<contexto>/<modulo>_schemas.py`
- `app/<contexto>/<modulo>_service.py`
- `app/<contexto>/<modulo>_router.py`
- `tests/<contexto>/test_<modulo>_contract.py`
- `tests/<contexto>/test_<modulo>_router.py`

### Importar um backend legado para rascunho Sema

Se o projeto nao nasceu com Sema, a CLI agora consegue puxar um rascunho inicial a partir de codigo vivo.

Exemplos:

```bash
sema importar nestjs ./backend --saida ./sema/importado
sema importar fastapi ./app --saida ./sema/importado
sema importar python ./servicos --saida ./sema/importado
sema importar typescript ./src --saida ./sema/importado
sema importar dart ./lib --saida ./sema/importado
```

Fluxo recomendado:

1. importar o legado para `.sema`
2. revisar e lapidar o contrato
3. rodar `sema formatar` e `sema validar --json`
4. conectar implementacoes reais via `impl`
5. compilar scaffold quando fizer sentido

Regra pratica:

- `importar` gera um **rascunho Sema valido para revisao**
- ele nao promete reconstruir toda a intencao do projeto sozinho
- ele serve para cortar o trabalho bruto de migracao e dar um ponto de partida coerente

## Documentacao principal

- [STATUS.md](./STATUS.md)
- [docs/backend-first.md](./docs/backend-first.md)
- [docs/arquitetura.md](./docs/arquitetura.md)
- [docs/roadmap.md](./docs/roadmap.md)
- [docs/instalacao-e-primeiro-uso.md](./docs/instalacao-e-primeiro-uso.md)
- [docs/cli.md](./docs/cli.md)
- [docs/integracao-com-ia.md](./docs/integracao-com-ia.md)
- [docs/da-sema-para-codigo.md](./docs/da-sema-para-codigo.md)
- [docs/importacao-legado.md](./docs/importacao-legado.md)
- [docs/adocao-nestjs-existente.md](./docs/adocao-nestjs-existente.md)
- [docs/adocao-fastapi-existente.md](./docs/adocao-fastapi-existente.md)
- [docs/nestjs-prisma-sema.md](./docs/nestjs-prisma-sema.md)
- [docs/pagamento-ponta-a-ponta.md](./docs/pagamento-ponta-a-ponta.md)
- [docs/AGENT_STARTER.md](./docs/AGENT_STARTER.md)
- [docs/prompt-base-ia-sema.md](./docs/prompt-base-ia-sema.md)

## Instalar a CLI da Sema no Windows

Esse fluxo instala a **CLI da Sema a partir deste repositorio**. Ele **nao baixa o projeto sozinho**, **nao instala a extensao do VS Code** e **nao publica nada na sua maquina alem do comando linkado da CLI**.

Pre-requisitos:

- Node.js instalado
- npm funcionando
- este repositorio ja clonado ou baixado

Na raiz do projeto:

```powershell
npm install
npm run build
npm run cli:instalar-local
```

O `cli:instalar-local`:

1. garante que o prefixo global do npm entre no `PATH` do usuario no Windows
2. executa o `npm link` da CLI da Sema

Depois disso, feche e abra o terminal para o PowerShell recarregar o `PATH`.

Teste assim:

```powershell
sema
sema validar exemplos/calculadora.sema
```

Se o comando `sema` ainda nao aparecer, use a CLI direto por arquivo enquanto o ambiente se acerta:

```powershell
node pacotes/cli/dist/index.js validar exemplos/calculadora.sema
```

Para remover o comando linkado:

```powershell
npm run cli:desinstalar-local
```

## Extensao VS Code

A extensao da Sema para VS Code ja tem:

- associacao automatica de `.sema`
- highlight de sintaxe
- snippets
- comando `Sema: Formatar Documento`
- servidor de linguagem com diagnosticos semanticos
- hover basico
- formatacao via servidor e via CLI

Para empacotar:

```bash
npm run extensao:empacotar
```

Pacote gerado:

- `.tmp/editor-vscode/sema-language-tools-0.1.1.vsix`

Para instalar localmente:

```bash
npm run extensao:instalar-local
```

Ou manualmente:

```bash
code --install-extension .tmp/editor-vscode/sema-language-tools-0.1.1.vsix --force
```

## Exemplo rapido

```sema
module exemplos.calculadora {
  task somar {
    input {
      a: Numero required
      b: Numero required
    }
    output {
      resultado: Numero
    }
    guarantees {
      resultado existe
    }
    tests {
      caso "soma basica" {
        given {
          a: 2
          b: 3
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }
}
```

## Configuracao de projeto

A Sema agora tem um `sema.config.json` pensado para projeto real:

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

Isso controla:

- onde a CLI procura os `.sema`
- qual alvo usar por padrao
- qual estrutura de saida usar
- qual framework guiar o scaffold
- para onde cada stack gera arquivo

Para ver exatamente o que a CLI esta resolvendo no projeto atual:

```bash
sema inspecionar --json
```

## Modularizacao e interop

A Sema suporta dois niveis de conexao:

- `use modulo.outro` para importar outro modulo `.sema`
- `use ts ...`, `use py ...`, `use dart ...` para declarar interoperabilidade externa

Exemplo:

```sema
module app.pagamentos {
  use base.contratos
  use ts app.gateway.pagamentos
  use py servicos.conciliacao
  use dart app.mobile.pagamentos
}
```

No estado atual:

- `use` entre arquivos `.sema` participa da resolucao semantica real
- `use ts|py|dart` registra contrato externo de interop
- a Sema continua governando o significado; ela nao vira serva da stack ao redor

## Vincular uma task a implementacoes externas

Quando fizer sentido dizer onde a implementacao concreta mora, use `impl`:

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

Leitura pratica:

- `use ts|py|dart ...` declara interoperabilidade do modulo
- `impl` liga a `task` a implementacoes concretas
- a Sema continua mandando no contrato; a stack concreta executa

## Gerar scaffold base

### Python

```bash
node pacotes/cli/dist/index.js compilar exemplos/calculadora.sema --alvo python --saida ./saida/python
```

### TypeScript

```bash
node pacotes/cli/dist/index.js compilar exemplos/calculadora.sema --alvo typescript --saida ./saida/typescript
```

### Dart

```bash
node pacotes/cli/dist/index.js compilar exemplos/calculadora.sema --alvo dart --saida ./saida/dart
```

## Gerar scaffold backend

Se voce quiser saida organizada por namespace:

```bash
node pacotes/cli/dist/index.js compilar exemplos/calculadora.sema --alvo typescript --saida ./generated --estrutura modulos
```

Isso gera algo como:

- `generated/exemplos/calculadora.ts`
- `generated/exemplos/calculadora.test.ts`

Se a ideia for scaffold orientado a framework:

### NestJS

```bash
node pacotes/cli/dist/index.js compilar contratos/pedidos.sema --alvo typescript --framework nestjs --estrutura backend --saida ./generated/nestjs
```

### FastAPI

```bash
node pacotes/cli/dist/index.js compilar contratos/pagamentos.sema --alvo python --framework fastapi --estrutura backend --saida ./generated/fastapi
```

Regra pratica:

- `framework base`: scaffold sem framework
- `framework nestjs`: scaffold TypeScript para controller/service/dto
- `framework fastapi`: scaffold Python para router/service/schema

## Rodar testes e verificacoes

```bash
npm test
```

Fluxo completo do projeto:

```bash
npm run project:check
```

Verificacao em lote dos exemplos:

```bash
node pacotes/cli/dist/index.js verificar exemplos --saida ./.tmp/verificacao
```

Formatacao canonica:

```bash
node pacotes/cli/dist/index.js formatar exemplos
node pacotes/cli/dist/index.js formatar exemplos --check
```

JSON para automacao, IDE e IA:

```bash
node pacotes/cli/dist/index.js validar exemplos --json
node pacotes/cli/dist/index.js verificar exemplos --json --saida ./.tmp/verificacao-json
```

Se a tarefa pedir codigo derivado, esse comando tem que entrar no fluxo:

```bash
node pacotes/cli/dist/index.js compilar contratos/pagamentos.sema --alvo typescript --framework nestjs --estrutura backend --saida ./saida/nestjs
```

## Onboarding para IA

A Sema ja tem um fluxo nativo bem menos burro para agentes:

```bash
sema ajuda-ia
sema starter-ia
sema prompt-ia
sema prompt-ia-ui
sema prompt-ia-react
sema prompt-ia-sema-primeiro
sema exemplos-prompt-ia
sema contexto-ia exemplos/pagamento.sema
```

Se a IA for gerar backend a partir do contrato, nao vacile:

```bash
sema ast contratos/pedidos.sema --json
sema ir contratos/pedidos.sema --json
sema validar contratos/pedidos.sema --json
sema compilar contratos/pedidos.sema --alvo typescript --framework nestjs --estrutura backend --saida ./generated/nestjs
```

## Estrutura do repositorio

```text
docs/                        Documentacao conceitual e tecnica
exemplos/                    Modulos .sema completos
pacotes/nucleo/              Lexer, parser, AST, semantica e IR
pacotes/gerador-python/      Geracao de codigo Python
pacotes/gerador-typescript/  Geracao de codigo TypeScript
pacotes/gerador-dart/        Geracao de codigo Dart
pacotes/cli/                 Interface de linha de comando
pacotes/editor-vscode/       Extensao de VS Code para `.sema`
pacotes/padroes/             Funcoes auxiliares compartilhadas
testes/                      Testes de unidade e integracao
```

## Estagio atual

As quatro fases do MVP base ja foram fechadas:

- Fase 1: fundacao do compilador
- Fase 2: semantica operacional do nucleo
- Fase 3: operacionalizacao real da linguagem
- Fase 4: ferramentas de adocao

Depois disso, a Sema fechou o marco `0.6 backend-first`, entregando:

- `sema.config.json` com defaults de projeto e multiplas origens
- `sema inspecionar` para diagnostico nao destrutivo
- scaffold backend util para NestJS
- scaffold backend util para FastAPI
- `impl` como ponte estavel entre contrato e implementacao viva
- melhor resolucao de `use` para contexto de projeto
- diagnosticos melhores de `use` e `flow`

Hoje a Sema ja:

- modela contrato, estado, fluxo, erro, efeito e garantia
- fortalece `route` como contrato publico semantico
- gera scaffold base para TypeScript, Python e Dart
- gera scaffold de framework para NestJS e FastAPI
- expoe AST, IR, diagnosticos e verificacao em JSON
- aplica formatacao canonica oficial
- oferece extensao VS Code com LSP inicial

## Roadmap resumido

- aprofundar criacao e edicao de backend em projeto vivo
- amadurecer `flow` para orquestracao backend mais rica
- fortalecer `use` para projetos maiores e multiplos contextos
- enriquecer contratos de execucao, efeitos, erros e garantias
- evoluir o suporte de editor alem do LSP inicial atual

## Aviso importante

A Sema ja deixou de ser so “documentacao premium”, mas ainda seria papo furado vender como “backend inteiro pronto sem tocar em nada”. Ela manda muito bem como linguagem de intencao, contrato e scaffold. A implementacao real continua vivendo nas stacks e frameworks ao redor com ajuda de `impl`, geradores e adocao incremental.

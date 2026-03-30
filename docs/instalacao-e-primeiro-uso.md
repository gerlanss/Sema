# Instalacao e Primeiro Uso

Este guia explica o minimo necessario para instalar, compilar e usar a Sema pela primeira vez.

## Requisitos

Para rodar a Sema hoje, voce precisa de:

- Node.js instalado
- npm funcionando
- dependencias do projeto instaladas

Para rodar o fluxo completo com testes gerados em Python, voce tambem precisa de:

- Python 3
- `pytest` instalado no ambiente

## Instalacao

Na raiz do repositorio:

```bash
npm install
npm run build
```

Se voce quiser garantir que o projeto inteiro esta saudavel logo de cara:

```bash
npm run project:check
```

## Instalacao no Windows

No Windows, o caminho mais direto e:

```powershell
npm install
npm run build
npm run cli:instalar-local
```

Esse script faz duas coisas:

1. garante que o prefixo global do npm entre no `PATH` do usuario no Windows
2. executa o `npm link` da CLI da Sema

Entao ele ja tenta deixar o comando `sema` disponivel sem voce precisar mexer manualmente nas variaveis do sistema.

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

## Usar a CLI como comando `sema`

Se voce quiser usar a ferramenta sem chamar o arquivo `dist/index.js` manualmente:

```bash
npm run cli:instalar-local
```

Depois disso, voce pode usar:

```bash
sema validar exemplos/calculadora.sema
sema formatar exemplos --check
sema verificar exemplos --saida ./.tmp/verificacao
sema ajuda-ia
sema starter-ia
sema prompt-ia
```

Para remover esse comando instalado localmente:

```bash
npm run cli:desinstalar-local
```

No Windows, esse script usa `npm unlink -g @sema/cli`.

## Primeiro comando util

Para validar um modulo `.sema`:

```bash
node pacotes/cli/dist/index.js validar exemplos/calculadora.sema
```

## Consultar a estrutura do modulo

Para ver a forma sintatica:

```bash
node pacotes/cli/dist/index.js ast exemplos/calculadora.sema --json
```

Para ver a forma semantica resolvida:

```bash
node pacotes/cli/dist/index.js ir exemplos/calculadora.sema --json
```

## Gerar codigo

### Python

```bash
node pacotes/cli/dist/index.js compilar exemplos/calculadora.sema --alvo python --saida ./saida/python
```

### TypeScript

```bash
node pacotes/cli/dist/index.js compilar exemplos/calculadora.sema --alvo typescript --saida ./saida/typescript
```

## Formatar um modulo

Para aplicar o estilo canonico oficial:

```bash
node pacotes/cli/dist/index.js formatar exemplos/calculadora.sema
```

Para apenas verificar se o arquivo ja esta formatado:

```bash
node pacotes/cli/dist/index.js formatar exemplos/calculadora.sema --check
```

## Rodar verificacao completa

Para validar, gerar e testar todos os exemplos:

```bash
node pacotes/cli/dist/index.js verificar exemplos --saida ./.tmp/verificacao
```

Para usar o fluxo consolidado do projeto:

```bash
npm run project:check
```

## Preparar contexto para IA

Se voce quiser preparar um pacote de contexto para uma IA trabalhar em um modulo especifico:

```bash
sema contexto-ia exemplos/pagamento.sema
```

Esse comando gera um pacote em `.tmp/contexto-ia/...` com:

- `validar.json`
- `diagnosticos.json`
- `ast.json`
- `ir.json`
- `README.md` com o fluxo recomendado para o agente

## Extensao VS Code

A extensao fica em [pacotes/editor-vscode](C:\GitHub\Sema\pacotes\editor-vscode) e agora cobre um pacote bem mais util de editor:

- highlight de sintaxe
- snippets
- formatacao
- diagnosticos semanticos em tempo real
- hover basico
- reinicio manual do servidor de linguagem

Ela tambem usa o logo oficial da Sema como icone do pacote.

Configuracoes importantes:

- `sema.cliPath`: caminho explicito para a CLI da Sema
- `sema.diagnosticosAoDigitar`: liga ou desliga recalculo durante digitacao

Para funcionar fora do repositorio principal, o caminho mais simples e ter o comando `sema` disponivel no sistema.

## Usar a Sema em outro projeto sem copiar o repositorio inteiro

Se voce quiser levar apenas a CLI para outro projeto, sem arrastar o repositorio todo:

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

No estado atual, a CLI resolve bem modulos vizinhos no mesmo conjunto de trabalho. Se faltar modulo importado, confira se os arquivos `.sema` relacionados estao na mesma pasta de projeto ou no conjunto de compilacao esperado.

### `formatar --check` falha

Isso significa que o arquivo ainda nao esta no estilo canonico. Rode o formatador sem `--check` e tente de novo.

## Caminho recomendado para comecar

Se voce esta chegando agora, a ordem mais util e:

1. ler [README.md](../README.md)
2. rodar `npm install`
3. rodar `npm run build`
4. validar [calculadora.sema](../exemplos/calculadora.sema)
5. inspecionar [pagamento.sema](../exemplos/pagamento.sema)
6. rodar `npm run project:check`

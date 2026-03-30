# Distribuicao da CLI da Sema

Este documento explica como usar a Sema fora do repositorio de desenvolvimento da linguagem.

Hoje a Sema ainda e um projeto em evolucao, mas a CLI ja pode ser usada de tres formas praticas:

1. diretamente do repositorio
2. instalada localmente como comando `sema`
3. empacotada para instalacao em outro projeto

## 1. Uso direto do repositorio

Esse e o modo mais simples para desenvolver a linguagem e testar rapidamente:

```bash
npm install
npm run build
node pacotes/cli/dist/index.js validar exemplos/calculadora.sema
```

Esse modo e bom para:

- evolucao da linguagem
- testes locais
- manutencao do compilador

## 2. Instalar localmente como comando `sema`

Se voce quer usar a CLI no terminal sem ficar chamando `node pacotes/cli/dist/index.js`, o caminho oficial e:

```bash
npm run cli:instalar-local
```

Depois disso, a CLI passa a poder ser chamada assim:

```bash
sema validar exemplos/calculadora.sema
sema verificar exemplos --saida ./.tmp/verificacao
sema formatar exemplos --check
```

Para remover o comando local instalado:

```bash
npm run cli:desinstalar-local
```

Esse modo e bom para:

- uso frequente no proprio ambiente
- testar a experiencia real de terminal
- reduzir o atrito de uso da ferramenta

## 3. Empacotar a CLI para outro projeto

Se voce quer usar a Sema em outro repositorio sem copiar o projeto inteiro, empacote a CLI:

```bash
npm run cli:empacotar
```

Esse comando gera um pacote `.tgz` em `.tmp/pacotes`.

Depois, no outro projeto, voce pode instalar o pacote gerado:

```bash
npm install caminho/para/o/pacote/sema-cli-0.1.0.tgz
```

E usar via:

```bash
npx sema validar contratos/pedido.sema
```

Esse modo e bom para:

- testar a CLI fora do repositorio principal
- integrar a Sema em outro projeto
- validar o caminho de distribuicao antes de publicacao formal

## Modelo mental correto

A Sema nao e runtime de aplicacao. Ela funciona como:

- linguagem de especificacao
- validador semantico
- compilador/transpilador
- gerador de artefatos
- ferramenta operacional para IA, automacao e editor

Entao o uso normal e:

1. escrever `.sema`
2. validar
3. formatar
4. compilar
5. verificar
6. consumir o codigo gerado em Python ou TypeScript

## Estado atual

Hoje, o caminho mais maduro e:

- usar a CLI no proprio repositorio
- ou instalar localmente com `npm link`

O empacotamento `.tgz` ja resolve bem o uso em outro projeto sem exigir que a pessoa copie o repositorio inteiro.

## O que ainda nao e o foco agora

- publicacao oficial em registry publico
- instalador multiplataforma dedicado
- runtime web acoplado
- sistema de pacotes semanticos da linguagem

O objetivo atual e deixar a CLI usavel de verdade sem forcar a pessoa a arrastar a oficina inteira junto.

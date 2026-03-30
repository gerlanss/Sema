# Sema Language Tools

Suporte de editor para a linguagem **Sema**, uma linguagem estruturada para IA, voltada a modelagem explicita de contratos e intencao.

Na pratica, a extensao assume a mesma tese da linguagem: reduzir ambiguidade semantica e deixar **significado, fluxo, estado, erros e garantias** explicitos para IA e humanos.

Esta extensao leva a Sema para dentro do VS Code sem transformar o editor num circo pesado: highlight, snippets, formatacao e um servidor de linguagem inicial de verdade.

## Recursos

- associacao automatica de arquivos `.sema`
- destaque de sintaxe para os blocos centrais da linguagem
- snippets para `module`, `task`, `flow`, `route` e `state`
- comando `Sema: Formatar Documento`
- servidor de linguagem inicial com:
  - diagnosticos semanticos
  - hover basico para palavras-chave centrais
  - formatacao de documento
- integracao com a CLI da Sema

## O que a extensao ja resolve

- editar `.sema` com legibilidade
- detectar diagnosticos semanticos no editor
- formatar com o estilo canonico da linguagem
- trabalhar com a CLI local ou instalada no sistema

## O que ela ainda nao tenta fazer

- LSP completo com autocomplete rico e code actions avancadas
- runtime web
- geracao automatica de interface

Ela existe para respeitar a camada semantica da Sema, nao para inventar moda por cima dela.

## Como a extensao encontra a CLI

A extensao tenta localizar a CLI nesta ordem:

1. `sema.cliPath`, se voce configurar manualmente
2. bin `sema` disponivel no sistema
3. `node_modules/.bin/sema` do projeto atual
4. CLI local do proprio repositorio da Sema

Se o comando `sema` funciona no terminal, a extensao quase sempre vai funcionar feliz tambem.

## Comandos disponiveis

- `Sema: Formatar Documento`
- `Sema: Reiniciar Servidor de Linguagem`

## Configuracoes

### `sema.cliPath`

Permite apontar manualmente para a CLI da Sema quando ela nao estiver no `PATH`.

### `sema.diagnosticosAoDigitar`

Liga ou desliga o recalculo de diagnosticos semanticos durante a digitacao.

## Instalacao

### Pela loja do VS Code

Procure por **Sema Language Tools** e clique em instalar.

### Via VSIX

No repositorio principal da Sema:

```bash
npm run extensao:empacotar
npm run extensao:instalar-local
```

Ou manualmente:

```bash
code --install-extension .tmp/editor-vscode/sema-language-tools-0.1.1.vsix --force
```

## Fluxo recomendado

1. escreva ou abra um arquivo `.sema`
2. rode `Sema: Formatar Documento`
3. corrija os diagnosticos apontados pelo editor
4. feche o ciclo com a CLI:

```bash
sema validar modulo.sema --json
sema diagnosticos modulo.sema --json
sema verificar . --json
```

## Sobre a linguagem

A Sema nao quer substituir React, TypeScript ou Python.

Ela governa a camada de significado:

- contrato
- estado
- fluxo
- erros
- efeitos
- garantias

Ela funciona, antes de tudo, como linguagem de intencao. Ou seja: a implementacao concreta pode morar em outras stacks, mas o significado continua sendo governado pela Sema.

Esta extensao ajuda o editor a respeitar isso sem transformar sua tela numa planilha sem alma.

## Repositorio

- GitHub: [gerlanss/Sema](https://github.com/gerlanss/Sema)
- Issues: [github.com/gerlanss/Sema/issues](https://github.com/gerlanss/Sema/issues)

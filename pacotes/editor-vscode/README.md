# Sema Language Tools

Suporte de editor para o protocolo Sema, a camada semantica que governa contrato, fluxo, erro, efeito, garantia, vinculos e execucao acima da stack real.

Na implementacao, a Sema continua sendo uma linguagem de intencao. No editor, a extensao existe para fazer essa camada ficar util de verdade sem transformar o VS Code num circo pesado.

## Recursos

- associacao automatica de arquivos `.sema`
- destaque de sintaxe para os blocos centrais da linguagem
- snippets para `module`, `task`, `flow`, `route` e `state`
- comando `Sema: Formatar Documento`
- servidor de linguagem inicial com:
  - diagnosticos semanticos
  - hover basico
  - formatacao de documento
- integracao com a CLI da Sema

## O que a extensao resolve

- editar `.sema` com legibilidade
- detectar diagnosticos semanticos no editor
- formatar com o estilo canonico da linguagem
- trabalhar com a CLI local ou instalada no sistema

## Como a extensao encontra a CLI

1. `sema.cliPath`, se voce configurar manualmente
2. bin `sema` disponivel no sistema
3. `node_modules/.bin/sema` do projeto atual
4. CLI local do proprio repositorio da Sema

Se o comando `sema` funciona no terminal, a extensao quase sempre vai funcionar feliz tambem.

## Instalacao

### Via GitHub Release

Linux/macOS:

```bash
curl -L -o sema-language-tools.vsix https://github.com/gerlanss/Sema/releases/latest/download/sema-language-tools-latest.vsix
code --install-extension ./sema-language-tools.vsix --force
```

Windows PowerShell:

```powershell
Invoke-WebRequest -Uri https://github.com/gerlanss/Sema/releases/latest/download/sema-language-tools-latest.vsix -OutFile sema-language-tools.vsix
code --install-extension .\sema-language-tools.vsix --force
```

### Via VSIX local

No repositorio principal da Sema:

```bash
npm run extensao:empacotar
npm run extensao:instalar-local
```

Ou manualmente:

```bash
code --install-extension .tmp/editor-vscode/sema-language-tools-0.9.1.vsix --force
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

## Sobre a Sema

A Sema nao quer substituir React, TypeScript ou Python.

Ela governa a camada de significado:

- contrato
- estado
- fluxo
- erros
- efeitos
- garantias
- vinculos
- execucao

Repositorio: [gerlanss/Sema](https://github.com/gerlanss/Sema)

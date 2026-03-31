# Sema Language Tools

Suporte de editor para o protocolo **Sema**, a camada semântica que governa contrato, fluxo, erro, efeito e garantia acima da stack real.

Na implementação, a Sema continua sendo uma linguagem de intenção. No editor, a extensão existe para fazer essa camada semântica ficar útil de verdade, sem transformar o VS Code num circo pesado.

## Recursos

- associação automática de arquivos `.sema`
- destaque de sintaxe para os blocos centrais da linguagem
- snippets para `module`, `task`, `flow`, `route` e `state`
- comando `Sema: Formatar Documento`
- servidor de linguagem inicial com:
  - diagnósticos semânticos
  - hover básico
  - formatação de documento
- integracao com a CLI da Sema

## O que a extensao ja resolve

- editar `.sema` com legibilidade
- detectar diagnósticos semânticos no editor
- formatar com o estilo canônico da linguagem
- trabalhar com a CLI local ou instalada no sistema

## Como a extensao encontra a CLI

1. `sema.cliPath`, se voce configurar manualmente
2. bin `sema` disponivel no sistema
3. `node_modules/.bin/sema` do projeto atual
4. CLI local do proprio repositorio da Sema

Se o comando `sema` funciona no terminal, a extensao quase sempre vai funcionar feliz tambem.

## Instalacao

### Via GitHub Release, sem clonar o repo

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

Esse é o caminho oficial público hoje. Se a extensão for publicada na loja depois, ótimo; por enquanto a release do GitHub é a rota honesta e reproduzível.

### Via VSIX local

No repositorio principal da Sema:

```bash
npm run extensao:empacotar
npm run extensao:instalar-local
```

Ou manualmente:

```bash
code --install-extension .tmp/editor-vscode/sema-language-tools-0.8.4.vsix --force
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

Repositorio: [gerlanss/Sema](https://github.com/gerlanss/Sema)

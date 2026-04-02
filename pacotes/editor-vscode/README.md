# Sema Language Tools

Sema Language Tools e a extensao oficial do VS Code para a Sema, o protocolo semantico IA-first para contrato, fluxo, erro, efeito, garantia, vinculos, execucao e `drift` em backend vivo.

Ela nao existe para virar enfeite de sintaxe. Ela existe para deixar a camada semantica da Sema util no editor enquanto a CLI fecha o resto do fluxo.

## O que a extensao entrega

- associacao automatica de arquivos `.sema`
- destaque de sintaxe para os blocos centrais da linguagem
- snippets para `module`, `task`, `flow`, `route` e `state`
- hover basico para palavras-chave da linguagem
- diagnosticos semanticos no editor
- validacao com contexto de projeto, incluindo `use` cross-module
- formatacao de documento
- integracao com a CLI oficial da Sema

## O que ela nao tenta fazer sozinha

- substituir a CLI
- rodar scaffold completo
- fazer `drift`, `contexto-ia` e verificacao de projeto so pelo editor

O fluxo bom continua sendo: editor para escrever e revisar, CLI para validar, medir `drift`, gerar contexto para IA e compilar.

## Instale a extensao

GitHub Releases:

- [Baixar a VSIX mais recente](https://github.com/gerlanss/Sema/releases/latest/download/sema-language-tools-latest.vsix)
- [Abrir a pagina de releases da Sema](https://github.com/gerlanss/Sema/releases/latest)

Depois de baixar:

```bash
code --install-extension ./sema-language-tools-latest.vsix --force
```

Windows PowerShell:

```powershell
Invoke-WebRequest -Uri https://github.com/gerlanss/Sema/releases/latest/download/sema-language-tools-latest.vsix -OutFile sema-language-tools-latest.vsix
code --install-extension .\sema-language-tools-latest.vsix --force
```

## Instale a CLI da Sema

Para usar a Sema direito no projeto, instale tambem a CLI oficial:

```bash
npm install -g @semacode/cli
sema --help
sema doctor
```

Opcionalmente, voce tambem pode instalar pela release:

```bash
npm install -g https://github.com/gerlanss/Sema/releases/latest/download/sema-cli-latest.tgz
sema --help
sema doctor
```

Guia completo:

- [Instalacao e primeiro uso da Sema](https://github.com/gerlanss/Sema/blob/main/docs/instalacao-e-primeiro-uso.md)

## Primeiro fluxo recomendado

1. abra ou crie um arquivo `.sema`
2. use `Sema: Formatar Documento`
3. corrija os diagnosticos do editor
4. feche o ciclo com a CLI

```bash
sema validar contratos/pedidos.sema --json
sema diagnosticos contratos/pedidos.sema --json
sema drift contratos/pedidos.sema --json
sema contexto-ia contratos/pedidos.sema --saida ./.tmp/contexto-pedidos --json
```

## Como a extensao encontra a CLI

1. `sema.cliPath`, se voce configurar manualmente
2. CLI instalada para o usuario e resolvida pelo sistema
3. prefixo global do npm e `%APPDATA%\npm\sema.cmd` no Windows
4. `node_modules/.bin/sema` do projeto atual

Se `sema.cliPath` estiver preenchido, a extensao usa esse caminho como autoridade total e nao cai para a CLI do proprio projeto.

## Links diretos

- [Repositorio oficial](https://github.com/gerlanss/Sema)
- [README principal](https://github.com/gerlanss/Sema/blob/main/README.md)
- [Sintaxe da linguagem](https://github.com/gerlanss/Sema/blob/main/docs/sintaxe.md)
- [Integracao com IA](https://github.com/gerlanss/Sema/blob/main/docs/integracao-com-ia.md)
- [Issues](https://github.com/gerlanss/Sema/issues)

## Sobre a Sema

A Sema nao foi desenhada para ser human-first.

Ela foi desenhada para reduzir ambiguidade para IA em sistema real. O editor entra como apoio. A camada principal continua sendo a semantica explicita e o fluxo completo da CLI.

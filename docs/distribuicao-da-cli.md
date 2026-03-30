# Distribuicao da CLI da Sema

Este documento explica como distribuir a CLI da Sema fora do monorrepo sem vender fumaça.

## Modelo oficial agora

A trilha publica principal da Sema passa a ser:

1. baixar da GitHub Release
2. instalar o `.tgz`
3. rodar `sema`

O pacote da CLI tambem ja fica **pronto para npm registry**. A publicacao so depende de autenticacao da conta e do comando de publish.

Instalacao sem clone em Linux, Windows PowerShell e macOS:

```bash
npm install -g https://github.com/gerlanss/Sema/releases/latest/download/sema-cli-latest.tgz
sema --help
sema doctor
```

Instaladores auxiliares:

- Linux/macOS: `curl -fsSL https://raw.githubusercontent.com/gerlanss/Sema/main/install-sema.sh | bash`
- Windows PowerShell: `irm https://raw.githubusercontent.com/gerlanss/Sema/main/install-sema.ps1 | iex`

Instalacao local ao projeto:

```bash
npm install https://github.com/gerlanss/Sema/releases/latest/download/sema-cli-latest.tgz
npx sema --help
```

Cada release publica entrega:

- `sema-cli-<versao>.tgz`
- `sema-cli-latest.tgz`
- `sema-language-tools-<versao>.vsix`
- `sema-language-tools-latest.vsix`
- `install-sema.sh`
- `install-sema.ps1`

## Fluxo pronto para npm

Dry-run de publicacao:

```bash
npm run cli:publicar-npm-dry-run
```

Publicacao real:

```bash
npm run cli:publicar-npm
```

Notas importantes:

- o pacote preparado para npm continua sendo `@sema/cli`
- o script publica o tarball gerado em `.tmp/pacotes-publicos`
- a conta desta maquina precisa estar autenticada com `npm adduser` ou `npm login`
- o package name `@sema/cli` hoje nao aparece publicado no registry, entao a trilha esta pronta sem colisao obvia de nome

## O que esse pacote resolve

O tarball publico agora carrega os pacotes internos de runtime junto, sem depender de `file:` quebrado no `package.json`.

Traduzindo sem perfume: ele foi feito para funcionar fora do monorrepo, e nao so para parecer empacotavel no papel.

## Como validar o pacote

Teste automatizado:

```bash
npm run cli:testar-pacote-publico
```

Esse smoke:

- empacota a CLI
- instala o tarball em diretorio temporario limpo
- roda `sema --help`
- roda `sema validar` contra um `.sema` real do repo
- falha se o tarball ainda carregar dependencia `file:`

Se voce quiser validar tambem a trilha de npm sem publicar de verdade, use o dry-run acima.

## Como a release e publicada

O workflow [release-publica.yml](../.github/workflows/release-publica.yml) faz o seguinte:

1. valida alinhamento de versao publica
2. roda `npm run project:check`
3. empacota a CLI publica
4. empacota a extensao VS Code
5. publica os artefatos versionados e os aliases `latest`

## Fluxos que continuam existindo

### Uso direto do repositorio

Bom para contribuir e desenvolver a ferramenta:

```bash
npm install
npm run build
node pacotes/cli/dist/index.js validar exemplos/calculadora.sema
```

### Instalacao local por `npm link`

Bom para quem esta mexendo no proprio repo da Sema:

```bash
npm run cli:instalar-local
```

Isto continua util, mas agora e **fluxo de desenvolvimento**, nao distribuicao publica principal.

### Empacotamento antigo de workspace

O comando abaixo continua existindo:

```bash
npm run cli:empacotar
```

Ele passa a ser tratado como **empacotamento interno/dev**, bom para inspecao rapida de workspace, nao como narrativa oficial de distribuicao.

## O que ainda nao entra nesta rodada

- publicacao oficial em registry publico
- instalador multiplataforma dedicado
- updater automatico
- runtime web acoplado

## Regra pratica

Se a pessoa quer **usar** a Sema, entregue o `.tgz` publico.

Se a pessoa quer **desenvolver** a Sema, use o monorrepo.

Misturar os dois fluxos era justamente a origem da experiencia meio capenga que esse ciclo corrigiu.

# Distribuição da CLI da Sema

Este documento explica como distribuir a CLI da Sema fora do monorrepo sem vender fumaça.

## Modelo oficial agora

A trilha pública principal da Sema passa a ser:

1. instalar `@semacode/cli` pelo npm
2. rodar `sema`
3. usar a GitHub Release só como canal alternativo com tarball estável

O pacote da CLI já está **publicado no npm registry** como `@semacode/cli`.

Se você precisa anunciar a release sem ficar improvisando texto em cima da hora, use também o [kit de lançamento público](./kit-lancamento-publico.md).

Instalação sem clone em Linux, Windows PowerShell e macOS:

```bash
npm install -g @semacode/cli
sema --help
sema doctor
```

Instalação via GitHub Release:

```bash
npm install -g https://github.com/gerlanss/Sema/releases/latest/download/sema-cli-latest.tgz
sema --help
sema doctor
```

Instaladores auxiliares:

- Linux/macOS: `curl -fsSL https://raw.githubusercontent.com/gerlanss/Sema/main/install-sema.sh | bash`
- Windows PowerShell: `irm https://raw.githubusercontent.com/gerlanss/Sema/main/install-sema.ps1 | iex`

Instalação local ao projeto:

```bash
npm install @semacode/cli
npx sema --help
```

Cada release pública entrega:

- `sema-cli-<versao>.tgz`
- `sema-cli-latest.tgz`
- `sema-language-tools-<versao>.vsix`
- `sema-language-tools-latest.vsix`
- `install-sema.sh`
- `install-sema.ps1`

## Fluxo pronto para npm

Dry-run de publicação:

```bash
npm run cli:publicar-npm-dry-run
```

Publicação real:

```bash
npm run cli:publicar-npm
```

Notas importantes:

- o pacote público da CLI é `@semacode/cli`
- o script publica o tarball gerado em `.tmp/pacotes-publicos`
- a conta desta máquina precisa estar autenticada com `npm adduser` ou `npm login`
- o package name público passa a ser `@semacode/cli`, publicado no scope da organização `semacode`

## O que esse pacote resolve

O tarball público agora carrega os pacotes internos de runtime junto, sem depender de `file:` quebrado no `package.json`.

Traduzindo sem perfume: ele foi feito para funcionar fora do monorrepo, e não só para parecer empacotável no papel.

## Como validar o pacote

Teste automatizado:

```bash
npm run cli:testar-pacote-publico
```

Esse smoke:

- empacota a CLI
- instala o tarball em diretório temporário limpo
- roda `sema --help`
- roda `sema validar` contra um `.sema` real do repo
- falha se o tarball ainda carregar dependência `file:`

Se você quiser validar também a trilha de npm sem publicar de verdade, use o dry-run acima.

## Como a release é publicada

O workflow [release-publica.yml](../.github/workflows/release-publica.yml) faz o seguinte:

1. valida alinhamento de versão pública
2. roda `npm run project:check`
3. empacota a CLI pública
4. empacota a extensão VS Code
5. publica os artefatos versionados e os aliases `latest`

## Fluxos que continuam existindo

### Uso direto do repositório

Bom para contribuir e desenvolver a ferramenta:

```bash
npm install
npm run build
node pacotes/cli/dist/index.js validar exemplos/calculadora.sema
```

### Instalação local por `npm link`

Bom para quem está mexendo no próprio repo da Sema:

```bash
npm run cli:instalar-local
```

Isto continua útil, mas agora é **fluxo de desenvolvimento**, não distribuição pública principal.

### Empacotamento antigo de workspace

O comando abaixo continua existindo:

```bash
npm run cli:empacotar
```

Ele passa a ser tratado como **empacotamento interno/dev**, bom para inspeção rápida de workspace, não como narrativa oficial de distribuição.

## O que ainda não entra nesta rodada

- instalador multiplataforma dedicado
- updater automático
- runtime web acoplado

## Regra prática

Se a pessoa quer **usar** a Sema, entregue `npm install -g @semacode/cli`.

Se a pessoa prefere pacote fechado ou está com algum problema no registry, entregue o `.tgz` público da release.

Se a pessoa quer **desenvolver** a Sema, use o monorrepo.

Misturar os dois fluxos era justamente a origem da experiência meio capenga que esse ciclo corrigiu.

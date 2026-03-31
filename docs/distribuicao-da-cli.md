# Distribuicao da CLI da Sema

Este documento explica como distribuir a CLI da Sema fora do monorrepo sem vender fumaça.

## Modelo oficial

A trilha publica principal da Sema e:

1. instalar `@semacode/cli` pelo npm
2. rodar `sema`
3. usar a GitHub Release como canal alternativo com tarball estavel

Instalacao oficial:

```bash
npm install -g @semacode/cli
sema --help
sema doctor
```

Instalacao via GitHub Release:

```bash
npm install -g https://github.com/gerlanss/Sema/releases/latest/download/sema-cli-latest.tgz
sema --help
sema doctor
```

Instalacao local ao projeto:

```bash
npm install @semacode/cli
npx sema --help
```

## Artefatos publicos por release

Cada release publica entrega:

- `sema-cli-0.9.0.tgz`
- `sema-cli-latest.tgz`
- `sema-language-tools-0.9.0.vsix`
- `sema-language-tools-latest.vsix`
- `install-sema.sh`
- `install-sema.ps1`

## Fluxo pronto para npm

Dry-run:

```bash
npm run cli:publicar-npm-dry-run
```

Publicacao real:

```bash
npm run cli:publicar-npm
```

Notas importantes:

- o pacote publico da CLI e `@semacode/cli`
- a conta da maquina precisa estar autenticada com `npm login`
- o script publica o tarball gerado em `.tmp/pacotes-publicos`

## Como validar o pacote

Smoke automatizado:

```bash
npm run cli:testar-pacote-publico
```

Esse smoke:

- empacota a CLI publica
- instala o tarball em diretorio temporario limpo
- roda `sema --help`
- roda `sema validar` contra um `.sema` real
- falha se sobrar dependencia `file:` quebrada

## Como a release e publicada

O workflow [release-publica.yml](../.github/workflows/release-publica.yml) faz:

1. validar alinhamento de versao publica
2. rodar `npm run project:check`
3. empacotar a CLI publica
4. empacotar a extensao VS Code
5. publicar os artefatos versionados e os aliases `latest`

## Fluxos que continuam existindo

### Uso direto do repositorio

Bom para contribuir:

```bash
npm install
npm run build
node pacotes/cli/dist/index.js validar exemplos/calculadora.sema
```

### Instalacao local por `npm link`

Bom para quem esta mexendo no proprio repo:

```bash
npm run cli:instalar-local
```

Isso continua util, mas e fluxo de desenvolvimento, nao de distribuicao publica.

### Empacotamento de workspace

O comando abaixo continua existindo:

```bash
npm run cli:empacotar
```

Ele e bom para inspeção interna, nao para a narrativa publica principal.

## Regra pratica

Se a pessoa quer usar a Sema, entregue `npm install -g @semacode/cli`.

Se a pessoa prefere pacote fechado ou esta com problema no registry, entregue o `.tgz` da GitHub Release.

Se a pessoa quer desenvolver a Sema, use o monorrepo.

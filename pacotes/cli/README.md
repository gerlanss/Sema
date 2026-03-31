# Sema CLI

Sema e um Protocolo de Governanca de Intencao para IA e backend vivo.

Este pacote entrega a CLI oficial para:

- validar contratos `.sema`
- inspecionar projeto
- medir `drift` entre contrato e codigo vivo
- importar legado
- preparar contexto para IA

## Instalacao pelo npm registry

```bash
npm install -g @semacode/cli
sema --help
```

## Instalacao via tarball da release

```bash
npm install -g ./{{TGZ_ARQUIVO}}
```

Ou direto da GitHub Release:

```bash
npm install -g https://github.com/gerlanss/Sema/releases/latest/download/sema-cli-latest.tgz
```

## Instalacao local ao projeto

```bash
npm install @semacode/cli
npx sema --help
```

Ou, se voce estiver testando um tarball local:

```bash
npm install ./{{TGZ_ARQUIVO}}
npx sema --help
```

## Primeiro teste

```bash
mkdir sema-demo
cd sema-demo
sema iniciar
sema validar contratos/pedidos.sema --json
sema starter-ia
```

Repositorio: https://github.com/gerlanss/Sema

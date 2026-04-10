# Instalacao e Primeiro Uso

Este guia cobre o caminho publico atual da Sema para CLI, MCP e extensao.

## Requisitos

- Node.js LTS
- npm funcional
- Python 3 so se voce quiser rodar testes Python gerados

## CLI

Instalacao principal:

```bash
npm install -g @semacode/cli
sema --help
sema doctor
```

Instalacao por release:

```bash
npm install -g https://github.com/gerlanss/Sema/releases/latest/download/sema-cli-latest.tgz
```

Instalacao local ao projeto:

```bash
npm install @semacode/cli
npx sema --help
```

## MCP

Se voce usa cliente MCP:

```bash
npm install -g @semacode/mcp
sema-mcp
```

Ou sem instalar:

```bash
npx -y @semacode/mcp
```

## Instaladores oficiais

Linux ou macOS:

```bash
curl -fsSL https://raw.githubusercontent.com/gerlanss/Sema/v1.4.0/install-sema.sh | bash
curl -fsSL https://raw.githubusercontent.com/gerlanss/Sema/v1.4.0/install-sema.sh | bash -s -- --with-vscode --with-mcp
```

Windows PowerShell:

```powershell
Invoke-WebRequest -Uri https://raw.githubusercontent.com/gerlanss/Sema/v1.4.0/install-sema.ps1 -OutFile install-sema.ps1
.\install-sema.ps1 -WithVSCode -WithMcp -Version 1.4.0
```

Se quiser outra tag, troque `v1.4.0` pelo release desejado.

## Extensao VS Code

```bash
curl -L -o sema-language-tools.vsix https://github.com/gerlanss/Sema/releases/latest/download/sema-language-tools-latest.vsix
code --install-extension ./sema-language-tools.vsix --force
```

Ou baixe a VSIX antes e instale localmente.

## Primeiro teste

```bash
mkdir sema-demo
cd sema-demo
sema iniciar
sema validar contratos/pedidos.sema --json
```

## Primeiro fluxo util

```bash
sema validar contratos/pedidos.sema --json
sema ir contratos/pedidos.sema --json
sema formatar contratos/pedidos.sema
sema verificar contratos --saida ./.tmp/verificacao
```

## Primeiro fluxo IA-first

```bash
sema inspecionar . --json
sema resumo contratos/pedidos.sema --micro --para onboarding
sema drift contratos/pedidos.sema --json
sema contexto-ia contratos/pedidos.sema --saida ./.tmp/contexto --json
```

## Primeiro fluxo de persistencia vendor-first

```bash
sema validar contratos/sema/persistencia_vendor_first.sema --json
sema ir contratos/sema/persistencia_vendor_first.sema --json
```

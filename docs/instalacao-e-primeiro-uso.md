# Instalacao e Primeiro Uso

Este guia mostra o caminho mais curto para testar a Sema do jeito certo, sem misturar fluxo de usuario com gambiarra de contribuinte.

## Requisitos

- Node.js instalado
- npm funcionando
- Python 3 e `pytest` se voce quiser rodar o fluxo completo de testes Python gerados

O repositorio so e necessario se voce quiser contribuir na Sema, rodar o showcase oficial localmente ou empacotar release.

## Caminho oficial

Instalacao via npm:

```bash
npm install -g @semacode/cli
sema --help
sema doctor
```

Se preferir o tarball oficial da GitHub Release:

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

Instaladores auxiliares para a linha publica atual:

- Linux/macOS: `curl -fsSL https://raw.githubusercontent.com/gerlanss/Sema/v1.2.0/install-sema.sh | bash`
- Windows PowerShell: `irm https://raw.githubusercontent.com/gerlanss/Sema/v1.2.0/install-sema.ps1 | iex`

Se voce quiser reproducao estrita, prefira o npm registry ou o tarball da GitHub Release.

## Primeiro teste sem clonar o repo

```bash
mkdir sema-demo
cd sema-demo
sema iniciar
sema validar contratos/pedidos.sema --json
sema compilar contratos/pedidos.sema --alvo lua --saida ./saida/lua
```

## Primeiro fluxo util

```bash
sema validar contratos/pedidos.sema --json
sema ast contratos/pedidos.sema --json
sema ir contratos/pedidos.sema --json
sema formatar contratos/pedidos.sema
sema verificar contratos --saida ./.tmp/verificacao
```

## Primeiro fluxo de IA real

Sem clonar o repo, o fluxo que mais mostra a proposta da Sema hoje e:

```bash
sema inspecionar . --json
sema resumo contratos/pedidos.sema --micro --para mudanca
sema drift contratos/pedidos.sema --json
sema contexto-ia contratos/pedidos.sema --saida ./.tmp/contexto-pedidos --json
```

Esse fluxo mostra:

- base de projeto resolvida
- cartao semantico curto para IA pequena ou gratuita
- codigo vivo detectado
- `impl` e `vinculos` resolvidos
- score, confianca e lacunas do `drift`
- `briefing.min.json` e `briefing.json` para IA antes da edicao

## `sema.config.json`

Exemplo de configuracao para projeto real:

```json
{
  "origens": ["./contratos"],
  "saida": "./generated",
  "alvos": ["typescript", "python"],
  "alvoPadrao": "typescript",
  "estruturaSaida": "backend",
  "framework": "nestjs",
  "modoEstrito": true,
  "diretoriosSaidaPorAlvo": {
    "typescript": "./generated/nestjs",
    "python": "./generated/fastapi"
  },
  "convencoesGeracaoPorProjeto": "backend"
}
```

## Gerar codigo

Scaffold base:

```bash
sema compilar contratos/pedidos.sema --alvo typescript --saida ./saida/typescript
sema compilar contratos/pedidos.sema --alvo python --saida ./saida/python
sema compilar contratos/pedidos.sema --alvo dart --saida ./saida/dart
sema compilar contratos/pedidos.sema --alvo lua --saida ./saida/lua
```

Scaffold backend:

```bash
sema compilar contratos/pedidos.sema --alvo typescript --framework nestjs --estrutura backend --saida ./generated/nestjs
sema compilar contratos/pedidos.sema --alvo python --framework fastapi --estrutura backend --saida ./generated/fastapi
```

## Extensao VS Code

Via GitHub Release:

```bash
curl -L -o sema-language-tools.vsix https://github.com/gerlanss/Sema/releases/latest/download/sema-language-tools-latest.vsix
code --install-extension ./sema-language-tools.vsix --force
```

Windows PowerShell:

```powershell
Invoke-WebRequest -Uri https://github.com/gerlanss/Sema/releases/latest/download/sema-language-tools-latest.vsix -OutFile sema-language-tools.vsix
code --install-extension .\sema-language-tools.vsix --force
```

Pagina oficial:

- [https://github.com/gerlanss/Sema/releases/latest](https://github.com/gerlanss/Sema/releases/latest)

Se voce estiver desenvolvendo a propria extensao localmente, ai sim entra a trilha de contribuinte:

```bash
npm run extensao:empacotar
npm run extensao:instalar-local
```

## Caminho de contribuinte

Se o objetivo for desenvolver a propria Sema:

```bash
npm install
npm run build
npm run cli:instalar-local
sema validar exemplos/calculadora.sema
```

Se quiser validar tudo de cara:

```bash
npm run project:check
```

## `npm link` continua existindo

Esse fluxo continua util, mas e trilha de contribuinte:

```powershell
npm run cli:instalar-local
```

Serve para:

- testar a experiencia de terminal no proprio ambiente
- desenvolver a CLI
- usar `sema` como interface principal mesmo durante o desenvolvimento local

Para remover:

```powershell
npm run cli:desinstalar-local
```

## Resumo honesto

Hoje o jeito certo de testar a Sema e:

1. instalar a CLI pelo npm ou pela GitHub Release
2. rodar `sema iniciar`
3. validar `contratos/pedidos.sema`
4. usar `inspecionar -> resumo -> drift -> contexto-ia` quando o projeto for vivo
5. ler `briefing.min.json` ou `briefing.json` antes de mandar a IA sair cavando arquivo

Clone + build + `npm link` continua bom para oficina, nao para landing page publica.

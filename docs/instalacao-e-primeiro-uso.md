# Instalacao e Primeiro Uso

Este guia mostra o caminho mais curto para testar a Sema do jeito certo, sem cair naquela confusao classica de "instalei a linguagem" quando, na verdade, voce so linkou uma CLI local de desenvolvimento.

## Requisitos

- Node.js instalado
- npm funcionando
- o repositorio so e necessario se voce quiser contribuir no Sema ou rodar o showcase oficial local

Para o fluxo completo com testes Python gerados:

- Python 3
- `pytest` instalado

## Caminho oficial: instalar da release publica

Voce nao precisa clonar o repo para usar a CLI.

Linux, Windows PowerShell e macOS:

```bash
npm install -g https://github.com/gerlanss/Sema/releases/latest/download/sema-cli-latest.tgz
sema --help
sema doctor
```

Se quiser um caminho ainda mais mastigado:

- Linux/macOS: `curl -fsSL https://raw.githubusercontent.com/gerlanss/Sema/main/install-sema.sh | bash`
- Windows PowerShell: `irm https://raw.githubusercontent.com/gerlanss/Sema/main/install-sema.ps1 | iex`

Se preferir instalar local ao projeto:

```bash
npm install https://github.com/gerlanss/Sema/releases/latest/download/sema-cli-latest.tgz
npx sema --help
```

Primeiro teste sem clonar o repo:

```bash
mkdir sema-demo
cd sema-demo
sema iniciar
sema validar contratos/pedidos.sema --json
```

## Caminho de contribuinte: usar direto do repo

Se o objetivo for desenvolver o proprio Sema:

```bash
npm install
npm run build
node pacotes/cli/dist/index.js validar exemplos/calculadora.sema
```

Se quiser validar tudo de cara:

```bash
npm run project:check
```

## `npm link` virou trilha de desenvolvimento

O fluxo abaixo continua existindo, mas agora e assumidamente fluxo de contribuinte, nao trilha publica principal:

```powershell
npm run cli:instalar-local
```

Ele serve para:

- testar a experiencia de terminal no proprio ambiente
- desenvolver a CLI
- evitar ficar chamando `node pacotes/cli/dist/index.js`

Para remover:

```powershell
npm run cli:desinstalar-local
```

## Primeiro fluxo util

```bash
sema validar contratos/pedidos.sema --json
sema ast contratos/pedidos.sema --json
sema ir contratos/pedidos.sema --json
sema formatar contratos/pedidos.sema
sema verificar contratos --saida ./.tmp/verificacao
```

## Primeiro fluxo de valor real

Se quiser testar a Sema onde ela fica mais forte hoje, use o showcase oficial dentro do repo:

```bash
cd showcases/ranking-showroom
sema inspecionar . --json
sema drift contratos/ranking_showroom.sema --json
sema contexto-ia contratos/ranking_showroom.sema --saida ./.tmp/contexto-ranking --json
```

Esse fluxo mostra:

- base de projeto resolvida
- codigo vivo detectado
- `impl` resolvido
- rota Flask validada
- pacote de contexto para IA

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
sema compilar exemplos/calculadora.sema --alvo typescript --saida ./saida/typescript
sema compilar exemplos/calculadora.sema --alvo python --saida ./saida/python
sema compilar exemplos/calculadora.sema --alvo dart --saida ./saida/dart
```

Scaffold backend:

```bash
sema compilar contratos/pedidos.sema --alvo typescript --framework nestjs --estrutura backend --saida ./generated/nestjs
sema compilar contratos/pagamentos.sema --alvo python --framework fastapi --estrutura backend --saida ./generated/fastapi
```

## Extensao VS Code

Empacotar:

```bash
npm run extensao:empacotar
```

Instalar localmente:

```bash
npm run extensao:instalar-local
```

Ou manualmente:

```bash
code --install-extension .tmp/editor-vscode/sema-language-tools-0.8.8.vsix --force
```

## Resumo honesto

Hoje o jeito certo de testar a Sema e:

1. instalar a CLI da release publica
2. rodar `sema iniciar`
3. validar `contratos/pedidos.sema`
4. rodar `sema doctor` se o ambiente estiver de sacanagem
5. abrir o showcase oficial se quiser ver backend vivo

Clone + build + `npm link` continua util, mas agora e fluxo de oficina, nao vitrine.

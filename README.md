# Sema

![Logo da Sema](./logo.png)

Sema é um **Protocolo de Governança de Intenção para IA e backend vivo**.

Ele não tenta substituir TypeScript, Python, Dart, Flask, FastAPI ou NestJS. A proposta é mais útil do que isso: governar a camada de significado acima da stack, com contrato explícito, fluxo, erro, efeito, garantia, `impl`, `drift` e contexto operacional para IA.

Tecnicamente, a Sema continua sendo uma **linguagem de intenção**. Publicamente, o posicionamento fica mais honesto: ela é o protocolo que ajuda IA e humano a editar sistema vivo com menos adivinhação e mais verificação.

## O que a Sema é, e o que ela não é

Para evitar leitura torta, aqui vai sem perfume:

- a Sema **é** um protocolo de governança semântica para contrato, intenção, fluxo, erro, efeito, garantia e vínculo com código vivo
- a Sema **é** uma camada acima da stack para reduzir ambiguidade entre runtime, contrato, documentação e IA
- a Sema **não é** gerador messiânico de sistema completo
- a Sema **não é** substituta de decisão arquitetural
- a Sema **não é** telepatia de regra de negócio

Em termos práticos:

- `importar` serve para bootstrap revisável, não para contrato final automático
- `impl` serve para ligar contrato a símbolo vivo, não para fingir que o runtime se explica sozinho
- `drift` serve para medir verdade contra código real, não para decorar o projeto com JSON bonito
- `contexto-ia` serve para preparar uma IA para editar com menos chute, não para terceirizar pensamento

## O que ela entrega

- contrato semântico explícito para operações, bordas HTTP, erros, efeitos e garantias
- vínculo com implementação real via `impl`
- medição de divergência real entre contrato e código vivo via `drift`
- importação incremental de legado
- contexto acionável para IA antes de editar projeto real

## O problema que resolve

Em projeto vivo, a verdade costuma ficar espalhada:

- contrato numa ponta
- DTO em outra
- comentário vencido no canto
- framework escondendo regra no meio do handler
- IA adivinhando símbolo e fluxo como se fosse paranormal

A Sema junta isso num ponto governável:

- intenção da operação
- contrato de entrada e saída
- regras obrigatórias
- efeitos operacionais
- erros esperados
- garantias finais
- fluxo e estado do domínio
- vínculo com implementação real via `impl`
- divergência real entre contrato e código vivo via `drift`

Não é só “mais uma DSL”. É uma camada semântica para governar o que a stack costuma deixar espalhado, opaco ou velho.

## Quickstart em 2 minutos

Hoje você **não precisa clonar o repo** para instalar a CLI. A instalação oficial agora é pelo pacote npm `@semacode/cli`.

Linux, Windows PowerShell e macOS:

```bash
npm install -g @semacode/cli
mkdir sema-demo
cd sema-demo
sema iniciar
sema validar contratos/pedidos.sema --json
sema doctor
```

Se quiser instalar local ao projeto:

```bash
npm install @semacode/cli
npx sema --help
```

Se você prefere instalar pela GitHub Release com tarball estável:

```bash
npm install -g https://github.com/gerlanss/Sema/releases/latest/download/sema-cli-latest.tgz
sema --help
```

Se depois você quiser ver a Sema em backend vivo, aí sim entre no repo e rode o case oficial:

```bash
cd showcases/ranking-showroom
sema inspecionar . --json
sema drift contratos/ranking_showroom.sema --json
```

## Case oficial

O case oficial da Sema agora é [showcases/ranking-showroom](./showcases/ranking-showroom/).

Ele mostra, num backend Flask pequeno e real:

- contrato semântico curado
- `impl` apontando para símbolos vivos
- `drift` sem falso positivo idiota
- `contexto-ia` com `drift.json`
- adoção incremental sem reescrever a stack

Se você quer entender por que isso é mais útil do que `OpenAPI + DTO + comentário espalhado`, esse showcase foi feito exatamente para isso.

## Compatibilidade atual honesta

- `NestJS`: importacao de rotas + `drift` de rota publica
- `FastAPI`: importacao de rotas + `drift` de rota publica
- `Flask`: importacao de rotas + `drift` de rota publica com `Blueprint`, `url_prefix` e `@app.route`/`@bp.route`
- `Next.js App Router`: importacao de rotas + `drift` de rota publica por `route.ts`, incluindo segmentos dinamicos e bootstrap melhor de `params/query/body/status/response`
- `ASP.NET Core`: importacao de controllers e Minimal API + `drift` de rota publica via `cs:`
- `Spring Boot`: importacao de controllers + `drift` de rota publica via `java:`
- `Go net/http + Gin`: importacao de handlers + `drift` de rota publica via `go:`
- `Rust Axum`: importacao de handlers + `drift` de rota publica via `rust:`
- `Node/Firebase worker`: importacao focada em bridge + `drift` de rota worker e recurso persistido
- `C++ bridge/service`: importacao generica + `drift` de simbolo via `cpp:`
- `TypeScript`, `Python`, `Dart`: resolucao de simbolo e importacao generica

Observação importante: `flask`, `nextjs`, `firebase`, `dotnet`, `java`, `go`, `rust` e `cpp` entram como **fontes legado** para `importar` e `drift`; eles não viram frameworks novos de geração. A geração continua `base`, `nestjs` e `fastapi`, enquanto as outras famílias entram via starter e adoção incremental.

Outra observação importante: a compatibilidade pública agora explicita também o **nível de genericidade** de cada família. Em bom português:

- `framework slice oficial`: cobrimos um recorte concreto do framework, com promessa clara e `drift` da borda principal
- `generic backend`: cobrimos simbolo, bridge, service ou recurso vivo, sem vender a mentira de que todo framework daquela linguagem ja esta coberto
- `consumer bridge oficial`: cobrimos o lado consumidor com bridge formal e contexto de IA acionavel
- `inventariado`: a familia esta mapeada, mas ainda nao virou compromisso first-class

Para a régua oficial por família de stack, benchmarks reais e critério de nota `9/10`, veja [docs/scorecard-compatibilidade.md](./docs/scorecard-compatibilidade.md).

## Backend-first em 30 segundos

Hoje a Sema já faz bem estas coisas:

- modela dominio, contrato, borda publica, erro, garantia, efeito e fluxo
- gera scaffold base para TypeScript, Python e Dart
- gera scaffold orientado a framework para NestJS e FastAPI
- organiza projeto via `sema.config.json`
- resolve contexto de projeto mesmo sem `sema.config.json`, inclusive quando a entrada vem da raiz, da pasta `sema/` ou de um arquivo `.sema`
- resolve `use` em multiplas origens de projeto
- cobre `Next.js App Router` e `Node/Firebase worker` como familias de legado de primeira classe para criacao incremental e edicao
- cobre `ASP.NET Core`, `Spring Boot`, `Go net/http + Gin`, `Rust Axum` e `C++ bridge/service` como familias backend first-class para importacao e edicao
- vincula `task` a implementacao real via `impl`, inclusive em Python com simbolos internos quando eles forem declarados explicitamente
- ajuda IA e humanos a editar backend sem virar pantano semantico

Fluxo recomendado:

1. importar ou curar o contrato
2. lapidar a intencao
3. ligar `impl`
4. rodar `sema inspecionar`
5. rodar `sema drift`
6. usar `sema contexto-ia` antes de editar

Se quiser instalar sem decorar a novela toda:

- Linux/macOS: `curl -fsSL https://raw.githubusercontent.com/gerlanss/Sema/main/install-sema.sh | bash`
- Windows PowerShell: `irm https://raw.githubusercontent.com/gerlanss/Sema/main/install-sema.ps1 | iex`

## Distribuição pública

Hoje a distribuição pública da Sema fica assim:

- npm como canal oficial de instalacao via `@semacode/cli`
- GitHub Release como canal alternativo com tarball estavel
- tarball da CLI instalavel sem clone
- VSIX da extensao para VS Code

Para a trilha de distribuicao e publicacao, veja [docs/distribuicao-da-cli.md](./docs/distribuicao-da-cli.md).

Para texto de anúncio, release note curta, pitch e checklist de lançamento, veja [docs/kit-lancamento-publico.md](./docs/kit-lancamento-publico.md).

## Exemplo rapido

```sema
module exemplos.calculadora {
  task somar {
    input {
      a: Numero required
      b: Numero required
    }
    output {
      resultado: Numero
    }
    guarantees {
      resultado existe
    }
    tests {
      caso "soma basica" {
        given {
          a: 2
          b: 3
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }
}
```

## Configuracao de projeto

A Sema usa `sema.config.json` para tratar projeto real com menos adivinhacao.

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

Na pratica:

- `origens` controla onde a CLI procura `.sema`
- `diretoriosCodigo` ajuda a localizar implementacao viva
- `fontesLegado` orienta `importar` e `drift`
- `framework`, `estruturaSaida` e `alvos` deixam scaffold previsivel
- `sema doctor` ajuda a detectar se o ambiente esta pronto ou so te trollando

## Documentacao principal

- [STATUS.md](./STATUS.md)
- [docs/backend-first.md](./docs/backend-first.md)
- [docs/scorecard-compatibilidade.md](./docs/scorecard-compatibilidade.md)
- [docs/inventario-benchmark-local.md](./docs/inventario-benchmark-local.md)
- [docs/arquitetura.md](./docs/arquitetura.md)
- [docs/roadmap.md](./docs/roadmap.md)
- [docs/instalacao-e-primeiro-uso.md](./docs/instalacao-e-primeiro-uso.md)
- [docs/cli.md](./docs/cli.md)
- [docs/integracao-com-ia.md](./docs/integracao-com-ia.md)
- [docs/distribuicao-da-cli.md](./docs/distribuicao-da-cli.md)
- [docs/kit-lancamento-publico.md](./docs/kit-lancamento-publico.md)
- [docs/da-sema-para-codigo.md](./docs/da-sema-para-codigo.md)
- [docs/importacao-legado.md](./docs/importacao-legado.md)
- [docs/feedback-futebot.md](./docs/feedback-futebot.md)
- [docs/adocao-nestjs-existente.md](./docs/adocao-nestjs-existente.md)
- [docs/adocao-fastapi-existente.md](./docs/adocao-fastapi-existente.md)
- [docs/nestjs-prisma-sema.md](./docs/nestjs-prisma-sema.md)
- [docs/pagamento-ponta-a-ponta.md](./docs/pagamento-ponta-a-ponta.md)
- [docs/AGENT_STARTER.md](./docs/AGENT_STARTER.md)
- [docs/prompt-base-ia-sema.md](./docs/prompt-base-ia-sema.md)

## Extensão VS Code

A extensão da Sema para VS Code já tem:

- associacao automatica de `.sema`
- highlight de sintaxe
- snippets
- comando `Sema: Formatar Documento`
- servidor de linguagem com diagnosticos semanticos
- hover basico
- formatacao via servidor e via CLI

Para instalar pela release publica sem clonar:

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

Se voce estiver desenvolvendo o proprio repo, ainda pode empacotar localmente:

```bash
npm run extensao:empacotar
```

Pacote gerado:

- `.tmp/editor-vscode/sema-language-tools-0.8.6.vsix`

Para instalar localmente:

```bash
npm run extensao:instalar-local
```

Ou manualmente:

```bash
code --install-extension .tmp/editor-vscode/sema-language-tools-0.8.6.vsix --force
```

## Observação honesta

A Sema já deixou de ser só "documentação premium", mas ainda seria papo furado vender como "backend inteiro pronto sem tocar em nada". O valor real dela hoje está em:

- protocolo semantico
- scaffold util
- adocao incremental
- governanca de contrato vs codigo vivo
- ergonomia para IA operar sistema real sem sair chutando parede

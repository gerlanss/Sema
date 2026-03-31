# Kit de Lançamento Público

Este documento deixa a Sema pronta para ser apresentada sem enrolação e sem papo de release feita nas coxas.

Use este kit como base para:

- anúncio em GitHub, LinkedIn e X
- release note curta
- post de showcase
- checklist de lançamento em 24h

## Posicionamento em 1 frase

Sema é um **Protocolo de Governança de Intenção para IA e backend vivo**.

## Pitch curto

Sema ajuda a transformar contrato implícito em contrato verificável.

Ela governa intenção, borda HTTP, erro, efeito, garantia, `impl`, `drift` e contexto para IA acima da stack, sem pedir reescrita burra do projeto existente.

## Pitch médio

Em sistema vivo, a verdade costuma ficar espalhada entre handler, DTO, comentário vencido, regra de framework e service escondido.

A Sema junta isso numa camada semântica governável:

- contrato explícito
- fluxo e garantia
- vínculo com implementação real via `impl`
- divergência real entre contrato e código vivo via `drift`
- contexto acionável para IA antes de editar

Ela não tenta substituir `TypeScript`, `Python`, `Flask`, `FastAPI`, `NestJS` ou `Next.js`.

Ela entra acima disso para impedir humano e IA de mexerem em backend vivo no escuro feito dois malucos confiantes demais.

## Prova de valor em 3 linhas

- `Flask`: contrato + `impl.py` + `drift` verde em backend real
- `Next.js App Router`: importação incremental e `drift` de rota pública sem falso positivo idiota
- `contexto-ia`: AST, IR, diagnósticos e `drift.json` para agente editar com menos adivinhação

## CTA oficial atual

Hoje o CTA principal passa a ser npm:

```bash
npm install -g @semacode/cli
sema --help
sema doctor
```

CTA alternativo por GitHub Release:

```bash
npm install -g https://github.com/gerlanss/Sema/releases/latest/download/sema-cli-latest.tgz
sema --help
```

## Texto para GitHub Release

Sema 0.8.6 fecha o ciclo do `given` composto em geradores e formatador sem quebrar a proposta da ferramenta: protocolo de governança semântica, não gerador messiânico de sistema. Essa rodada corrige o Python para objeto tipado aninhado, remove a sabotagem do formatador em bloco nomeado livre e mantém a instalação oficial pelo npm em `@semacode/cli`.

Na prática, isso fecha um buraco importante de framing: a ferramenta fica mais honesta sobre o que governa, o que automatiza e onde a curadoria humana continua obrigatória.

Também ficam mais redondos:

- README como landing page pública
- fluxo oficial via npm
- onboarding de IA menos ambíguo

## Texto para LinkedIn

Publiquei uma nova rodada da Sema.

Sema é um Protocolo de Governança de Intenção para IA e backend vivo.

Em vez de fingir que contrato, erro, efeito, garantia e implementação real estão "mais ou menos documentados", a ideia da Sema é governar isso de forma explícita e verificável, sem pedir reescrita total da stack.

Nesta rodada, a melhora mais importante foi de posicionamento operacional: `starter-ia` e `ajuda-ia` agora deixam claro que a Sema não é gerador mágico de sistema, e sim protocolo de governança semântica para contrato, fluxo, erro, efeito, garantia, `impl` e `drift`.

Hoje a Sema já cobre bem fluxo incremental em `Flask`, `FastAPI`, `NestJS`, `Next.js App Router`, `Firebase worker`, `ASP.NET Core`, `Spring Boot`, `Go`, `Rust` e bridge genérica em `C++`.

Instalação:

```bash
npm install -g @semacode/cli
```

Repositório:
[https://github.com/gerlanss/Sema](https://github.com/gerlanss/Sema)

Showcase oficial:
[showcases/ranking-showroom](../showcases/ranking-showroom/README.md)

## Texto para X

Versão curta:

Sema é um Protocolo de Governança de Intenção para IA e backend vivo.

Contrato, erro, efeito, garantia, `impl`, `drift` e contexto para IA acima da stack.

Agora o onboarding da CLI deixa isso explícito: Sema não é gerador messiânico, é governança semântica de sistema vivo.

Instalação:
`npm install -g @semacode/cli`

Repo:
[github.com/gerlanss/Sema](https://github.com/gerlanss/Sema)

Thread curta:

1. OpenAPI e DTO não resolvem tudo quando a verdade do sistema fica espalhada em handler, service, comentário velho e framework.

2. Sema entra para governar a camada semântica acima da stack: contrato, fluxo, erro, efeito, garantia, `impl`, `drift` e contexto para IA.

3. A rodada nova fortalece o framing público: a ferramenta deixa mais claro o que governa, o que verifica e o que continua exigindo curadoria.

4. Instalação hoje:
`npm install -g @semacode/cli`

5. Repo:
[https://github.com/gerlanss/Sema](https://github.com/gerlanss/Sema)

## Texto para README / topo do repo

Sema é um Protocolo de Governança de Intenção para IA e backend vivo.

Ela ajuda a transformar contrato implícito em contrato verificável, ligar intenção à implementação real com `impl`, medir divergência com `drift` e preparar contexto acionável para IA antes de editar projeto vivo.

## Checklist de lançamento em 24h

### Bloco 1: publicação técnica

1. confirmar release pública mais recente no GitHub
2. confirmar instalação pelo npm em máquina limpa
3. confirmar `sema doctor`
4. confirmar showcase oficial
5. confirmar `npm run cli:publicar-npm-dry-run`

### Bloco 2: superfície pública

1. revisar descrição curta do GitHub
2. revisar tópicos do repositório
3. revisar topo do README
4. revisar link para showcase
5. revisar link para instalação

### Bloco 3: anúncio

1. publicar release note
2. publicar post no LinkedIn
3. publicar post curto ou thread no X
4. mostrar um exemplo concreto de valor
5. chamar feedback de instalação e uso real

## Checklist de resposta para quem perguntar “por que não usar só OpenAPI?”

Resposta curta:

Porque OpenAPI documenta borda. A Sema governa borda, intenção, erro, efeito, garantia, fluxo e o vínculo com implementação viva.

Resposta média:

OpenAPI é útil para descrever HTTP. Mas ele não resolve sozinho:

- garantia de negócio
- efeito operacional
- fluxo entre tarefas
- vínculo rastreável com símbolo real
- contexto acionável para IA editar projeto vivo

É justamente nesse buraco que a Sema entra.

# Kit de Lancamento Publico

Este documento deixa a Sema pronta para ser apresentada sem improviso tosco de ultima hora.

Use este kit como base para:

- anuncio em GitHub, LinkedIn e X
- release note curta
- post de showcase
- checklist de lancamento em 24h

## Posicionamento em 1 frase

Sema e um **Protocolo de Governanca de Intencao para IA e backend vivo**.

## Pitch curto

Sema ajuda a transformar contrato implicito em contrato verificavel.

Ela governa intencao, erro, efeito, garantia, execucao, vinculos, superfícies modernas, `impl`, `drift` e contexto para IA acima da stack, sem pedir reescrita burra do projeto existente.

## Pitch medio

Em sistema vivo, a verdade costuma ficar espalhada entre handler, DTO, comentario vencido, regra de framework e service escondido.

A Sema junta isso numa camada semantica governavel:

- contrato explicito
- fluxo e garantia
- vinculo com implementacao real via `impl` e `vinculos`
- contrato operacional via `execucao`
- divergencia real entre contrato e codigo vivo via `drift`
- contexto acionavel para IA com `briefing.json`

Ela nao tenta substituir TypeScript, Python, Flask, FastAPI ou NestJS.

Ela entra acima disso para impedir humano e IA de mexerem em backend vivo no escuro feito dois confiantes sem contexto.

## Prova de valor em 3 linhas

- `Flask`: contrato + `impl.py` + `vinculos` + `drift` verde em backend real
- `Next.js App Router`: importacao incremental e `drift` de rota publica sem falso positivo idiota
- `contexto-ia`: AST, IR, diagnosticos, `drift.json` e `briefing.json` para agente editar com menos adivinhacao

## CTA oficial

Hoje o CTA principal e npm:

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

Sema 0.9.1 fecha a linha publica 0.9 com um ajuste importante: a experiencia de instalacao e onboarding para IA agora fica coerente com a CLI publica, sem depender de monorepo nem de caminho interno da propria Sema.

Na pratica, esta patch:

- limpa docs e prompts que ainda ensinavam `node pacotes/cli/dist/index.js` ou `project:check` como fluxo normal
- reforca `sema` como interface publica principal para agente e usuario
- leva docs e exemplos uteis junto com o pacote publico da CLI
- consolida a trilha IA-first para `starter-ia`, `ajuda-ia`, `contexto-ia` e instalacao

O resultado e simples: menos ruído, menos contexto acidental de repo e menos chance da IA operar como se estivesse dentro do monorepo quando o alvo real e um projeto qualquer.

## Texto para LinkedIn

Publiquei a linha 0.9.1 da Sema.

Sema e um Protocolo de Governanca de Intencao para IA e backend vivo.

Ela nao tenta substituir a stack. Ela governa a camada semantica acima da stack: contrato, erro, efeito, garantia, fluxo, `impl`, `vinculos`, `execucao`, `drift` e contexto para IA.

Nessa patch, o foco foi consolidar a superficie publica para IA:

- docs e prompts sem vazamento de monorepo
- `sema` como interface publica principal
- pacote npm com docs e exemplos uteis para agente
- onboarding mais coerente para instalacao real

Instalacao:

```bash
npm install -g @semacode/cli
```

Repo:
[https://github.com/gerlanss/Sema](https://github.com/gerlanss/Sema)

Showcase oficial:
[showcases/ranking-showroom](../showcases/ranking-showroom/README.md)

## Texto para X

Versao curta:

Sema 0.9.1.

Protocolo de Governanca de Intencao para IA e backend vivo.

Patch focada em deixar a experiencia publica realmente IA-first:

- menos vazamento de monorepo
- docs e prompts mais coerentes
- pacote publico com exemplos e docs uteis

Instalacao:
`npm install -g @semacode/cli`

Repo:
[github.com/gerlanss/Sema](https://github.com/gerlanss/Sema)

Thread curta:

1. OpenAPI e DTO nao resolvem tudo quando a verdade do sistema fica espalhada em handler, service, comentario velho e framework.

2. Sema entra para governar a camada semantica acima da stack: contrato, fluxo, erro, efeito, garantia, `impl`, `vinculos`, `execucao`, `drift` e contexto para IA.

3. A linha 0.9.1 limpa a camada publica para agente: menos ruído, menos suposicao errada e menos caminho interno vazando.

4. Instalacao hoje:
`npm install -g @semacode/cli`

5. Repo:
[https://github.com/gerlanss/Sema](https://github.com/gerlanss/Sema)

## Checklist de lancamento em 24h

### Bloco 1: publicacao tecnica

1. confirmar release publica mais recente no GitHub
2. confirmar instalacao pelo npm em maquina limpa
3. confirmar `sema doctor`
4. confirmar showcase oficial
5. confirmar `npm run cli:publicar-npm-dry-run`

### Bloco 2: superficie publica

1. revisar descricao curta do GitHub
2. revisar topicos do repositorio
3. revisar topo do README
4. revisar link para showcase
5. revisar link para instalacao

### Bloco 3: anuncio

1. publicar release note
2. publicar post no LinkedIn
3. publicar post curto ou thread no X
4. mostrar um exemplo concreto de valor
5. chamar feedback de instalacao e uso real

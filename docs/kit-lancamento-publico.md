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

Ela governa intencao, erro, efeito, garantia, execucao, vinculos, superficies modernas, `impl`, `drift` e contexto para IA acima da stack, sem pedir reescrita burra do projeto existente.

## Pitch medio

Em sistema vivo, a verdade costuma ficar espalhada entre handler, DTO, comentario vencido, regra de framework e service escondido.

A Sema junta isso numa camada semantica governavel:

- contrato explicito
- fluxo e garantia
- vinculo com implementacao real via `impl` e `vinculos`
- contrato operacional via `execucao`
- divergencia real entre contrato e codigo vivo via `drift`
- compressao semantica por capacidade com `resumo`, `prompt-curto` e `briefing.min.json`

Ela nao tenta substituir TypeScript, Python, Flask, FastAPI ou NestJS.

Ela entra acima disso para impedir a IA de mexer em backend vivo no escuro feito um agente confiante sem contexto. Se leitura humana melhorar junto, otimo, mas nao e a metrica principal.

## Prova de valor em 3 linhas

- `Flask`: contrato + `impl.py` + `vinculos` + `drift` verde em backend real
- `Next.js App Router`: importacao incremental e `drift` de rota publica sem falso positivo idiota
- `contexto-ia`: `briefing.min.json`, `resumo.micro.txt`, `drift.json` e `briefing.json` para agente editar com menos adivinhacao

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

Sema 1.0.0 fecha a primeira linha publica estavel do protocolo com um salto que muda como IA pequena, media e grande consomem contexto.

Na pratica, esta release:

- adiciona `sema resumo` com tamanhos `micro`, `curto` e `medio`
- adiciona `sema prompt-curto` para colar contexto compacto em IA gratuita ou de janela curta
- faz `contexto-ia` gerar `briefing.min.json`, `resumo.micro.txt`, `resumo.curto.txt`, `resumo.md` e `prompt-curto.txt`
- gera `SEMA_BRIEF.*` e `SEMA_INDEX.json` como ponto de entrada semantico de projeto
- deixa explicito em docs e onboarding que a Sema e feita para IA, nao para ergonomia humana como prioridade

O resultado e simples: menos desperdicio de contexto, menos chute de modelo pequeno e mais diferenciacao operacional entre o que cada faixa de IA aguenta consumir.

## Texto para LinkedIn

Publiquei a 1.0.0 da Sema.

Sema e um Protocolo de Governanca de Intencao para IA e backend vivo.

Ela nao tenta substituir a stack. Ela governa a camada semantica acima da stack: contrato, erro, efeito, garantia, fluxo, `impl`, `vinculos`, `execucao`, `drift` e contexto para IA.

Na 1.0.0, o foco foi fechar a primeira linha estavel com contexto por capacidade de IA:

- `sema resumo` para IA pequena, media e grande
- `prompt-curto` para prompt compacto e colavel
- `briefing.min.json` e `SEMA_BRIEF.*` como entrada semantica enxuta
- docs e onboarding assumindo sem vergonha que a linguagem e IA-first

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

Sema 1.0.0.

Protocolo de Governanca de Intencao para IA e backend vivo.

Release focada em deixar a experiencia publica realmente IA-first por capacidade:

- `sema resumo`
- `prompt-curto`
- `briefing.min.json`
- `SEMA_BRIEF.*`

Instalacao:
`npm install -g @semacode/cli`

Repo:
[github.com/gerlanss/Sema](https://github.com/gerlanss/Sema)

Thread curta:

1. OpenAPI e DTO nao resolvem tudo quando a verdade do sistema fica espalhada em handler, service, comentario velho e framework.

2. Sema entra para governar a camada semantica acima da stack: contrato, fluxo, erro, efeito, garantia, `impl`, `vinculos`, `execucao`, `drift` e contexto para IA.

3. A linha 1.0.0 fecha a compressao semantica para agente: menos ruido, menos desperdicio de contexto e menos chute em IA pequena.

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

# Kit de Lancamento Publico

Este documento deixa a Sema pronta para ser apresentada sem enrolacao e sem papo de release feita nas coxas.

Use este kit como base para:

- anuncio em GitHub, LinkedIn e X
- release note curta
- post de showcase
- checklist de lancamento em 24h

## Posicionamento em 1 frase

Sema e um **Protocolo de Governanca de Intencao para IA e backend vivo**.

## Pitch curto

Sema ajuda a transformar contrato implicito em contrato verificavel.

Ela governa intencao, borda HTTP, erro, efeito, garantia, `impl`, `drift` e contexto para IA acima da stack, sem pedir reescrita burra do projeto existente.

## Pitch medio

Em sistema vivo, a verdade costuma ficar espalhada entre handler, DTO, comentario vencido, regra de framework e service escondido.

A Sema junta isso numa camada semantica governavel:

- contrato explicito
- fluxo e garantia
- vinculo com implementacao real via `impl`
- divergencia real entre contrato e codigo vivo via `drift`
- contexto acionavel para IA antes de editar

Ela nao tenta substituir `TypeScript`, `Python`, `Flask`, `FastAPI`, `NestJS` ou `Next.js`.

Ela entra acima disso para impedir humano e IA de mexerem em backend vivo no escuro feito dois malucos confiantes demais.

## Prova de valor em 3 linhas

- `Flask`: contrato + `impl.py` + `drift` verde em backend real
- `Next.js App Router`: importacao incremental e `drift` de rota publica sem falso positivo idiota
- `contexto-ia`: AST, IR, diagnosticos e `drift.json` para agente editar com menos adivinhacao

## CTA oficial atual

Hoje o CTA principal continua sendo GitHub Release:

```bash
npm install -g https://github.com/gerlanss/Sema/releases/latest/download/sema-cli-latest.tgz
sema --help
sema doctor
```

Agora que o pacote publico usa o scope da organizacao `semacode`, o CTA curto pode virar:

```bash
npm install -g @semacode/cli
sema --help
```

## Texto para GitHub Release

Sema 0.8.3 fortalece a importacao de `Next.js App Router` em casos reais onde o handler usa `request.json()` com tipo/cast inline e retorna `NextResponse.json(...)` via variavel local, e passa a carregar os docs essenciais de IA no pacote publicado do npm.

Na pratica, isso fecha um buraco importante do bootstrap semantico: o importador deixa de cair em `input {}` e `resultado: Json` em endpoints como `auth/login` e `local-firestore/query`, desde que o codigo entregue sinal forte suficiente.

Tambem ficam mais redondos:

- README como landing page publica
- fluxo pronto para `npm publish`
- scripts oficiais de dry-run para validar publicacao

## Texto para LinkedIn

Publiquei uma nova rodada da Sema.

Sema e um Protocolo de Governanca de Intencao para IA e backend vivo.

Em vez de fingir que contrato, erro, efeito, garantia e implementacao real estao “mais ou menos documentados”, a ideia da Sema e governar isso de forma explicita e verificavel, sem pedir reescrita total da stack.

Nesta rodada, a melhora mais concreta foi no `Next.js App Router`: o importador ficou mais forte em handlers com `request.json()` tipado ou com cast inline, e em respostas que passam por `NextResponse.json(...)` via variavel local antes do `return`.

Traduzindo sem perfume: saiu da fase “bootstrap meio genericão” e ficou bem mais útil em endpoint real.

Hoje a Sema ja cobre bem fluxo incremental em `Flask`, `FastAPI`, `NestJS`, `Next.js App Router`, `Firebase worker`, `ASP.NET Core`, `Spring Boot`, `Go`, `Rust` e bridge generica em `C++`.

Instalacao:

```bash
npm install -g https://github.com/gerlanss/Sema/releases/latest/download/sema-cli-latest.tgz
```

Repositorio:
[https://github.com/gerlanss/Sema](https://github.com/gerlanss/Sema)

Showcase oficial:
[showcases/ranking-showroom](../showcases/ranking-showroom/README.md)

## Texto para X

Versao curta:

Sema e um Protocolo de Governanca de Intencao para IA e backend vivo.

Contrato, erro, efeito, garantia, `impl`, `drift` e contexto para IA acima da stack.

A rodada mais nova fortaleceu `Next.js App Router` em casos reais de `request.json()` tipado/cast inline.

Instalacao:
`npm install -g https://github.com/gerlanss/Sema/releases/latest/download/sema-cli-latest.tgz`

Repo:
[github.com/gerlanss/Sema](https://github.com/gerlanss/Sema)

Thread curta:

1. OpenAPI e DTO nao resolvem tudo quando a verdade do sistema fica espalhada em handler, service, comentario velho e framework.

2. Sema entra para governar a camada semantica acima da stack: contrato, fluxo, erro, efeito, garantia, `impl`, `drift` e contexto para IA.

3. A rodada nova melhorou bastante `Next.js App Router`, especialmente em body inference com `request.json()` tipado/cast inline.

4. Instalacao hoje:
`npm install -g https://github.com/gerlanss/Sema/releases/latest/download/sema-cli-latest.tgz`

5. Repo:
[https://github.com/gerlanss/Sema](https://github.com/gerlanss/Sema)

## Texto para README / topo do repo

Sema e um Protocolo de Governanca de Intencao para IA e backend vivo.

Ela ajuda a transformar contrato implicito em contrato verificavel, ligar intencao a implementacao real com `impl`, medir divergencia com `drift` e preparar contexto acionavel para IA antes de editar projeto vivo.

## Checklist de lancamento em 24h

### Bloco 1: publicacao tecnica

1. confirmar release publica mais recente no GitHub
2. confirmar instalacao pelo tarball em maquina limpa
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

## Exemplo de valor para mostrar no anuncio

Antes:

- importador `Next.js` gerava `input {}` e `resultado: Json` em endpoint com body real

Depois:

- o bootstrap puxa `email`, `password`, `remember_me`, `ok` e `user` quando o handler entrega sinal forte

Esse tipo de antes/depois vende muito melhor do que falar genericamente em “DSL para IA”.

## Checklist de resposta para quem perguntar “por que nao usar so OpenAPI?”

Resposta curta:

Porque OpenAPI documenta borda. A Sema governa borda, intencao, erro, efeito, garantia, fluxo e o vinculo com implementacao viva.

Resposta media:

OpenAPI e util para descrever HTTP. Mas ele nao resolve sozinho:

- garantia de negocio
- efeito operacional
- fluxo entre tarefas
- vinculo rastreavel com simbolo real
- contexto acionavel para IA editar projeto vivo

E justamente nesse buraco que a Sema entra.

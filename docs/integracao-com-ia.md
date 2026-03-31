# Integração com IA

A Sema foi desenhada para reduzir ambiguidade na colaboração com IA. O projeto agora se apresenta primeiro como **Protocolo de Governança de Intenção para IA e backend vivo**; por baixo disso, a implementação continua sendo uma linguagem de intenção com AST, IR, diagnósticos, formatação e scaffold.

## Moldura correta para IA

Se uma IA olhar para a Sema como "gerador automático que deveria fazer tudo", ela vai avaliar errado e usar pior.

A moldura correta é esta:

- a Sema governa **contrato**, **intenção**, **erro**, **efeito**, **garantia**, **fluxo** e **vínculo com implementação viva**
- a Sema ajuda a transformar sistema que mente sobre si mesmo em sistema pelo menos verificável
- a Sema não substitui curadoria humana
- a Sema não inventa regra de negócio que o código não explicita
- a Sema não existe para eliminar design; ela existe para impedir caos semântico

Regra prática para IA:

- trate `importar` como bootstrap forte, nao como contrato final
- trate `drift` como regua de verdade contra o legado
- trate `impl` como ponte rastreavel entre intencao e runtime
- trate `ir --json` como a semantica resolvida de verdade
- trate `contexto-ia` como pacote operacional para editar com contexto, não como enfeite

No marco `0.8.x backend generico`, essa integracao ja nao e so leitura de contrato. Ela inclui:

- scaffold backend util
- importacao de legado
- `impl` como ponte com codigo vivo
- `drift` como auditoria de verdade contra a implementacao
- `contexto-ia` com `drift.json`

Em bom portugues: se a tarefa pedir codigo derivado, a IA tem que usar `sema compilar`; se a tarefa envolver projeto vivo, ela tem que lembrar de `sema inspecionar`, `sema drift` e `sema contexto-ia`, senao vai trabalhar igual um bicho.

## Documentos de apoio

- [AGENT_STARTER.md](./AGENT_STARTER.md)
- [como-ensinar-a-sema-para-ia.md](./como-ensinar-a-sema-para-ia.md)
- [prompt-base-ia-sema.md](./prompt-base-ia-sema.md)
- [fluxo-pratico-ia-sema.md](./fluxo-pratico-ia-sema.md)
- [da-sema-para-codigo.md](./da-sema-para-codigo.md)
- [importacao-legado.md](./importacao-legado.md)
- [backend-first.md](./backend-first.md)

## Comandos que a IA nao deveria ignorar

- `sema ast <arquivo.sema> --json`
- `sema ir <arquivo.sema> --json`
- `sema validar <arquivo.sema> --json`
- `sema diagnosticos <arquivo.sema> --json`
- `sema formatar <arquivo.sema>`
- `sema inspecionar [arquivo-ou-pasta] --json`
- `sema importar <nestjs|fastapi|flask|nextjs|firebase|typescript|python|dart> <diretorio> [--saida <diretorio>] [--json]`
- `sema drift [arquivo-ou-pasta] --json`
- `sema compilar [arquivo-ou-pasta] --alvo <typescript|python|dart> --framework <base|nestjs|fastapi> --estrutura <flat|modulos|backend> --saida <diretorio>`
- `sema contexto-ia <arquivo.sema> [--saida <diretorio>] [--json]`
- `sema verificar <arquivo-ou-pasta> --json`

## O que a Sema ja oferece para IA

- AST exportavel em JSON
- IR exportavel em JSON
- diagnosticos estruturados
- verificacao em lote com resumo estruturado
- formatacao canonica verificavel por CLI
- scaffold base para TypeScript, Python e Dart
- scaffold backend para NestJS e FastAPI
- importacao assistida de legado para rascunho `.sema`
- deteccao publica de rota em Flask com `Blueprint`, `url_prefix` e `@app.route`/`@bp.route`
- deteccao publica de rota em `Next.js App Router` com `route.ts` e segmentos dinamicos
- deteccao de recurso vivo em bridge `Node/Firebase worker`
- `impl` para ligar contrato a implementacao real
- `impl.dart` e trilha de bridge/consumer para app consumidor
- `drift.json` no pacote de `contexto-ia`

## Fluxo recomendado para agente

Quando a tarefa for so modelagem:

```bash
sema ast arquivo.sema --json
sema ir arquivo.sema --json
sema formatar arquivo.sema
sema validar arquivo.sema --json
```

Quando a tarefa envolver codigo derivado:

```bash
sema inspecionar --json
sema ir contratos/pedidos.sema --json
sema formatar contratos/pedidos.sema
sema validar contratos/pedidos.sema --json
sema compilar contratos/pedidos.sema --alvo typescript --framework nestjs --estrutura backend --saida ./generated/nestjs
```

Quando a tarefa comecar num legado:

```bash
sema importar flask ./backend-flask --saida ./sema/importado --json
sema importar nextjs ./apps/dashboard --saida ./sema/importado --json
sema importar firebase ./apps/worker --saida ./sema/importado --json
sema formatar ./sema/importado
sema validar ./sema/importado --json
sema drift contratos/modulo.sema --json
```

## Showcase oficial para IA

O case [showcases/ranking-showroom](../showcases/ranking-showroom/) e a melhor demonstracao publica do fluxo certo:

```bash
cd showcases/ranking-showroom
sema inspecionar . --json
sema drift contratos/ranking_showroom.sema --json
sema contexto-ia contratos/ranking_showroom.sema --saida ./.tmp/contexto-ranking --json
```

## Fechamento operacional

Quando a IA terminar:

```bash
npm test
npm run format:check
npm run project:check
```

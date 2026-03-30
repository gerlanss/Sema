# Integracao com IA

A Sema foi desenhada para reduzir ambiguidade na colaboracao com IA. A prioridade de design do projeto e permitir que modelos entendam, validem, transformem e operem sobre contratos semanticos explicitos.

No marco `0.7 legado incremental`, essa integracao deixa de ser so leitura de contrato e passa a incluir **geracao de scaffold backend util** e **governanca de legado**. Em bom portugues: se a tarefa pedir codigo derivado, a IA tem que parar de agir como jumento e colocar `sema compilar` no fluxo; se a tarefa envolver projeto vivo, tambem tem que lembrar do `sema drift`.

## Documentos de apoio

- [AGENT_STARTER.md](./AGENT_STARTER.md)
- [como-ensinar-a-sema-para-ia.md](./como-ensinar-a-sema-para-ia.md)
- [prompt-base-ia-sema.md](./prompt-base-ia-sema.md)
- [fluxo-pratico-ia-sema.md](./fluxo-pratico-ia-sema.md)
- [da-sema-para-codigo.md](./da-sema-para-codigo.md)
- [importacao-legado.md](./importacao-legado.md)
- [backend-first.md](./backend-first.md)

## Comandos dedicados da CLI

- `sema ajuda-ia`
- `sema starter-ia`
- `sema prompt-ia`
- `sema prompt-ia-ui`
- `sema prompt-ia-react`
- `sema prompt-ia-sema-primeiro`
- `sema exemplos-prompt-ia`
- `sema contexto-ia <arquivo.sema>`

## Comandos essenciais que a IA nao deveria ignorar

- `sema ast <arquivo.sema> --json`
- `sema ir <arquivo.sema> --json`
- `sema validar <arquivo.sema> --json`
- `sema diagnosticos <arquivo.sema> --json`
- `sema formatar <arquivo.sema>`
- `sema inspecionar [arquivo-ou-pasta] --json`
- `sema importar <nestjs|fastapi|typescript|python|dart> <diretorio> [--saida <diretorio>] [--json]`
- `sema compilar [arquivo-ou-pasta] --alvo <typescript|python|dart> --framework <base|nestjs|fastapi> --estrutura <flat|modulos|backend> --saida <diretorio>`
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
- blocos explicitos para regra, efeito, garantia, estado, fluxo, erro e teste
- `impl` para ligar contrato a implementacao real

## Comandos que expoem JSON

Os comandos abaixo devem ser tratados como contrato publico principal para IA e automacao:

- `sema validar --json`
- `sema diagnosticos --json`
- `sema ast --json`
- `sema ir --json`
- `sema verificar --json`
- `sema formatar --json`
- `sema contexto-ia --json`
- `sema inspecionar --json`

## Como consumir cada comando

### `validar --json`

Use quando a IA precisar saber se um arquivo ou projeto esta semanticamente valido antes de sugerir mudancas.

Fluxo recomendado:

1. executar `validar --json`
2. ler `sucesso`
3. se houver falha, usar `diagnosticos` como fonte de correcao
4. se a tarefa pedir codigo derivado, seguir com `compilar`

### `diagnosticos --json`

Use quando a IA ja sabe que existe problema e precisa atuar como reparadora.

Cada diagnostico deve ser lido como contrato de erro semantico, nao como log textual perdido.

### `ast --json`

Use quando a IA precisar entender a estrutura sintatica do modulo como foi escrita.

### `ir --json`

Use quando a IA precisar operar sobre a forma semantica resolvida da linguagem.

Na pratica, `ir --json` e o melhor ponto para:

- compreender contratos internos
- compreender contratos publicos de `route`
- inspecionar `effects`
- navegar por `flow`, `state` e `task`
- ver `impl` e imports externos declarados

### `inspecionar --json`

Use quando a IA precisar saber:

- qual `sema.config.json` foi encontrado
- quais origens estao ativas
- quais modulos foram resolvidos
- qual framework/estrutura de saida esta em jogo

Esse comando evita muito diagnostico burro em projeto com multiplas pastas.

### `verificar --json`

Use quando a IA precisar de uma visao operacional da saude do projeto.

Esse comando deve ser preferido para perguntas como:

- quais modulos passaram ou falharam
- quantos arquivos foram gerados
- quantos testes rodaram
- quais alvos foram exercitados

### `formatar --json`

Use quando a IA precisar integrar reformatacao, auditoria de estilo ou checagem de consistencia antes de encerrar uma alteracao.

## Como a IA deve usar `sema formatar`

O formatador e a fonte unica de estilo da linguagem.

Fluxo recomendado:

1. aplicar mudancas no codigo `.sema`
2. executar `sema formatar <arquivo-ou-pasta>`
3. executar `sema formatar <arquivo-ou-pasta> --check`
4. se o `--check` falhar, a IA ainda nao terminou o trabalho direito

## Fluxo recomendado para agentes

### Quando a tarefa for so modelagem/edicao de contrato

```bash
sema ast arquivo.sema --json
sema ir arquivo.sema --json
sema formatar arquivo.sema
sema validar arquivo.sema --json
sema diagnosticos arquivo.sema --json
```

### Quando a tarefa pedir codigo derivado

```bash
sema inspecionar --json
sema ast contratos/pedidos.sema --json
sema ir contratos/pedidos.sema --json
sema formatar contratos/pedidos.sema
sema validar contratos/pedidos.sema --json
sema compilar contratos/pedidos.sema --alvo typescript --framework nestjs --estrutura backend --saida ./generated/nestjs
```

### Quando a tarefa comecar num projeto legado

```bash
sema importar nestjs ./backend --saida ./sema/importado --json
sema formatar ./sema/importado
sema validar ./sema/importado --json
```

### Quando a tarefa for Python/FastAPI

```bash
sema inspecionar --json
sema validar contratos/pagamentos.sema --json
sema compilar contratos/pagamentos.sema --alvo python --framework fastapi --estrutura backend --saida ./generated/fastapi
```

### Fechamento operacional

```bash
npm run status:check
npm test
npm run format:check
node pacotes/cli/dist/index.js verificar exemplos --json --saida ./.tmp/verificacao-0-6
```

Ou, de forma consolidada:

```bash
npm run project:check
```

## Preparar contexto para um agente

Quando a IA for atuar num modulo especifico, o caminho mais seguro e gerar um pacote dedicado:

```bash
sema contexto-ia exemplos/pagamento.sema
```

Esse comando gera um pacote em `.tmp/contexto-ia/...` com:

- `validar.json`
- `diagnosticos.json`
- `ast.json`
- `ir.json`
- `README.md` com o fluxo operacional recomendado

## Quando a tarefa envolve interface grafica

Se a tarefa envolver UI, o caminho certo nao e pedir um `index.html` solto e torcer.

Fluxo recomendado:

1. usar `sema starter-ia`
2. usar `sema prompt-ia-react` quando a tarefa for `Sema + React + TypeScript`
3. usar `sema prompt-ia-ui` quando a tarefa for visual, mas ainda mais aberta
4. usar `sema prompt-ia-sema-primeiro` quando voce quiser forcar a modelagem semantica antes da implementacao
5. usar `sema exemplos-prompt-ia` para pegar modelos de prompt prontos

Regra pratica:

- se o objetivo for testar a Sema de verdade, peca `.sema` + arquitetura de app
- nao peca apenas HTML unico quando a camada semantica for parte central da solucao

## Beneficios praticos para IA

- modelos conseguem identificar onde uma entrada foi declarada
- efeitos colaterais ficam visiveis em vez de enterrados
- garantias podem ser auditadas
- contratos publicos de `route` ficam rastreaveis
- `impl` mostra onde a implementacao real vive
- `sema.config.json` e `inspecionar` reduzem erro de contexto
- o formatador reduz ruido e diffs idiotas
- a saida JSON elimina boa parte da adivinhacao de parsing textual
- o scaffold backend reduz trabalho manual real

## Limites atuais

- o servidor de linguagem atual cobre diagnosticos, hover e formatacao, mas ainda nao entrega navegacao simbolica profunda, code actions ou completions ricos
- `use` avancado para projetos maiores ainda pode amadurecer mais
- `flow` ainda pode ficar melhor para orquestracao backend mais rica
- a Sema gera scaffold forte, mas ainda nao substitui implementacao real de framework sozinha

## Direcao futura

Depois do marco `0.6`, a integracao com IA deve evoluir principalmente em:

- adocao incremental em projetos backend existentes
- diagnosticos ainda mais acionaveis
- melhor uso de `flow` em orquestracao backend real
- traducao parcial de codigo legado para `.sema`
- suporte de editor mais profundo

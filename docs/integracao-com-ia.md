# Integracao com IA

A Sema foi desenhada para reduzir ambiguidade na colaboracao com IA. A prioridade de design do projeto e permitir que modelos entendam, validem, transformem e operem sobre contratos semanticos explicitos.

Na Fase 4, essa integracao deixou de ser so uma boa ideia e ganhou contrato operacional de verdade via CLI JSON, formatacao canonica e suporte basico de editor. No marco `0.5`, essa direcao passou a ter uma prova concreta no vertical oficial de pagamento.

Documentos complementares para onboarding de agente:

- [AGENT_STARTER.md](./AGENT_STARTER.md)
- [como-ensinar-a-sema-para-ia.md](./como-ensinar-a-sema-para-ia.md)
- [prompt-base-ia-sema.md](./prompt-base-ia-sema.md)
- [fluxo-pratico-ia-sema.md](./fluxo-pratico-ia-sema.md)

Comandos dedicados da CLI para onboarding e prompting:

- `sema ajuda-ia`
- `sema starter-ia`
- `sema prompt-ia`
- `sema prompt-ia-ui`
- `sema prompt-ia-react`
- `sema prompt-ia-sema-primeiro`
- `sema exemplos-prompt-ia`
- `sema contexto-ia <arquivo.sema>`

## O que a Sema ja oferece para IA

- AST exportavel em JSON
- IR exportavel em JSON
- diagnosticos estruturados
- verificacao em lote com resumo estruturado
- formatacao canonica verificavel por CLI
- blocos explicitos para regra, efeito, garantia, estado, fluxo, erro e teste
- um caso oficial de negocio ponta a ponta para orientar agentes: pagamento

## Comandos que expoem JSON

Os comandos abaixo devem ser tratados como contrato publico principal para IA e automacao:

- `sema validar --json`
- `sema diagnosticos --json`
- `sema ast --json`
- `sema ir --json`
- `sema verificar --json`
- `sema formatar --json`
- `sema contexto-ia --json`

## Como consumir cada comando

### `validar --json`

Use quando a IA precisar saber se um arquivo ou projeto esta semanticamente valido antes de sugerir mudancas.

Fluxo recomendado:

1. executar `validar --json`
2. ler `sucesso`
3. se houver falha, usar `diagnosticos` como fonte de correcao

### `diagnosticos --json`

Use quando a IA ja sabe que existe problema e precisa atuar como reparadora.

Cada diagnostico deve ser lido como contrato de erro semantico, nao como simples log textual.

Campos esperados:

- codigo
- mensagem
- severidade
- intervalo
- dica
- contexto

### `ast --json`

Use quando a IA precisar entender a estrutura sintatica do modulo como foi escrita, sem depender do gerador final.

### `ir --json`

Use quando a IA precisar operar sobre a forma semantica resolvida da linguagem.

Na pratica, `ir --json` e o melhor ponto para:

- compreender contratos internos
- compreender contratos publicos de `route`
- inspecionar `effects` tipados
- navegar por `flow`, `state` e `task`

### `verificar --json`

Use quando a IA precisar de uma visao operacional da saude do projeto.

Esse comando deve ser preferido para responder perguntas como:

- quais modulos passaram ou falharam
- quantos arquivos foram gerados
- quantos testes rodaram
- quais alvos foram exercitados

### `formatar --json`

Use quando a IA precisar integrar reformatacao, auditoria de estilo ou checagem de consistencia antes de encerrar uma alteracao.

## Como a IA deve usar `sema formatar`

O formatador e a fonte unica de estilo da linguagem.

Fluxo recomendado para IA:

1. aplicar mudancas no codigo `.sema`
2. executar `sema formatar <arquivo-ou-pasta>`
3. executar `sema formatar <arquivo-ou-pasta> --check`
4. se o `--check` falhar, a IA ainda nao terminou o trabalho direito

Em pipelines automatizados, o modo mais seguro e:

```bash
node pacotes/cli/dist/index.js formatar exemplos --check
```

## Fluxo recomendado para agentes e automacao

Para manutencao de projeto, o fluxo recomendado agora e:

```bash
npm run status:check
npm test
npm run format:check
node pacotes/cli/dist/index.js verificar exemplos --json --saida ./.tmp/verificacao-fase4
```

Ou, de forma consolidada:

```bash
npm run project:check
```

## Pagamento como regua do `0.5`

O vertical oficial de pagamento e a demonstracao pratica de que a Sema deixou de ser so uma boa DSL de laboratorio.

Ele serve como referencia para:

- contrato publico via `route`
- `effects` operacionais com `criticidade`
- `flow` com ramificacao de erro
- `state` e transicoes
- erros publicos e garantias finais
- geracao coerente em Python e TypeScript

O guia oficial desse fluxo esta em [pagamento-ponta-a-ponta.md](./pagamento-ponta-a-ponta.md).

## Preparar contexto para um agente

Quando a IA for atuar em um modulo especifico, o caminho mais seguro e gerar um pacote de contexto dedicado:

```bash
sema contexto-ia exemplos/pagamento.sema
```

Esse comando gera um pacote em `.tmp/contexto-ia/...` com:

- `validar.json`
- `diagnosticos.json`
- `ast.json`
- `ir.json`
- `README.md` com o fluxo operacional recomendado

Na pratica, esse pacote reduz bastante a chance de a IA sair inventando regra onde deveria estar lendo contrato.

## Quando a tarefa envolve interface grafica

Se a tarefa envolver UI, o caminho certo nao e pedir um `index.html` solto e torcer.

O fluxo recomendado e:

1. usar `sema starter-ia`
2. usar `sema prompt-ia-react` quando a tarefa for `Sema + React + TypeScript`
3. usar `sema prompt-ia-ui` quando a tarefa for visual, mas ainda mais aberta
4. usar `sema prompt-ia-sema-primeiro` quando voce quiser forcar a modelagem semantica antes da implementacao
5. usar `sema exemplos-prompt-ia` para pegar modelos de prompt prontos

Regra pratica:

- se o objetivo for testar a Sema de verdade, peca `.sema` + arquitetura de app
- nao peca apenas HTML unico quando a camada semantica for parte central da solucao

Se voce preferir integrar isso em automacao, use:

```bash
sema contexto-ia exemplos/pagamento.sema --json
```

## Beneficios praticos para IA

- modelos conseguem identificar onde uma entrada foi declarada
- efeitos colaterais ficam visiveis em vez de enterrados
- garantias podem ser auditadas
- contratos publicos de `route` ficam rastreaveis
- o vertical oficial de pagamento do `0.5` serve como caso de uso completo para orientar geracao, revisao e automacao
- casos de teste servem como ancora para geracao e revisao
- o formatador reduz ruido e diffs idiotas
- a saida JSON elimina boa parte da adivinhacao de parsing textual

## Limites atuais

- o servidor de linguagem atual cobre diagnosticos, hover e formatacao, mas ainda nao entrega navegacao simbolica profunda, code actions ou completions ricos
- a extensao de editor melhorou bastante, mas ainda pode crescer em ergonomia e inteligencia contextual
- `use` avancado para projetos maiores ainda nao esta maduro
- a linguagem ainda pode ganhar expressoes e contratos mais ricos no pos-MVP

## Direcao futura

Depois da Fase 4 e do marco `0.5`, a integracao com IA deve evoluir principalmente em:

- diagnosticos ainda mais acionaveis
- fluxos de correcao automatizada
- traducao parcial de codigo legado para `.sema`
- ferramentas de editor mais profundas

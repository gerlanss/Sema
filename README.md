# Sema

Sema e uma DSL semantica, declarativa e orientada a intencao para descrever contratos de negocio de forma executavel. Em vez de esconder regra, efeito colateral, garantia e teste no meio de codigo imperativo, a Sema assume que esses elementos merecem cidadania de primeira classe.

O projeto foi desenhado como uma camada acima de Python e TypeScript. A ideia nao e substituir essas linguagens, e sim governar a camada de especificacao, validacao e geracao de codigo com mais previsibilidade.

A prioridade de design da Sema e facilitar o entendimento, a transformacao e a operacao correta por IA. A legibilidade humana continua importante, mas entra como consequencia de uma linguagem que explicita intencao, contrato, efeitos e garantias com o minimo de ambiguidade para modelos.

O acompanhamento operacional do que ja foi feito e do que ainda falta esta em [STATUS.md](C:\GitHub\Sema\STATUS.md).
As regras de colaboracao e o fluxo de contribuicao estao em [CONTRIBUTING.md](C:\GitHub\Sema\CONTRIBUTING.md).
O guia oficial do vertical de referencia esta em [docs/pagamento-ponta-a-ponta.md](C:\GitHub\Sema\docs\pagamento-ponta-a-ponta.md).
O guia para ensinar a linguagem a agentes esta em [docs/como-ensinar-a-sema-para-ia.md](C:\GitHub\Sema\docs\como-ensinar-a-sema-para-ia.md).
O prompt-base oficial para IA esta em [docs/prompt-base-ia-sema.md](C:\GitHub\Sema\docs\prompt-base-ia-sema.md).
O fluxo pratico de onboarding de agente esta em [docs/fluxo-pratico-ia-sema.md](C:\GitHub\Sema\docs\fluxo-pratico-ia-sema.md).
O starter curto para colar em qualquer agente esta em [docs/AGENT_STARTER.md](C:\GitHub\Sema\docs\AGENT_STARTER.md).

Para sincronizar a data e o commit de referencia do status:

```bash
npm run status:sync
```

Para validar se o `STATUS.md` esta consistente com a estrutura esperada:

```bash
npm run status:check
```

Para preparar uma atualizacao de documentacao e status antes de commitar:

```bash
npm run docs:prepare
```

Para rodar a checagem operacional completa do projeto:

```bash
npm run project:check
```

## Por que a Sema existe

Em software de negocio, o problema raramente e apenas "como programar". O problema real e tornar claro:

- o que a operacao quer fazer
- quais entradas ela aceita
- quais saidas ela promete
- quais regras precisam ser respeitadas
- quais efeitos colaterais podem acontecer
- quais garantias devem ser verdadeiras no final
- como esse comportamento deve ser testado

Python e TypeScript resolvem partes disso, mas deixam muita coisa espalhada entre comentarios, convencoes, testes externos e memoria tribal. A Sema puxa isso para o centro.

## Principios da linguagem

- IA primeiro, humano como consequencia da clareza semantica
- semantica antes de compactacao sintatica
- falhar cedo diante de ambiguidade
- contratos explicitos de entrada e saida
- efeitos colaterais declarados, nunca escondidos
- garantias pos-execucao como parte da linguagem
- testes embutidos como documentacao executavel
- legibilidade para pessoas como efeito colateral positivo de uma estrutura pensada para IA
- expressoes semanticas estruturadas para `rules`, `effects` e `guarantees`
- expressoes compostas com `e`, `ou`, `nao` e parenteses no MVP atual
- `flow` com etapas estruturadas, `quando` e `depende_de` no MVP atual
- `flow` com mapeamento de contexto por etapa e ramificacao basica de sucesso/erro
- `flow` com roteamento por tipo de erro no MVP atual
- `state` com invariantes e transicoes declarativas no MVP atual
- `task` com vinculo explicito a `state` e validacao inicial de transicoes permitidas
- contratos executaveis de erro gerados de forma inicial para TypeScript e Python
- `effects` tipados por categoria com taxonomia inicial de Fase 3
- `route` como contrato publico semantico com `input`, `output` e `error` opcionais

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

## Instalar dependencias

```bash
npm install
npm run build
```

## Validar um arquivo

```bash
node pacotes/cli/dist/index.js validar exemplos/calculadora.sema
```

Quando o arquivo usa `use`, a CLI passa a carregar os outros arquivos `.sema` da mesma pasta de projeto como contexto de compilacao. No MVP atual, isso cobre bem multiplos modulos vizinhos no mesmo conjunto de trabalho.

## Gerar Python

```bash
node pacotes/cli/dist/index.js compilar exemplos/calculadora.sema --alvo python --saida ./saida/python
```

## Gerar TypeScript

```bash
node pacotes/cli/dist/index.js compilar exemplos/calculadora.sema --alvo typescript --saida ./saida/typescript
```

## Rodar testes

```bash
npm test
```

Para fazer a verificacao completa que o projeto usa como fluxo principal de qualidade:

```bash
npm run project:check
```

Para validar, compilar e testar todos os exemplos em lote:

```bash
node pacotes/cli/dist/index.js verificar exemplos --saida ./.tmp/verificacao
```

Para verificar se os arquivos `.sema` ja estao no formato canonico:

```bash
node pacotes/cli/dist/index.js formatar exemplos --check
```

Para aplicar a formatacao canonica:

```bash
node pacotes/cli/dist/index.js formatar exemplos
```

Para integrar com automacao, IDE ou IA em JSON:

```bash
node pacotes/cli/dist/index.js validar exemplos --json
node pacotes/cli/dist/index.js verificar exemplos --json --saida ./.tmp/verificacao-json
```

Para preparar um pacote de contexto para uma IA trabalhar em um modulo especifico:

```bash
npm run ia:preparar-contexto -- exemplos/pagamento.sema
```

Esse comando gera, em `.tmp/contexto-ia/...`, um pacote com:

- `validar.json`
- `diagnosticos.json`
- `ast.json`
- `ir.json`
- `README.md` com o fluxo recomendado para o agente

O comando imprime um resumo final por modulo e por alvo, incluindo:

- quantidade de arquivos gerados
- quantidade de testes executados
- pasta de saida usada em cada alvo
- uso recomendado como checagem completa antes de commit ou PR

Quando a entrada for um unico arquivo `.sema`, os comandos `validar`, `compilar`, `testar`, `ast`, `ir` e `diagnosticos` passam a considerar os outros arquivos `.sema` vizinhos como contexto para resolver `use`, mas mantem a saida focada no arquivo solicitado.

Para testar um modulo `.sema` gerando codigo temporario:

```bash
node pacotes/cli/dist/index.js testar exemplos/calculadora.sema --alvo typescript --saida ./.tmp/testes-ts
```

## Estrutura do repositorio

```text
docs/                  Documentacao conceitual e tecnica
exemplos/              Modulos .sema completos
pacotes/nucleo/        Lexer, parser, AST, semantica e IR
pacotes/gerador-python/      Geracao de codigo Python
pacotes/gerador-typescript/  Geracao de codigo TypeScript
pacotes/cli/           Interface de linha de comando
pacotes/editor-vscode/ Extensao basica de VS Code para `.sema`
pacotes/padroes/       Funcoes auxiliares compartilhadas
testes/                Testes de unidade e integracao
```

## Extensao VS Code

O repositorio agora inclui uma extensao basica de VS Code em `pacotes/editor-vscode` com:

- associacao automatica de arquivos `.sema`
- destaque de sintaxe
- configuracao basica da linguagem
- snippets iniciais
- comando de formatacao delegando para a CLI oficial da Sema

Instalacao manual, no estado atual:

1. abrir a pasta `pacotes/editor-vscode` no VS Code
2. executar o empacotamento/extensao conforme o fluxo padrao do VS Code para extensoes locais
3. instalar a extensao local gerada no ambiente de teste

O objetivo desta fase nao foi entregar LSP, e sim uma base de ergonomia real para editor sem duplicar regra de formatacao.

## Estagio atual

O projeto esta em MVP funcional e com a Fase 4 formalmente concluida. Isso significa que a Sema ja nao tem so compilador e semantica central; ela agora tambem tem camada real de adocao para time, automacao, IDE e IA.

As quatro fases do MVP base foram fechadas:

- Fase 1: fundacao do compilador
- Fase 2: semantica operacional do nucleo
- Fase 3: operacionalizacao real da linguagem
- Fase 4: ferramentas de adocao

No estado atual, a Sema:

- resolve `use` entre modulos vizinhos
- formaliza expressoes com `e`, `ou`, `nao` e parenteses
- valida invariantes e transicoes em `state`
- vincula `task` a `state`
- entende `flow` estruturado com dependencias, contexto, ramificacao e roteamento por erro
- tipa `effects` em `persistencia`, `consulta`, `evento`, `notificacao` e `auditoria`
- fortalece `route` como contrato publico semantico
- gera contratos executaveis iniciais para Python e TypeScript
- expõe AST, IR, diagnosticos e verificacao em JSON estruturado
- aplica formatacao canonica oficial com `sema formatar`
- oferece extensao basica de VS Code para arquivos `.sema`

O proximo ciclo do projeto deixa de ser "fechar o MVP base" e passa a ser amadurecimento pos-Fase 4: ecossistema, editor mais profundo, contratos mais ricos e expansao segura da linguagem.

No estado atual, a Sema ja alcancou um marco pratico de `0.5` util de verdade:

- vertical oficial de pagamento modularizado com `use`
- contrato publico mais forte em `route`
- `effects` operacionais com criticidade
- validacao e geracao coerentes para o dominio de pagamento
- verificacao ponta a ponta usando o caso real como regua

## Roadmap resumido

- amadurecer o ecossistema pos-Fase 4
- evoluir suporte de editor alem da extensao basica atual
- enriquecer ainda mais contratos de execucao, efeitos e erros
- ampliar a resolucao de `use` para projetos maiores
- aprofundar a experiencia de automacao e integracao com IA

## Aviso importante

Este projeto esta em MVP. Ele ja serve como base real para construir a linguagem, mas ainda nao pretende ser uma implementacao final ou completa.

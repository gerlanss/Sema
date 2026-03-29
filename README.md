# Sema

Sema e uma DSL semantica, declarativa e orientada a intencao para descrever contratos de negocio de forma executavel. Em vez de esconder regra, efeito colateral, garantia e teste no meio de codigo imperativo, a Sema assume que esses elementos merecem cidadania de primeira classe.

O projeto foi desenhado como uma camada acima de Python e TypeScript. A ideia nao e substituir essas linguagens, e sim governar a camada de especificacao, validacao e geracao de codigo com mais previsibilidade.

A prioridade de design da Sema e facilitar o entendimento, a transformacao e a operacao correta por IA. A legibilidade humana continua importante, mas entra como consequencia de uma linguagem que explicita intencao, contrato, efeitos e garantias com o minimo de ambiguidade para modelos.

O acompanhamento operacional do que ja foi feito e do que ainda falta esta em [STATUS.md](C:\GitHub\Sema\STATUS.md).
As regras de colaboracao e o fluxo de contribuicao estao em [CONTRIBUTING.md](C:\GitHub\Sema\CONTRIBUTING.md).

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
pacotes/padroes/       Funcoes auxiliares compartilhadas
testes/                Testes de unidade e integracao
```

## Estagio atual

O projeto esta em MVP funcional. A base do compilador existe, os exemplos obrigatorios foram modelados, os geradores para Python e TypeScript ja produzem esqueletos rastreaveis, e a CLI cobre validacao, AST, IR, compilacao, diagnosticos, teste e verificacao em lote.

## Roadmap resumido

- amadurecer a gramatica e enriquecer expressoes
- fortalecer o analisador semantico
- gerar contratos mais ricos para efeitos e garantias
- evoluir o suporte a `flow`, `route` e `state`
- adicionar integracao com IDE e saida JSON estavel para automacao

## Aviso importante

Este projeto esta em MVP. Ele ja serve como base real para construir a linguagem, mas ainda nao pretende ser uma implementacao final ou completa.

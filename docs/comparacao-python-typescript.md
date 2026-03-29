# Comparacao com Python e TypeScript

## Python

Python e excelente para expressividade e velocidade de implementacao, mas costuma deixar regra, contrato, efeito colateral e garantia espalhados entre funcoes, classes, validadores e comentarios. A Sema antecipa essa conversa na camada de especificacao.

Python continua importante na Sema como alvo de execucao. A diferenca e que o modulo `.sema` governa o contrato antes de o codigo Python aparecer.

## TypeScript

TypeScript melhora muito o jogo de tipos, mas nao trata como elemento nativo:

- efeitos colaterais
- garantias pos-execucao
- regras de negocio declaradas
- testes embutidos ligados ao contrato

A Sema usa TypeScript como destino confiavel, nao como ponto de partida semantico.


# Arquitetura Tecnica

## Pipeline

1. leitura do arquivo `.sema`
2. tokenizacao pelo `lexer`
3. parsing em AST
4. analise semantica
5. conversao para IR
6. geracao para Python ou TypeScript
7. emissao de diagnosticos

## Camadas

### `pacotes/nucleo`

Contem:

- `lexer`
- `parser`
- `ast`
- `semantico`
- `ir`
- `diagnosticos`

### `pacotes/gerador-typescript`

Transforma a IR em:

- interfaces de entrada e saida
- funcoes de validacao
- cascas de execucao
- testes em `node:test`

### `pacotes/gerador-python`

Transforma a IR em:

- `dataclasses`
- funcoes de validacao
- cascas de execucao
- testes com estilo `pytest`

### `pacotes/cli`

Expose os comandos reais para iniciar, validar, inspecionar AST, inspecionar IR, compilar e testar.


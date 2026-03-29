# CLI da Sema

## Comandos disponiveis

### `sema iniciar`

Cria uma estrutura minima de projeto com configuracao e exemplo inicial.

### `sema validar <arquivo-ou-pasta>`

Executa lexer, parser e analise semantica sem gerar codigo.

### `sema ast <arquivo.sema>`

Imprime a AST serializada em JSON.

### `sema ir <arquivo.sema>`

Imprime a representacao intermediaria semantica.

### `sema compilar <entrada> --alvo <python|typescript> --saida <diretorio>`

Gera artefatos compilados para o alvo escolhido.

### `sema gerar <python|typescript> <entrada> --saida <diretorio>`

Atalho para compilacao por alvo.

### `sema testar <arquivo.sema> --alvo <python|typescript> --saida <diretorio>`

Gera os artefatos de teste e tenta executa-los.

### `sema verificar <arquivo-ou-pasta> [--saida <diretorio-base>]`

Executa o fluxo completo de verificacao em lote:

- valida todos os arquivos `.sema`
- gera artefatos para TypeScript e Python
- executa os testes gerados para cada modulo
- imprime um resumo final com modulos, alvos, arquivos gerados e quantidade de testes

### `sema diagnosticos <arquivo.sema> [--json]`

Imprime diagnosticos em texto ou JSON, util para integracao com IDE e IA.

# AGENT_STARTER

Use este texto como starter curto para qualquer IA antes de editar `.sema`.

```text
Voce esta trabalhando com Sema, um Protocolo de Governanca de Intencao para IA e backend vivo.

Importante:
- a Sema e protocolo de governanca semantica, nao gerador magico que deveria fazer tudo
- a Sema modela contratos, estados, fluxos, erros, efeitos e garantias
- a Sema gera codigo e scaffolding real para TypeScript, Python e Dart
- a Sema usa `importar` para bootstrap revisavel, nao para contrato final automatico
- a Sema usa `drift` para medir diferenca entre contrato e codigo vivo
- a Sema usa `impl` para ligar task a simbolo real do runtime
- a Sema pode servir de base para interfaces graficas elegantes e coerentes
- a Sema nao gera uma interface completa sozinha no estado atual
- trate a Sema como cerebro semantico da aplicacao, nao como gerador magico de front-end pronto
- se a tarefa envolver UI, prefira pedir Sema + React + TypeScript ou Sema + arquitetura de front-end
- evite pedir HTML unico solto quando a intencao for testar a Sema de verdade

Regras:
- nao invente sintaxe fora da gramatica e dos exemplos oficiais
- trate `ir --json` como fonte de verdade semantica
- trate `diagnosticos --json` como fonte de correcao
- use `sema formatar` como fonte unica de estilo
- preserve a intencao do contrato
- nao cobre da Sema adivinhacao de negocio que nao esta no contrato nem no codigo

Comandos essenciais:
- contexto completo do modulo: `sema contexto-ia <arquivo.sema>`
- estrutura sintatica: `sema ast <arquivo.sema> --json`
- estrutura semantica: `sema ir <arquivo.sema> --json`
- validacao: `sema validar <arquivo.sema> --json`
- diagnosticos: `sema diagnosticos <arquivo.sema> --json`
- formatacao: `sema formatar <arquivo.sema>`
- importacao assistida de legado: `sema importar <nestjs|fastapi|flask|typescript|python|dart> <diretorio> --saida <diretorio>`
- geracao de codigo: `sema compilar <arquivo-ou-pasta> --alvo <typescript|python|dart> --saida <diretorio>`
- verificacao final: `sema verificar <arquivo-ou-pasta> [--json]`

Regra pratica de ouro:
- se a tarefa pedir codigo derivado, `sema compilar` e obrigatorio
- se a tarefa partir de projeto que nao nasceu com Sema, `sema importar` deve entrar antes da lapidacao semantica
- se a tarefa pedir apenas leitura ou correcao sem gerar codigo, `sema compilar` pode ficar fora

Antes de editar:
1. leia README, docs de IA e um exemplo oficial parecido
2. consulte AST e IR do modulo alvo

Depois de editar:
1. rode `sema formatar`
2. rode `sema validar --json`
3. se houver falha, use `diagnosticos --json`
4. se a tarefa pedir codigo derivado, rode `sema compilar`
5. feche com `sema verificar` ou `npm run project:check`

Priorize sempre:
- exemplos oficiais
- JSON da CLI
- consistencia semantica

Nao improvise quando faltar contexto.
```

Documentos de apoio:

- [como-ensinar-a-sema-para-ia.md](./como-ensinar-a-sema-para-ia.md)
- [prompt-base-ia-sema.md](./prompt-base-ia-sema.md)
- [fluxo-pratico-ia-sema.md](./fluxo-pratico-ia-sema.md)

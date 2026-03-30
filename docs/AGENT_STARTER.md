# AGENT_STARTER

Use este texto como starter curto para qualquer IA antes de editar `.sema`.

```text
Voce esta trabalhando com Sema, uma DSL semantica orientada a contrato e desenhada para ser entendida por IA.

Importante:
- a Sema modela contratos, estados, fluxos, erros, efeitos e garantias
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

Antes de editar:
1. leia README, docs de IA e um exemplo oficial parecido
2. consulte AST e IR do modulo alvo

Depois de editar:
1. rode `sema formatar`
2. rode `sema validar --json`
3. se houver falha, use `diagnosticos --json`
4. feche com `sema verificar` ou `npm run project:check`

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

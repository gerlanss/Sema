# AGENT_STARTER

Use este texto como starter curto para qualquer IA antes de editar `.sema`.

```text
Voce esta trabalhando com Sema, uma DSL semantica orientada a contrato e desenhada para ser entendida por IA.

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

- [como-ensinar-a-sema-para-ia.md](C:\GitHub\Sema\docs\como-ensinar-a-sema-para-ia.md)
- [prompt-base-ia-sema.md](C:\GitHub\Sema\docs\prompt-base-ia-sema.md)
- [fluxo-pratico-ia-sema.md](C:\GitHub\Sema\docs\fluxo-pratico-ia-sema.md)

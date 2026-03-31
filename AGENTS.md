# AGENTS.md

Sema e IA-first. Este repositorio nao foi desenhado para ergonomia humana como objetivo principal.

Se voce for uma IA, nao comece pelo codigo cru. Comece pela trilha canonica:

1. `llms.txt`
2. `SEMA_BRIEF.md`
3. `SEMA_INDEX.json`
4. `README.md`
5. `docs/AGENT_STARTER.md`

Roteamento por capacidade:

- IA pequena ou gratuita: `llms.txt` -> `SEMA_BRIEF.micro.txt` -> `SEMA_INDEX.json` -> `README.md`
- IA media: `llms.txt` -> `SEMA_BRIEF.curto.txt` -> `SEMA_INDEX.json` -> `README.md` -> `docs/AGENT_STARTER.md`
- IA grande ou com tool use: `llms-full.txt` -> `SEMA_BRIEF.md` -> `SEMA_INDEX.json` -> `README.md` -> `docs/AGENT_STARTER.md`

Fontes de verdade:

1. artefatos Sema gerados ou versionados na raiz
2. JSON da CLI
3. docs oficiais
4. exemplos oficiais
5. codigo vivo

Regras:

- trate a Sema como camada semantica para IA operar backend vivo com menos adivinhacao
- preserve contrato, vinculo, execucao, erro, efeito, garantia, score, confianca e lacunas
- se existir artefato Sema para a tarefa, use-o antes de abrir o codigo
- nao trate texto solto como mais confiavel que `drift`, `ir`, `diagnosticos` ou `briefing`
- se a IA for pequena, nao tente carregar AST e IR de cara
- nao invente sintaxe fora da gramatica oficial

Comandos minimos:

- `sema resumo <arquivo-ou-pasta> --micro --para mudanca`
- `sema prompt-curto <arquivo-ou-pasta> --curto --para review`
- `sema drift <arquivo-ou-pasta> --json`
- `sema contexto-ia <arquivo.sema> --saida ./.tmp/contexto --json`
- `sema validar <arquivo-ou-pasta> --json`
- `sema verificar <arquivo-ou-pasta> --json`

Se a tarefa envolver edicao real:

1. leia o menor artefato que resolver
2. suba para `drift` e `briefing` antes de editar
3. use `diagnosticos` para correcao
4. valide e verifique no fim

<!-- sema:agent-entrypoint:start -->
# Practical AI + Sema Workflow

This is the minimum workflow for agents in a local workspace.

1. Leia `SEMA_BOOT.md`.
2. Rode `sema --version`.
3. Rode `sema preflight resumo --json` e continue apenas se retornar `use_cli_local`.
4. Rode `sema resumo`.
5. Rode `sema docs-impacto --intencao "<acao>" --json`.
6. Leia a documentacao obrigatoria retornada.
7. Antes de escolher comando ou interpretar `--saida`, leia `docs/commands.md`.
8. Antes de criar ou editar contrato, use `exemplos/` e `docs/syntax.md`.
9. Antes de editar codigo existente, rode `sema drift` e `sema impacto`.
10. Depois de alterar `.sema`, rode `sema formatar` e `sema validar`.
11. Antes de concluir, rode `sema finalizar-mudanca` com as docs lidas.

Contract edit rule: `.sema` has its own size budget. Above 300 lines, plan a split by domain/capability; above 500, do not create or edit before splitting. Do not use parte_1/parte_2 and do not force a 1:1 contract-to-file relationship; several contracts can govern the same file through `vinculos`.

Closing rule: `sema drift --json` must return `sucesso:true`. If it reports `sucesso:false`, `vinculos_quebrados`, `rotas_divergentes`, or broken impls, the task is still blocked. Passing unit tests do not replace green drift.

UI rule: if the task involves an interface, minimum evidence includes desktop and mobile. On a narrow viewport such as 390px, `document.documentElement.scrollWidth <= document.documentElement.clientWidth` must pass; horizontal scroll blocks closure.

## Agent Capacity

- Weak agent: `SEMA_SMALL_MODEL.md`, `SEMA_BRIEF.micro.txt`, `AGENT_CONTEXT_PACK.json`, `SEMA_INDEX.json`.
- Medium agent: `SEMA_BOOT.md`, `AGENT_CONTEXT_PACK.json`, `SEMA_BRIEF.curto.txt`, `SEMA_INDEX.json`, `AGENTS.md`.
- Strong agent: `SEMA_BOOT.md`, `AGENT_CONTEXT_PACK.json`, `SEMA_BRIEF.md`, `SEMA_INDEX.json`, AST, IR, drift, and impact.

## When to Generate Code

If the delivery includes code derived from a contract, run `sema compilar`.

```bash
sema compilar contratos/orders.sema --alvo javascript --saida ./generated/javascript
```

Replace `javascript` with `typescript`, `python`, `php`, `dart`, `lua`, `html`, or `css` when appropriate.

## Fail Closed

- Se não conseguir chamar Sema, pare e declare bloqueio em vez de editar código ou contrato.
- Se não houver contrato aplicável ou vínculo semântico do arquivo, inspecione o arquivo, descubra ou crie o .sema aplicável e vincule antes do código.
- Em IDE local, rode sema --version; se falhar, pare. A IA não acessa o painel Sema: peça ao humano para instalar a CLI pelo painel. Depois rode sema preflight <comando> --json; só continue com use_cli_local; não use fonte externa de workspace para substituir a CLI local.
- Se não houver workspace local em disco, pare bloqueado e peça o fluxo apropriado; não invente caminho nem substitua a CLI local por ferramenta paralela.
- Se arquivos_codigo.conteudo ou conteudo inline passar de 262144 caracteres, não aumente timeout para forçar: divida por responsabilidade ou use anexo/caminho de servidor autorizado.
- Se for criar ou corrigir .sema, use sema_exemplos antes de escrever sintaxe.
- Se a resposta humana estiver em PT-BR, use vocabulário Sema canônico e preserve acentos mesmo que a DSL use ASCII.
- Se um arquivo de código tiver SEMA-GOVERNED, consulte Sema e o contrato aplicável antes de editar.
- Se codigo governado passar de 1000 linhas, planeje divisao; se passar de 2000, pare e divida antes de concluir. Documentacao Markdown nao entra nesse limite de codigo.
- Se contrato .sema passar de 300 linhas, planeje split por dominio/capacidade; acima de 500, criacao e edicao ficam bloqueadas. Nao use parte_1/parte_2 e nao remova guarantees, tests ou vinculos so para caber.
- Um mesmo arquivo de codigo pode ser governado por varios contratos .sema via vinculos; Sema Codigo deve preservar essa rastreabilidade.
- Se score, achados ou decisaoAgente parecerem bons, trate como sinal de triagem e confira evidência concreta no contrato e no código.
- Se validar artefato inline com 100/100, ainda preserve cabeçalho SEMA-GOVERNED no arquivo físico sincronizado.
- Se `sema drift` retornar sucesso:false, `vinculos_quebrados`, `rotas_divergentes` ou impls quebradas, a mudanca nao pode ser declarada concluida; corrija contrato/codigo e rode drift de novo.
- Se a tarefa tiver site, sistema, app, UI, painel, jogo, CLI/TUI ou terminal, nao conclua sem acabamento moderno, contextual e evidenciado; em UI mobile estreita (ex. 390px), `document.documentElement.scrollWidth <= document.documentElement.clientWidth` precisa ser verdadeiro.
- Se texto visivel PT-BR perder acento ou cedilha em termos como descricao, lancamentos, saude ou alimentacao, trate como defeito bloqueante quando houver i18n/idioma declarado.
- Se aparecer caminho que não pertence ao workspace local aberto pelo usuário, pare e confirme a fonte antes de agir.
- Se uma chamada Sema estourar por timeout local, aumente o timeout e tente de novo; timeout do agente não libera ação sem Sema.
- Se a plataforma bloquear ou alertar política, trate como bloqueio externo ou falso positivo possível; explique sem tentar contornar filtro.
- Se a tarefa tiver experiência de uso e você não conseguir garantir padrão moderno, contextual e não genérico, pare e peça revisão em vez de entregar coisa engessada.
<!-- sema:agent-entrypoint:end -->

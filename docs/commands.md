<!-- sema:agent-entrypoint:start -->
# Sema Command Catalog

Use this file when an AI agent does not know which command to run. A Sema command is an operational gate; do not replace it with a Markdown report.

## Minimum Local Flow

```bash
sema --version
sema preflight resumo --json
sema resumo
sema docs-impacto --intencao "<acao>" --json
```

Then read every required doc returned by `docs-impacto`.

## Contract and Discovery

- `sema iniciar --template <template>`: creates a new Sema project with a contract, docs, examples, and AI kit.
- `sema validar <arquivo-ou-pasta> --json`: validates `.sema` contracts.
- `sema diagnosticos <arquivo.sema> --json`: details errors and warnings.
- `sema formatar <arquivo-ou-pasta>`: formats contracts.
- `sema inspecionar <arquivo-ou-pasta> --json`: shows modules, tasks, routes, entities, links, and expected files.
- `sema ast <arquivo.sema> --json`: shows AST for syntax debugging.
- `sema ir <arquivo.sema> --json`: shows the IR used by gates and generators.

## Change and Closure

- `sema docs-impacto --intencao "<acao>" --json`: discovers required docs and documentary blockers.
- `sema drift <arquivo-ou-pasta> --escopo modulo --json`: compares contract and implementation.
- `sema impacto <arquivo-ou-pasta> --alvo <token> --mudanca "<descricao>" --json`: maps impact before changing behavior.
- `sema verificar <arquivo-ou-pasta> --json`: runs aggregated final verification.
- `sema finalizar-mudanca --intencao "<acao>" --doc-lida <arquivo> --json`: proves documentation reading before closure.

Honest closure: treat drift JSON as the source of truth. `sucesso:false`, `vinculos_quebrados`, `rotas_divergentes`, or broken impls mean the change is not complete yet. Do not report "clean drift" without green JSON.

## Sema Code

- `sema compilar <arquivo-ou-pasta> --alvo <typescript|python|dart|lua|javascript|html|css> --saida <diretorio>`: generates starter/support artifacts from the contract.
- `sema testar <arquivo.sema> --alvo <alvo> --saida <diretorio-temporario>`: generates and runs local tests when the target supports it.
- `sema importar <fonte> <diretorio> --saida <diretorio> --json`: imports a legacy project into initial contracts.
- `sema renomear-semantico <arquivo-ou-pasta> --de <nome> --para <nome> --json`: helps rename symbols semantically.

Rule for `--saida`: the folder passed to `sema compilar --saida` is generated output. It is not the final delivery by itself. The final delivery is the target files/links declared by the contract. If the contract asks for `index.html`, `css/styles.css`, and `js/app.js`, creating only `saida/expense_control.ts` does not complete the task.

Sema Code traceability rule: generated artifacts must point back to the source module/contract and preserve that the same final file may be governed by several `.sema` contracts through `vinculos`. Do not force a 1:1 contract-file relationship and do not treat `saida/` as the final project.

Ready UI rule: if the task generates an app, site, dashboard, form, or static HTML, run desktop/mobile visual validation when the surface allows it. On narrow mobile (for example 390px), `scrollWidth <= clientWidth` must pass; a layout that stacks but overflows horizontally is not responsive.

## Canonical Syntax Lists

- Origins for `use` and `impl`: `ts/typescript`, `js/javascript`, `py/python`, `dart`, `lua`, `cs/dotnet`, `java`, `go`, `rust`, `cpp`.
- Frequent `effects` categories: `persistencia`, `consulta`, `evento`, `auditoria`, `db.write`, `queue.publish`, `fs.write`, `network.egress`, `secret.read`, `shell.exec`.
- Accepted `audit.motivo` values: `obrigatorio`, `opcional`, `dispensado`.

`sema compilar --alvo javascript` is a generation target. `impl { js: ... }` is the live-code origin. Do not swap one for the other.

## AI and Context

- `sema ajuda-ia`: short guidance for agents.
- `sema starter-ia`: operational starter.
- `sema contexto-ia <arquivo.sema> --saida <dir> --json`: AI context package.
- `sema prompt-curto <arquivo-ou-pasta> --json`: compact prompt.
- `sema sync-ai-entrypoints --json`: synchronizes AGENTS, boot, pack, and local docs.
- `sema instalar-exemplos --json`: installs official examples in the workspace.
- `sema exemplos-prompt-ia`: shows prompt examples, not `.sema` examples.

## Profiles e Author

- `sema author iniciar|validar|briefing|revisar-cliches|validar-narrativa|validar-proibicoes`: governs authorial writing.
- `sema profile validar <software|workflow|ops|game|legal|research|redacao|propostas|conversas> <arquivo> --json`: validates an artifact by profile.
- `sema profile capabilities --json`: lists profiles/capabilities.
- `sema rule-packs --profile <profile> --json`: lists rule packs.

## Operational

- `sema doctor`: diagnoses local installation.

## Forbidden

- Do not use an external workspace source to inspect a local workspace when `sema --version` works.
- Do not search the entire disk for `.sema` syntax; use `exemplos/`, `docs/syntax.md`, and this catalog.
- Do not stop after `sema compilar` if the contract target files still do not exist.
- Do not replace `sema compilar` with `sema testar` when Guard asks for Sema Code.
- Do not create a Markdown report to pretend a gate ran.
- Do not say drift passed when `sema drift --json` returned `sucesso:false`, broken link, divergent route, or broken impl.
- Do not declare a UI responsive without mobile/desktop proof; horizontal scroll at 390px blocks closure.

Governed code policy: Arquivos de codigo gerados ou governados pela Sema devem manter cabecalho curto com modulo de origem, contrato .sema aplicavel e descricao humana. Validacao inline prova apenas o payload enviado; o arquivo fisico ainda precisa de SEMA-GOVERNED para orientar a proxima IA. Codigo governado avisa acima de 1000 linhas e bloqueia acima de 2000. Contrato .sema avisa acima de 300 linhas e bloqueia criacao, edicao, drift, finalizacao, geracao e snapshot acima de 500. O split de .sema deve ser por dominio/capacidade, nunca parte_1/parte_2; varios contratos podem governar o mesmo arquivo de codigo via vinculos. Sema Codigo deve preservar essa rastreabilidade em cabecalhos e saidas geradas. Documentacao Markdown nao entra nesse limite de codigo; continua governada por docs-impacto, limite de bytes e verificacao de segredos. Payload inline acima de 262144 caracteres nao e caso de aumentar timeout: divida por responsabilidade ou use anexo/caminho de servidor autorizado.
<!-- sema:agent-entrypoint:end -->

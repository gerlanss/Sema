# Sema

<p align="center">
  <img src="./logo.png" alt="Sema logo" width="240">
</p>

Sema is a local-first semantic governance layer for AI coding agents. It turns
human intent into explicit contracts, checks live code against them, generates
governed scaffolds and design systems, and keeps scope and evidence explicit
through implementation and closure.

`intent -> contract -> constraints -> impact -> execution -> evidence`

Proven with Claude, Codex, zCode (GLM) and Kimi. Sema is agent-neutral: the
generated workspace protocol is `AGENTS.md`, the cross-agent standard, and any
tool that reads it can operate under Sema governance.

## Why it exists

Agents on large projects invent interfaces, undo earlier decisions and declare
victory early. Not malice — statistics: context compaction loses the original
spec, attention dilutes into plausible generic code, and nothing measures the
gap between what the agent says it did and what it did. Sema makes that gap
structural: the contract is lossless ground truth outside the agent's context,
drift checks static references and recorded evidence. Application tests establish
behavior; the documentation closure gate checks declared readings and their hashes.
A passing score or documentation check does not prove that the application works.

Sema does not replace human approval, platform policy, security review, or
legal judgment. It is a local layer for scope, evidence, drift and quality.

## A contract, in one look

```sema
module curta.links {
  design {
    dominio: produto_dev
    identidade: cotidiano_preciso
    tokens {
      paleta: oceano
      tipografia: tecnica
      cor_primaria: "#0d9488"
      cor_fundo_escuro: "#042f2e"
    }
  }

  entity Link {
    fields {
      id: Id
      slug: Texto
      url: Texto
      cliques: Inteiro
    }
  }

  task criar_link {
    input {
      url: Texto required
    }
    output {
      link: Link
    }
    rules {
      url deve_ser preenchido
    }
    effects {
      persistencia Link
      auditoria link_criado
    }
    authz {
      escopo: curta.links.criar
    }
    dados {
      classificacao_padrao: interno
      redacao_log: parcial
    }
    forbidden {
      expor_url_completa
    }
    guarantees {
      link existe
    }
    impl {
      ts_rota: src.routes.links.criarLinkRoute
      ts_servico: src.services.links.criarLink
    }
  }

  route links_criar {
    metodo: POST
    caminho: /api/links
    task: criar_link
    finalidade: cadastro_link
  }
}
```

That single file declares the data, the rules, the authorization scope, the
data classification, what is forbidden, the guarantee, the layered
implementation binding (route + service) and the public route — plus the
visual identity of the interface it governs.

## What the CLI answers before code is touched

- which contract applies to the change, and which files are probably affected;
- whether code and contract have semantic drift — including live public routes
  across Express, Fastify, Koa, NestJS and Next.js (App and Pages Router,
  mounted routers and prefixes) and consumer surfaces such as React/Vite,
  Angular, SvelteKit, Nuxt and Flutter;
- which documentation must be read or updated, with blocking vs recommended
  relevance;
- what impact the proposed change has;
- whether a contract can generate starter code, executable tests and design
  tokens;
- whether executed tests actually back the contract score, instead of trusting
  declared blocks alone.

Every command speaks one stable eight-field JSON envelope (`sema.cli.result/v1`),
keeps `--help` side-effect free, and separates transport `ok` from the
command's own domain verdict. See [CLI](./docs/cli.md).

## Quickstart

Requires Node.js 20 or newer and a local project folder.

```bash
npm install -g @semacode/cli
sema skill status --json
```

A global install creates a managed launcher under `~/.sema/bin`, bundles the
official skill into `~/.agents/skills/sema`, and mirrors it to
`~/.claude/skills/sema` only when Claude is already configured. Open a new
agent task after installing; already-open agents do not reload skills
retroactively. On Windows, PowerShell resolves `sema.ps1` and cmd.exe resolves
`sema.cmd`; on macOS or Linux, `"$HOME/.sema/bin/sema" --version` is the
absolute fallback. The CLI needs no login, license check, activation key,
token or credits — commands run locally against your workspace.

Initialization creates configuration and agent rules, with demonstrations only
under `exemplos/`. It does not invent an order, ranking, or other business domain.
Create the contract for the actual request before implementing. Existing contracts
remain untouched; `sema init` remains the separate, explicit contract-template command.

The governed loop in a project:

```bash
sema iniciar --template base --janela-contexto 32768 # example: confirmed 32K window
sema sessao "describe the requested application" --json
# Model that request in contratos/app.sema before the implementation or checks below.
sema docs-impacto --intencao "describe the change" --arquivo contratos/app.sema --json
# Keep mudancaId and the returned proximasChamadas argument arrays.
sema validar contratos/app.sema --json
sema drift contratos/app.sema --escopo modulo --cache fresh --pacote --json
sema compilar contratos/app.sema --alvo typescript --saida .tmp/scaffold
sema verificar contratos --alvo typescript --json   # executes the contract tests
sema finalizar-mudanca --mudanca-id <returned-id> --doc-lida <read-doc> --json
# Repeat --doc-lida for required documents actually read.
```

After compaction, resume `sema sessao --mudanca-id <returned-id> --json`.
The id preserves intention and target files. Reading declarations are reused only
while file hashes match; they do not attest comprehension or replace tests.

Confirm the model's effective configured context window before initialization;
32,768 above is an example, not a default. Without that value, initialization
asks for it before creating files. Sessions apply a configurable response
budget and expand through relevant contracts and declared dependencies.
`SEMA_INDEX.json` and `AGENT_CONTEXT_PACK.json` are internal CLI databases,
not mandatory full reads. The character-based estimate covers the session
response, not the agent's entire conversation or exact tokenizer usage.

`sema sessao` is the opening move for agents: one compact envelope with the
workspace's contract hash, artifact freshness, the docs that block the declared
intent, and the exact gate commands for the loop. A stale artifact flag is a
pre-action blocker — sync first, then act.

`resumo` and `inspecionar` skip drift by default and leave unobserved evidence
as `null`, never fabricated. Drift cache lives outside the workspace and is
acceleration, not proof — closure evidence is always recalculated fresh.

## Watch it work (2:58)

https://github.com/user-attachments/assets/62308e14-7e57-4073-8945-c1801bf81498

You tell your agent what you want. Instead of rediscovering the repository on
every task, the agent uses Sema's living semantic map to reach the relevant
code. In this real red-to-green demo, Sema catches a partial payment rename,
preserves the `receipt_id` guarantee, and verifies contract, code, tests,
drift and documentation before closing the change.
**[Watch on YouTube](https://youtu.be/IXkIlC9FxIs)**

## Code generation and verification

The prescribed agent flow is scaffold-first: declare the contract, validate
it, generate the scaffold, fill the real implementation while keeping
`impl`/`vinculos` wired, and close with executed evidence.

```bash
sema compilar contratos/app.sema --alvo typescript --saida .tmp/scaffold --estrutura modulos
sema importar express src --json
```

- **Ten targets**: TypeScript, JavaScript, Python, PHP, Dart, Lua, HTML, CSS,
  C#/.NET and C++. Native targets emit self-contained projects and executable
  contract tests (`dotnet` uses the local .NET SDK; `cpp` uses GCC, Clang or
  MSVC).
- **Layered bindings**: one task binds route, service and persistence through
  roles (`ts_rota`, `ts_servico`, `ts_persistencia`), so layered code stays
  traceable instead of half-declared.
- **Verification pays rent**: `sema verificar` generates and actually executes
  the contract tests, accepts `--alvo` for a single target, and keeps an
  incremental cache outside the workspace keyed by CLI version, Node version
  and contract content. The drift score consumes that evidence — tasks with
  real passing tests earn bonus points; public tasks without verification
  surface the `sem_evidencia_verificada` gap.
- **Legacy drafting**: `sema importar express|fastify|koa` reads handlers,
  routes and schemas and infers body, query and response shapes into contract
  drafts.

## Contract-first visual identity

Modules with a user interface declare their own identity in the `design`
block — domain, identity name, and tokens with curated presets plus free
overrides. Each agent crafts a distinct interface instead of regressing to
one standard look:

- eight palettes, four typographies, three densities, four shapes and three
  motion presets, all overridable (`cor_primaria: "#7c2d12"`, fonts, radii);
- every palette ships a full dark set, with dark-specific overrides
  (`cor_fundo_escuro`), so light and dark are two faces of one declared
  identity;
- compilation materializes one declaration into six token packages —
  `design-tokens.css`, `tokens.ts`, `tokens.js`, `_tokens.scss`,
  `tailwind.theme.js` and `theme-tui.json` — covering vanilla CSS,
  React/Vue/Svelte/Angular themes, SCSS, Tailwind and terminal UIs;
- drift warns `design_nao_declarado` when a module exposes UI routes without
  a declared identity.

## Agents and `AGENTS.md`

The CLI is the local engine and source of truth. `AGENTS.md` is the
cross-agent workspace protocol Sema generates; agent tools that read it —
Claude, Codex, zCode (GLM) and Kimi among them — operate under the same
governance. The bundled skill handles first contact in projects that do not
have Sema yet. Load it before creating or editing software, even for a small
static app and without naming Sema in the request. On first use in a project,
it asks whether the user wants adoption and waits. After acceptance it confirms
the effective context window, generates `AGENTS.md`, then delegates to it.
Existing Sema projects do not need adoption again. Installing the CLI never
authorizes adoption by itself. `formatar` and `validar` operate on contracts;
they do not adopt the workspace or test the application. Automatic skill
selection still depends on client discovery and model behavior.

```bash
sema iniciar --template base --janela-contexto 32768
sema sync-codex --json      # regenerates AGENTS.md and context artifacts
```

Initialization preserves existing files; `--force` is never automatic, and
symlinks or junctions below the workspace boundary are rejected. The npm
lifecycle owns only the managed launcher and skill directories — never plugin
caches, credentials, the workspace or `CODEX_HOME`. `sema skill status --json`
is read-only; `sema skill sync --json` repairs after an `--ignore-scripts`
install. A Codex plugin channel is optional:

```bash
codex plugin marketplace add gerlanss/Sema
codex plugin add sema@sema
```

Sema is an independent product, not affiliated with or endorsed by OpenAI,
Anthropic, Z.ai or Moonshot. Agent names appear here only to state proven
compatibility.

## Capability discovery

An explainable catalog lets an agent distinguish governance flows, validation
profiles, workflows, orchestration pipelines, generators and adapters before
choosing one:

```bash
sema descobrir recomendar --intencao "validate an autonomous calibrated 3D simulator" --json
sema interativo pipelines --json
```

Catalog entries are descriptors, not proof anything ran; control-run
validation keeps `completed: false` until external trust attests the run.
See [Capability Discovery](./docs/descoberta-capacidades.md) and
[Interactive Systems](./docs/sistemas-interativos.md).

## Public boundary

- commands execute locally against your workspace filesystem — no login,
  license check, activation key, token, credits or control panel;
- `AGENTS.md` is the official cross-agent entrypoint;
- the public package ships without secrets or private operational state;
- public docs are written in English.

Official support: [suporte@otimitare.com](mailto:suporte@otimitare.com)

## Commercial use

Sema is public source, but not a free commercial resale asset. You may use,
study, modify and share it under the license terms; you may not resell it,
rebrand it as a competing product, offer it as a commercial replica, or bundle
it as a material paid feature without written permission from OtimiTare.
Commercial licensing: [suporte@otimitare.com](mailto:suporte@otimitare.com).

## Useful commands

```bash
sema ajuda-ia
sema starter-ia
sema prompt-curto contratos/app.sema --json
sema contexto-ia contratos/app.sema --saida .tmp/contexto --json
sema verificar contratos --alvo typescript --saida .tmp/verificacao --json
sema importar fastify src --json
```

## License

See [LICENSE](./LICENSE). The license allows public non-commercial use and
prohibits commercial resale or commercial replicas without written permission.

### Context delivery

The CLI selects context artifacts before writing them. Windows up to 32,768 tokens
select micro summaries; up to 131,072 select short summaries; larger windows can
select expanded summaries. These are generation thresholds, not model intelligence
ratings. The configured budget can reduce the selected level further. Only the selected
file is materialized, and unrelated modules are not added to a task session.

`AGENTS.md` and `SEMA_BOOT.md` are counted once alongside the current delivery.
This estimate uses characters / 4, not the model tokenizer, and does not measure host
instructions, chat history, subsequent code reads or cumulative tool output.
A task session does not require another summary when it already supplied the necessary context.
Oversized requests fail with a refinement instruction instead of silently discarding blocking rules.

When the profile changes, synchronization replaces the selected summary and removes
inactive generated variants from the entry files. A byte-preserving backup under
`.sema/contexto-legado/` protects existing edits; unrelated manual files remain untouched.
Internal indexes remain CLI databases, not agent reading lists.

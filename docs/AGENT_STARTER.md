# AGENT_STARTER

Use este texto como starter curto para qualquer IA antes de editar `.sema`.

Ordem canonica de entrada no repo:

1. `llms.txt`
2. `SEMA_BRIEF.md`
3. `SEMA_INDEX.json`
4. `AGENTS.md`
5. `README.md`

Roteamento por capacidade:

- IA pequena ou gratuita: `llms.txt` -> `SEMA_BRIEF.micro.txt` -> `SEMA_INDEX.json`
- IA media: `llms.txt` -> `SEMA_BRIEF.curto.txt` -> `SEMA_INDEX.json` -> `README.md`
- IA grande ou com tool use: `llms-full.txt` -> `SEMA_BRIEF.md` -> `SEMA_INDEX.json` -> `AGENTS.md` -> `README.md`

Tres modos de uso da Sema:

- projeto novo: modele, valide, compile e verifique antes de subir codigo derivado
- projeto ja semantizado: inspecione, leia resumo, rode drift e gere contexto antes de editar
- legado sem Sema: importe, revise o rascunho, formate, valide e use drift como arbitro da adocao incremental

Para manter os artefatos gerados da raiz sincronizados:

- `sema sync-ai-entrypoints --json`

```text
Voce esta trabalhando com Sema, um Protocolo de Governanca de Intencao para IA sobre software vivo em backend e front consumer.

Importante:
- a Sema e protocolo de governanca semantica desenhado para IA, nao para ergonomia humana
- a Sema funciona como camada de navegacao operacional para agente, nao como runtime magico
- leitura humana e bonus toleravel, nao centro do produto
- a Sema modela contratos, estados, fluxos, erros, efeitos, garantias, vinculos e execucao
- a Sema gera codigo e scaffolding real para TypeScript, Python e Dart
- a Sema usa `importar` para bootstrap revisavel, nao para contrato final automatico
- a Sema usa `drift` para medir diferenca entre contrato e codigo vivo
- a Sema usa `impl` para ligar task a simbolo real do runtime
- a Sema usa `resumo` e `prompt-curto` para IA pequena ou gratuita
- a Sema pode servir de base para interfaces graficas elegantes e coerentes
- a primeira onda consumer oficial agora cobre `Next.js consumer`, `React/Vite consumer`, `Angular consumer` e `flutter-consumer`
- esses slices oficiais cobrem `consumer bridge + superficies rastreaveis`, nao geracao completa de UI
- a proxima camada semantica de front (`screen`, `action`, `query`, `form`, `navigation`) esta documentada como roadmap, nao como sintaxe oficial ja suportada
- trate a Sema como cerebro semantico da aplicacao, nao como gerador magico de front-end pronto
- nao cobre da Sema persistencia real, runtime ou smoke test automatico; isso continua sendo engenharia viva
- se a tarefa envolver UI, priorize `appRoutes`, `consumerSurfaces` e `consumerBridges` antes de abrir arquivo aleatorio
- evite pedir HTML unico solto quando a intencao for testar a Sema de verdade

Regras:
- nao invente sintaxe fora da gramatica e dos exemplos oficiais
- se a IA for pequena, comece em `sema resumo` e `briefing.min.json`
- trate `ir --json` como fonte de verdade semantica
- trate `diagnosticos --json` como fonte de correcao
- use `sema formatar` como fonte unica de estilo
- preserve a intencao do contrato
- nao cobre da Sema adivinhacao de negocio que nao esta no contrato nem no codigo

Comandos essenciais:
- resumo por capacidade: `sema resumo <arquivo-ou-pasta> [--micro|--curto|--medio] [--para <resumo|onboarding|review|mudanca|bug|arquitetura>]`
- prompt curto: `sema prompt-curto <arquivo-ou-pasta> [--micro|--curto|--medio] [--para <resumo|onboarding|review|mudanca|bug|arquitetura>]`
- contexto completo do modulo: `sema contexto-ia <arquivo.sema>`
- estrutura sintatica: `sema ast <arquivo.sema> --json`
- estrutura semantica: `sema ir <arquivo.sema> --json`
- validacao: `sema validar <arquivo.sema> --json`
- diagnosticos: `sema diagnosticos <arquivo.sema> --json`
- formatacao: `sema formatar <arquivo.sema>`
- importacao assistida de legado: `sema importar <nestjs|fastapi|flask|nextjs|nextjs-consumer|react-vite-consumer|angular-consumer|flutter-consumer|firebase|typescript|python|dart|dotnet|java|go|rust|cpp> <diretorio> --saida <diretorio>`
- geracao de codigo: `sema compilar <arquivo-ou-pasta> --alvo <typescript|python|dart> --saida <diretorio>`
- verificacao final: `sema verificar <arquivo-ou-pasta> [--json]`

Regra pratica de ouro:
- se a tarefa pedir codigo derivado, `sema compilar` e obrigatorio
- se a tarefa partir de projeto que nao nasceu com Sema, `sema importar` deve entrar antes da lapidacao semantica
- se a tarefa pedir apenas leitura ou correcao sem gerar codigo, `sema compilar` pode ficar fora

Antes de editar:
1. leia README, docs de IA e um exemplo oficial parecido
2. se a IA for pequena, rode `sema resumo <arquivo> --micro`
3. se a tarefa pedir contexto mais rico, consulte `drift`, `briefing.min.json` e depois AST/IR

Depois de editar:
1. rode `sema formatar`
2. rode `sema validar --json`
3. se houver falha, use `diagnosticos --json`
4. se a tarefa pedir codigo derivado, rode `sema compilar`
5. feche com `sema verificar <arquivo-ou-pasta> --json`

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

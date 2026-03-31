# Integracao com IA

A Sema foi desenhada para IA editar backend vivo com menos chute. O ponto nao e "a IA gera tudo"; o ponto e deixar contrato, vinculo e contexto operacional estruturados o bastante para a IA nao trabalhar igual um bicho tonto. Leitura humana continua possivel, mas nao e o centro do desenho.

## Moldura correta

Se uma IA tratar a Sema como enfeite declarativo, ela vai usar mal. A moldura certa e esta:

- `impl` liga intencao a simbolo executavel
- `vinculos` ligam contrato a arquivo, simbolo, recurso e superficie real
- `execucao` explicita timeout, retry, compensacao e criticidade
- `drift` mede verdade contra codigo vivo
- `contexto-ia` empacota briefing operacional antes da edicao

Em resumo: a Sema nao serve para a IA adivinhar melhor. Ela serve para a IA precisar adivinhar menos.

## Fluxo recomendado

Quando o trabalho cair em projeto vivo, o fluxo canonico agora e:

```bash
sema inspecionar . --json
sema resumo contratos/modulo.sema --micro --para mudanca
sema drift contratos/modulo.sema --json
sema contexto-ia contratos/modulo.sema --saida ./.tmp/contexto --json
```

Leitura rapida:

1. `inspecionar` descobre base do projeto, diretorios de codigo, fontes legado e modulos relevantes.
2. `resumo` entrega o menor cartao semantico util para a IA atual.
3. `drift` mede impls, vinculos, rotas, recursos, score semantico e confianca.
4. `contexto-ia` gera o pacote que a IA deveria ler antes de editar.

## Capacidade da IA

A Sema agora assume explicitamente que nem toda IA aguenta o pacote completo.

- IA pequena ou gratuita: comece em `resumo.micro.txt`, `briefing.min.json` e `prompt-curto.txt`
- IA media: suba para `resumo.curto.txt`, `briefing.min.json` e `drift.json`
- IA grande ou com tool use: leia `README.md`, `resumo.md`, `briefing.json`, `drift.json`, `ir.json` e `ast.json`

Se voce joga `ast.json` inteiro em modelo pequeno e depois reclama da resposta, foi voce que fez cagada operacional.

## O que a IA deve consumir

No minimo, para IA pequena:

- `resumo.micro.txt`
- `briefing.min.json`

No minimo, para IA media:

- `resumo.curto.txt`
- `briefing.min.json`
- `drift.json`

No minimo, para IA grande:

- `ir.json`
- `drift.json`
- `briefing.json`
- o proprio contrato `.sema`

O `briefing.json` agora e a peca mais operacional do pacote. Ele responde perguntas que agente serio precisa responder antes de mexer em codigo:

- o que tocar
- o que validar
- o que esta frouxo
- o que foi inferido
- quais simbolos estao relacionados
- quais superficies publicas podem ser afetadas
- quais testes minimos rodar

## Saida relevante do pacote `contexto-ia`

Hoje o pacote pode incluir:

- `resumo.micro.txt`
- `resumo.curto.txt`
- `resumo.md`
- `briefing.min.json`
- `prompt-curto.txt`
- `ast.json`
- `ir.json`
- `diagnosticos.json`
- `drift.json`
- `briefing.json`
- `README.md`
- `impl.<origem>.txt` quando existir implementacao vinculada

## Score, confianca e risco

`drift`, `inspecionar` e `contexto-ia` passam a expor sinais que ajudam a IA a nao tratar rascunho como verdade absoluta:

- `scoreSemantico`
- `confiancaVinculo`
- `riscoOperacional`
- `lacunas`
- `vinculos_validos`
- `vinculos_quebrados`

Leitura pratica:

- score alto + confianca alta: a IA pode editar com trilha boa
- score medio: ainda precisa ler contrato e conferir codigo vivo
- vinculo quebrado: a IA deve reduzir ousadia e consertar rastreabilidade antes de refatorar igual doida

## Superficies que a IA pode esperar

A linguagem agora trata estas bordas como primeira classe:

- `route`
- `worker`
- `evento`
- `fila`
- `cron`
- `webhook`
- `cache`
- `storage`
- `policy`

Isso importa porque backend real nao vive so de HTTP. Se a IA vai editar stack viva, ela precisa enxergar job, evento, webhook e recurso assincrono como parte do contrato, nao como sobra esquecida no runtime.

## Contrato operacional

Dentro de `task` e superficies, a IA deve prestar atencao em:

- `input`
- `output`
- `effects`
- `impl`
- `vinculos`
- `execucao`
- `guarantees`
- `error`

Exemplo minimo:

```sema
task medir_drift {
  input {
    contrato: Texto required
  }
  output {
    score: Decimal
  }
  impl {
    ts: cli.src.drift.analisarDriftLegado
  }
  vinculos {
    arquivo: "pacotes/cli/src/drift.ts"
    simbolo: cli.src.drift.analisarDriftLegado
  }
  execucao {
    timeout: "30s"
    retry: "3x exponencial"
    criticidade_operacional: alta
  }
  guarantees {
    score existe
  }
}
```

## Comandos que agente serio nao deveria ignorar

- `sema ast arquivo.sema --json`
- `sema ir arquivo.sema --json`
- `sema validar arquivo.sema --json`
- `sema diagnosticos arquivo.sema --json`
- `sema formatar arquivo.sema`
- `sema inspecionar [arquivo-ou-pasta] --json`
- `sema drift [arquivo-ou-pasta] --json`
- `sema contexto-ia arquivo.sema [--saida <diretorio>] --json`
- `sema verificar [arquivo-ou-pasta] --json`

## Fluxos comuns

Quando a tarefa for so modelagem:

```bash
sema ast contratos/pedidos.sema --json
sema ir contratos/pedidos.sema --json
sema formatar contratos/pedidos.sema
sema validar contratos/pedidos.sema --json
```

Quando a tarefa envolver codigo derivado:

```bash
sema inspecionar . --json
sema drift contratos/pedidos.sema --json
sema contexto-ia contratos/pedidos.sema --saida ./.tmp/contexto-pedidos --json
sema compilar contratos/pedidos.sema --alvo typescript --framework nestjs --estrutura backend --saida ./generated/nestjs
```

Quando a tarefa nasce num legado:

```bash
sema importar flask ./backend-flask --saida ./sema/importado --json
sema formatar ./sema/importado
sema validar ./sema/importado --json
sema drift ./sema/importado --json
```

## Showcase oficial do repo

Se voce estiver no monorepo da Sema, o showcase [showcases/ranking-showroom](../showcases/ranking-showroom/) continua sendo a melhor vitrine do fluxo completo:

```bash
cd showcases/ranking-showroom
sema inspecionar . --json
sema drift contratos/ranking_showroom.sema --json
sema contexto-ia contratos/ranking_showroom.sema --saida ./.tmp/contexto-ranking --json
```

O valor aqui nao e so "validou". O valor e sair com score, confianca, drift e briefing suficientes para editar o backend Flask real sem sair cavando arquivo a esmo.

## Fechamento operacional

Quando a IA terminar a mudanca fora do monorepo:

```bash
sema formatar contratos/modulo.sema
sema validar contratos/modulo.sema --json
sema verificar contratos --json --saida ./.tmp/verificacao-final
```

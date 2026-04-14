# Scorecard de Compatibilidade

O scorecard da Sema mede quanto do contrato esta realmente sustentado pelo codigo vivo e pela engine declarada.

## Estados de compatibilidade

- `nativo`: o recurso existe de forma direta na engine alvo
- `adaptado`: existe, mas depende de adapter ou convencao adicional
- `parcial`: existe so em parte, com restricao relevante
- `invalido`: o contrato pediu algo que a engine nao oferece do mesmo jeito

## O que entra no score

- presenca de `impl`
- presenca de `vinculos`
- match de rotas, workers e superficies publicas
- match de recursos vivos de persistencia
- lacunas semanticas abertas
- incompatibilidades declaradas entre contrato e engine

## Matriz curta de orquestracao

| Runtime | Onde encaixa bem | Onde exige adapter | Alertas comuns |
|---|---|---|---|
| `n8n` | `webhook`, `cron`, HTTP, branching, transformacao de payload | `worker`, `evento`, `fila`, `retry`, `segredos` | nao fingir equivalencia total para `authz`, `dados`, `audit`, `compensacao`, `guarantees` |

## Regua inicial para `n8n`

Leitura oficial inicial para o scorecard de orquestracao:

- `nativo`: `webhook`, `cron`, chamadas HTTP, branching e transformacao
- `adaptado`: `worker`, `evento`, `fila`, `retry`, `segredos` e idempotencia guiada por convencao externa
- `parcial`: `authz`, classificacao de dados, auditoria forte, compensacao e `guarantees`
- `invalido`: quando o contrato exigir semantica transacional, politica forte ou isolamento operacional que o runtime nao sustenta do mesmo jeito

## Principio de produto

Compatibilidade com `n8n` nao significa que a Sema passa a modelar node por node. O contrato continua sendo a fonte da verdade, e o runtime entra como alvo adaptado de orquestracao.

## Matriz curta de persistencia

| Engine | Recursos fortes | Alertas comuns |
|---|---|---|
| `postgres` | `table`, `relationship`, `query`, `index`, `capabilities` relacionais | diferencas entre contrato e schema real |
| `mysql` | `table`, `index`, `query` | suposicoes de consistencia e lock |
| `sqlite` | `table`, `retention` | portabilidade falsa de recursos enterprise |
| `mongodb` | `collection`, `document`, `query` em `pipeline` | transacao e relacao relacional declaradas sem base |
| `redis` | `keyspace`, `stream`, `retention` | uso de `table` ou `foreign key` em engine key-value |

## Objetivo do score

O score nao existe para punir o projeto. Ele existe para responder:

- o que esta realmente coberto
- o que esta so implicito
- onde a IA pode mexer com confianca
- onde a engine declarada nao bate com o contrato

# Sema com NestJS e Prisma

Este guia resume o que a Sema faz bem quando o projeto e um backend real com NestJS + Prisma, especialmente em dominio sensivel como pagamento, disputa, escrow e autenticacao.

## Onde a Sema brilha

### 1. Dominio antes do framework

Usar `Sema-primeiro` faz o time parar de sair codando igual um animal solto.

Antes de controller, DTO, service ou model do Prisma, a Sema ja te obriga a explicitar:

- quem entra
- o que sai
- quais regras precisam valer
- quais erros existem
- quais efeitos podem acontecer
- quais garantias precisam ser verdade no final

### 2. Erro conceitual aparece cedo

Em projeto com dinheiro, disputa e transicao de estado, bug semantico custa caro.

A Sema pega cedo coisas como:

- transicao invalida
- garantia falando de input como se fosse output
- erro publico fora do contrato da task
- flow referenciando etapa inexistente
- `use` quebrado

### 3. `sema compilar` economiza boilerplate real

Hoje a geracao ja entrega:

- contratos de entrada e saida
- classes/catalogo de erro
- validadores de `rules`
- verificadores de `guarantees`
- stubs de execucao
- adaptadores publicos
- testes iniciais

No modo backend-first, isso ainda pode gerar scaffold orientado a:

- NestJS
- FastAPI

### 4. `impl` encaixa bem com projeto vivo

Quando o backend ja existe, `impl` deixa claro onde a implementacao concreta mora.

Exemplo:

```sema
task criar_pedido {
  input {
    anuncio_id: Id required
    comprador_id: Id required
  }
  output {
    pedido_id: Id
  }
  impl {
    ts: pedidos.service.criarPedido
  }
  guarantees {
    pedido_id existe
  }
}
```

Leitura pratica:

- a Sema manda no contrato
- o NestJS continua mandando na execucao
- o Prisma continua mandando na persistencia

## Onde ela ainda pede atencao

### 1. `flow` ainda exige disciplina

`flow` ja ajuda bastante em backend critico, mas ainda nao e a parte mais maleavel da linguagem.

Ele funciona melhor quando voce quer:

- fluxo critico
- dependencia explicita
- tratamento de erro
- roteamento de sucesso/falha

Ele ainda nao e a melhor ferramenta para “orquestracao super esperta” com sintaxe frouxa.

### 2. Scaffold nao e backend pronto

A Sema ja saiu do modo “documentacao premium”, mas ainda nao substitui implementacao real.

Ela gera muito boilerplate util, mas nao toma conta sozinha de:

- banco
- concorrencia
- idempotencia
- seguranca
- observabilidade
- integracoes externas reais

### 3. `rules` e `guarantees` pedem semantica explicita

Sema nao e linguagem imperativa.

Ela espera coisas como:

- `canal existe`
- `valor > 0`
- `canal em [sms, email]`

E nao:

- `if (...)`
- inferencia solta
- literais jogados em `ou` sem repetir contexto

## Fluxo recomendado

### Projeto novo com NestJS

```bash
sema iniciar --template nestjs
sema inspecionar --json
sema validar contratos/pedidos.sema --json
sema compilar --framework nestjs
```

### Projeto NestJS existente

```bash
sema inspecionar --json
sema validar contratos/pedidos.sema --json
sema compilar --framework nestjs
```

Depois:

1. ligue a `task` ao service real com `impl`
2. mantenha Prisma na camada de persistencia
3. deixe a Sema governar contrato, estado, erro, efeito e garantia

## Onde vale muito a pena usar

- pagamento
- escrow
- disputa
- autorizacao
- autenticacao
- antifraude
- onboarding com estados sensiveis
- qualquer backend em que transicao errada custa dinheiro ou reputacao

## Onde eu nao venderia milagre

- CRUD bobo
- prototipo sem regra relevante
- backend que ainda nao sabe nem qual e o dominio
- geracao total sem implementacao humana

## Resumo brutal

Sema + NestJS + Prisma faz muito sentido quando o backend precisa de:

- contrato forte
- dominio claro
- menos improviso
- scaffold consistente
- integracao com IA sem entregar a ela um pantano semantico

Se a aplicacao e critica, a Sema para de parecer “formal demais” e comeca a parecer uma puta blindagem de arquitetura.

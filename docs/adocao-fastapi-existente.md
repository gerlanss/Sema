# Adocao em FastAPI Existente

Este guia cobre o caso em que o backend Python ja esta vivo e voce quer usar a Sema para parar de esconder contrato em service, schema e comentario espalhado.

## Estrategia recomendada

A adocao segura e incremental:

1. escolha um fluxo ou modulo sensivel
2. modele esse contrato em `.sema`
3. gere scaffold com `--framework fastapi`
4. conecte a implementacao existente via `impl`
5. use a Sema para governar o significado, nao para apagar o projeto inteiro

## Estrutura minima sugerida

```text
contratos/
  pagamentos.sema
app/
tests/
sema.config.json
```

## Exemplo de configuracao

```json
{
  "origens": ["./contratos"],
  "saida": "./generated/fastapi",
  "alvos": ["python"],
  "alvoPadrao": "python",
  "estruturaSaida": "backend",
  "framework": "fastapi",
  "modoEstrito": true,
  "diretoriosSaidaPorAlvo": {
    "python": "./generated/fastapi"
  }
}
```

## Fluxo pratico

### 1. Inspecionar

```bash
sema inspecionar --json
```

### 2. Validar contrato

```bash
sema validar contratos/pagamentos.sema --json
```

### 3. Gerar scaffold FastAPI

```bash
sema compilar --framework fastapi
```

### 4. Vincular implementacao real

```sema
task processar_pagamento {
  input {
    pagamento_id: Id required
  }
  output {
    protocolo: Id
  }
  impl {
    py: servicos.pagamentos.processar
  }
  guarantees {
    protocolo existe
  }
}
```

## O que o scaffold gera

- contrato Python derivado da Sema
- schemas Pydantic
- service layer inicial
- router FastAPI
- testes iniciais de scaffold

## O que continua manual

- repositorios
- acesso a banco
- gateways externos
- seguranca
- integracao com observabilidade

## Regra de ouro

Nao trate a Sema como "gerador de backend inteiro".

Use a linguagem para:

- travar dominio
- explicitar erro
- declarar efeito
- garantir pos-condicao
- reduzir improviso na borda

O FastAPI continua executando. A Sema continua mandando no significado.

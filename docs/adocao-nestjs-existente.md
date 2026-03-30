# Adocao em NestJS Existente

Este guia e para quando o projeto NestJS ja existe e voce quer encaixar a Sema sem reescrever tudo igual um doido.

## Estrategia recomendada

Use a Sema de forma incremental:

1. escolha um dominio ou fluxo critico
2. modele esse dominio em `.sema`
3. compile scaffold com `--framework nestjs`
4. ligue o contrato ao codigo real com `impl`
5. mova a verdade semantica aos poucos para a Sema

## Estrutura minima sugerida

```text
contratos/
  pedidos.sema
src/
  pedidos/
test/
sema.config.json
```

## Exemplo de configuracao

```json
{
  "origens": ["./contratos"],
  "saida": "./generated/nestjs",
  "alvos": ["typescript"],
  "alvoPadrao": "typescript",
  "estruturaSaida": "backend",
  "framework": "nestjs",
  "modoEstrito": true,
  "diretoriosSaidaPorAlvo": {
    "typescript": "./generated/nestjs"
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
sema validar contratos/pedidos.sema --json
```

### 3. Gerar scaffold NestJS

```bash
sema compilar --framework nestjs
```

### 4. Ligar a implementacao existente

```sema
task criar_pedido {
  input {
    total: Decimal required
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

## O que entra no projeto existente

O scaffold gerado entra como:

- contrato forte
- DTOs coerentes
- service/controller base
- mapeamento publico
- testes iniciais

O codigo manual existente continua:

- integracoes reais
- repositorios
- providers
- infraestrutura

## Regra de ouro

Nao tente migrar o backend inteiro numa paulada so.

O caminho menos burro e:

- escolher um contexto de dominio
- provar valor ali
- expandir depois

Se a Sema estiver governando os pontos mais sensiveis de contrato, erro, efeito e garantia, ela ja esta fazendo trabalho de gente grande.

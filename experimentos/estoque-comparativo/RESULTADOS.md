# Resultado do Experimento

Comando executado:

```bash
node --import tsx experimentos/estoque-comparativo/avaliar.ts
```

Resumo objetivo:

- `SEMA BAIXO`: `3/10`
- `SEMA MEDIO`: `10/10`
- `SEMA ALTO`: `10/10`
- `SEM SEMA`: `3/10`

## O que o teste cobrou

1. criar produto valido
2. rejeitar categoria invalida
3. rejeitar `estoque_minimo` ausente
4. usar erro semantico `produto_nao_encontrado`
5. respeitar `quantidade <= estoque_minimo` no filtro de estoque baixo
6. calcular `total_geral` corretamente
7. agrupar `valor_por_categoria` com as chaves corretas
8. atualizar produto existente
9. remover produto existente
10. manter listagem final consistente

## Leitura do resultado

### `SEMA BAIXO`

Passou no basico operacional, mas inventou regra e comportamento:

- aceitou categoria fora do contrato
- aceitou `estoque_minimo` ausente
- usou erro generico em vez de erro semantico
- aplicou threshold fixo para estoque baixo
- nao agrupou valor por categoria

### `SEMA MEDIO`

Fechou tudo com custo de contexto menor que o pacote completo.

Foi a melhor relacao entre:

- fidelidade ao contrato
- custo de contexto
- previsibilidade da implementacao

### `SEMA ALTO`

Tambem fechou tudo, usando:

- contrato Sema
- artefatos completos de contexto
- codigo TypeScript gerado pela CLI
- validadores e garantias runtime do codigo gerado

Isso reforca a tese de que o modo alto e o caminho de menor risco quando a margem para improviso precisa ser proxima de zero.

### `SEM SEMA`

Entregou operacao basica, mas inventou decisao fora do contrato:

- categoria livre
- default de `estoque_minimo`
- erro diferente do esperado
- filtro de estoque baixo com regra diferente
- chaves de agrupamento fora do shape canonico

## Conclusao

Neste experimento controlado:

- `SEMA MEDIO` foi o melhor custo-beneficio
- `SEMA ALTO` foi o mais fiel e o menos arriscado
- `SEMA BAIXO` foi bom como rascunho, mas perigoso para contrato real
- `SEM SEMA` funcionou, mas com alta taxa de invencao semantica

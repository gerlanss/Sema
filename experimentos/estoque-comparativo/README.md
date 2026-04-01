# Experimento Controlado: Estoque em 4 Abordagens

Este experimento compara quatro formas de implementar o mesmo sistema:

- `sema-baixo`: implementacao limitada pelo contexto `micro`
- `sema-medio`: implementacao guiada pelo contexto `curto`
- `sema-alto`: implementacao usando contrato Sema + artefatos completos + codigo gerado
- `sem-sema`: implementacao manual a partir de descricao natural

O objetivo aqui nao e provar que "uma gera mais linhas".
O objetivo e medir onde cada abordagem:

- acerta o contrato
- inventa regra
- falha em reprodutibilidade
- segura manutencao futura

Arquivos principais:

- `contratos/controle_estoque.sema`
- `implementacoes/*.ts`
- `avaliar.ts`

Comandos uteis:

```bash
node pacotes/cli/dist/index.js resumo experimentos/estoque-comparativo/contratos/controle_estoque.sema --micro --para mudanca --saida experimentos/estoque-comparativo/artefatos/baixo
node pacotes/cli/dist/index.js resumo experimentos/estoque-comparativo/contratos/controle_estoque.sema --curto --para mudanca --saida experimentos/estoque-comparativo/artefatos/medio
node pacotes/cli/dist/index.js contexto-ia experimentos/estoque-comparativo/contratos/controle_estoque.sema --saida experimentos/estoque-comparativo/artefatos/alto --json
node pacotes/cli/dist/index.js compilar experimentos/estoque-comparativo/contratos/controle_estoque.sema --alvo typescript --saida experimentos/estoque-comparativo\generated
node --import tsx experimentos/estoque-comparativo/avaliar.ts
```

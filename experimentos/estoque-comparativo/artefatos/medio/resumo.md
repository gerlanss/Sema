# Resumo Sema para experimentos.estoque.controle

- Modo: `resumo`
- Gerado em: `2026-04-01T03:20:11.669Z`
- Arquivo: `C:\GitHub\Sema\experimentos\estoque-comparativo\contratos\controle_estoque.sema`
- Perfil: `publico`
- Score: `50`
- Confianca: `baixa`
- Risco operacional: `alto`

## O que este modulo faz

- governa 6 rota(s), 6 task(s) com foco em criar produto publico
- Superficies publicas: DELETE /produtos/{id}, GET /produtos, GET /produtos/{id}, GET /produtos/inventario/valor-total, POST /produtos, PUT /produtos/{id}
- Tarefas principais: criar_produto, listar_produtos, obter_produto, atualizar_produto, remover_produto, calcular_valor_total_inventario

## Contrato util para IA

- Entradas chave: criar_produto(nome, preco, quantidade, estoque_minimo), listar_produtos(categoria, apenas_estoque_baixo), obter_produto(id), atualizar_produto(id, nome, preco, quantidade)
- Saidas chave: criar_produto(produto), listar_produtos(resultado), obter_produto(produto), atualizar_produto(produto)
- Regras criticas: categoria em [ ELETRONICOS , ALIMENTOS , LIMPEZA , ESCRITORIO , OUTROS ], estoque_minimo >= 0, id existe, nome existe, preco > 0, produto existe (+2)
- Efeitos: auditoria produto_atualizado criticidade = media, auditoria produto_criado criticidade = media, auditoria produto_removido criticidade = media, auditoria valor_inventario_consultado criticidade = baixa, consulta estoque criticidade = baixa, persistencia estoque criticidade = alta
- Erros: nenhum
- Entidades afetadas: CategoriaProduto, estoque, ListaProdutos, Produto, produto_atualizado, produto_criado (+2)

## Consumer IA-first

- Framework consumer: nextjs-consumer
- Rotas de app: nenhum
- Superficies consumer: nenhum
- Bridges consumer: nenhum

## Intervencao segura

- Arquivos provaveis: C:\GitHub\Sema\experimentos\estoque-comparativo\implementacoes\sem-sema.ts, C:\GitHub\Sema\experimentos\estoque-comparativo\implementacoes\sema-baixo.ts, C:\GitHub\Sema\experimentos\estoque-comparativo\implementacoes\sema-medio.ts
- Simbolos relacionados: nenhum
- Riscos principais: altera_persistencia, atualizar_produto:alto, calcular_valor_total_inventario:medio, criar_produto:alto, efeito_critico, listar_produtos:medio
- Lacunas: execucao_implicita, sem_impl, sem_vinculos
- O que foi inferido: nenhum
- Checks sugeridos: revisar efeitos operacionais, rodar sema validar --json, verificar guarantees
- Testes minimos: sema drift <arquivo> --json, sema validar <arquivo> --json, sema verificar <arquivo-ou-pasta> --json

## Guia por capacidade de IA

### pequena

- IA gratuita ou com contexto curto. Leia so o cartao semantico e o briefing minimo.
- Artefatos: `resumo.micro.txt`, `briefing.min.json`, `prompt-curto.txt`
- Ordem de leitura: `resumo.micro.txt` -> `briefing.min.json` -> `resumo.curto.txt`
- Evitar: `ast.json`, `ir.json`, `diagnosticos.json`

### media

- IA com contexto medio. Aguenta resumo expandido, briefing minimo e drift.
- Artefatos: `resumo.curto.txt`, `briefing.min.json`, `drift.json`, `prompt-curto.txt`
- Ordem de leitura: `resumo.curto.txt` -> `briefing.min.json` -> `drift.json` -> `resumo.md`
- Evitar: `ast.json`

### grande

- IA com contexto grande ou tool use. Pode consumir o pacote completo.
- Artefatos: `README.md`, `resumo.md`, `briefing.json`, `drift.json`, `ir.json`, `ast.json`
- Ordem de leitura: `README.md` -> `resumo.md` -> `briefing.json` -> `drift.json` -> `ir.json` -> `ast.json`
- Evitar: nada obrigatorio

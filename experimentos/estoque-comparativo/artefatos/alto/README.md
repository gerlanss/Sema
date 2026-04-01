# Contexto de IA para experimentos.estoque.controle

- Arquivo alvo: `C:\GitHub\Sema\experimentos\estoque-comparativo\contratos\controle_estoque.sema`
- Modulo: `experimentos.estoque.controle`
- Sucesso em validar: `true`
- Quantidade de diagnosticos: `0`
- Gerado em: `2026-04-01T03:20:12.945Z`

## Arquivos gerados neste pacote

- `resumo.micro.txt`
- `resumo.curto.txt`
- `resumo.md`
- `briefing.min.json`
- `prompt-curto.txt`
- `validar.json`
- `diagnosticos.json`
- `ast.json`
- `ir.json`
- `drift.json`
- `briefing.json`

## Fluxo recomendado para o agente

### IA pequena ou gratuita

1. Ler `resumo.micro.txt`.
2. Ler `briefing.min.json`.
3. Se ainda couber contexto, ler `resumo.curto.txt`.

### IA media

1. Ler `resumo.curto.txt`.
2. Ler `briefing.min.json`.
3. Ler `drift.json`.
4. Se precisar, subir para `resumo.md`.

### IA grande ou com tool use

1. Ler `README.md`.
2. Ler `resumo.md`.
3. Ler `briefing.json`.
4. Ler `drift.json`.
5. So depois abrir `ir.json` e `ast.json`.

## Fechamento

1. Editar o arquivo `.sema`.
2. Rodar `sema formatar "C:\GitHub\Sema\experimentos\estoque-comparativo\contratos\controle_estoque.sema"`.
3. Rodar `sema validar "C:\GitHub\Sema\experimentos\estoque-comparativo\contratos\controle_estoque.sema" --json`.
4. Rodar `sema drift "C:\GitHub\Sema\experimentos\estoque-comparativo\contratos\controle_estoque.sema" --json`.
5. Fechar com `sema verificar <arquivo-ou-pasta> --json --saida ./.tmp/verificacao-ia`.

## Textos base para onboarding do agente

- `sema starter-ia`
- `sema resumo "C:\GitHub\Sema\experimentos\estoque-comparativo\contratos\controle_estoque.sema" --micro --para onboarding`
- `sema prompt-curto "C:\GitHub\Sema\experimentos\estoque-comparativo\contratos\controle_estoque.sema" --para mudanca`
- `sema prompt-ia`

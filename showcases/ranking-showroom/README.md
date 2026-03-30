# Ranking Showroom

Este showcase prova a tese central da Sema em um caso pequeno e reproduzivel: um backend Flask real, com `Blueprint`, `impl`, `drift` e contexto de IA, sem precisar inventar runtime novo nem reescrever a stack inteira.

## Problema

Em projeto vivo, o caos normalmente fica assim:

- OpenAPI diz uma coisa
- DTO solto diz outra
- comentario antigo diz merda nenhuma
- IA precisa farejar rota, handler e simbolo na unha

Aqui o contrato semantico vira a fonte de verdade acima do Flask, e a CLI fecha a ponte com o codigo vivo.

## Arquitetura minima

- `backend-flask/showcase_app/app_factory.py`: App Factory Flask
- `backend-flask/showcase_app/routes/api_ranking.py`: blueprint com rotas reais
- `contratos/ranking_showroom.sema`: contrato curado do showroom
- `sema.config.json`: base do projeto

## Walkthrough em 5 minutos

Na raiz deste showcase:

```bash
sema validar contratos/ranking_showroom.sema --json
sema inspecionar . --json
sema drift contratos/ranking_showroom.sema --json
sema contexto-ia contratos/ranking_showroom.sema --saida ./.tmp/contexto-ranking --json
```

Saida esperada:

- contrato valida sem erro
- `inspecionar` mostra `baseProjeto`, `diretoriosCodigo` e fonte `flask`
- `drift` resolve `impl` e rotas sem divergencia
- `contexto-ia` gera AST, IR, diagnosticos e `drift.json`

## O que isso prova

Este showcase deixa evidente algo que `OpenAPI + DTO + comentario espalhado` nao fecha tao bem:

- a intencao da operacao fica explicita
- `impl` aponta para simbolo vivo, nao para fantasia
- `drift` denuncia ruptura real entre contrato e backend
- a IA recebe um pacote operacional para editar sem sair igual barata tonta caçando handler

## Observacao honesta

Isto nao tenta ser app completo. O objetivo aqui e provar valor cirurgico:

- adocao incremental
- contrato + backend vivo
- Flask real
- governanca semantica acima da stack

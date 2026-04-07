# SEMA_BRIEF

Sema e IA-first. Este arquivo existe para IA achar o ponto de entrada do projeto sem ter que catar o repo inteiro feito barata tonta.

- Gerado em: `2026-04-03T14:43:39.329Z`
- Modulos: `4`

## Entrada canonica para IA

- Ordem minima: llms.txt -> SEMA_BRIEF.md -> SEMA_INDEX.json -> AGENTS.md -> README.md -> llms-full.txt
- IA pequena: llms.txt -> SEMA_BRIEF.micro.txt -> SEMA_INDEX.json -> AGENTS.md
- IA media: llms.txt -> SEMA_BRIEF.curto.txt -> SEMA_INDEX.json -> AGENTS.md -> README.md
- IA grande: llms-full.txt -> SEMA_BRIEF.md -> SEMA_INDEX.json -> AGENTS.md -> README.md

## Guia por capacidade

- pequena: IA gratuita ou com contexto curto. Leia so o cartao semantico e o briefing minimo. Artefatos: resumo.micro.txt, briefing.min.json, prompt-curto.txt.
- media: IA com contexto medio. Aguenta resumo expandido, briefing minimo e drift. Artefatos: resumo.curto.txt, briefing.min.json, drift.json, prompt-curto.txt.
- grande: IA com contexto grande ou tool use. Pode consumir o pacote completo. Artefatos: README.md, resumo.md, briefing.json, drift.json, ir.json, ast.json.

## Modulos

### app.pedidos
- Faz: governa 1 rota(s), 1 task(s) com foco em criar pedido publico
- Publico: POST /pedidos
- Tocar: nenhum
- Score: 35 | Confianca: media | Risco: alto
- Lacunas: sem_impl, vinculo_quebrado

### sema.produto.ergonomia_e_dominio
- Faz: governa 2 superficie(s), 5 task(s) com foco em scorecard atualizado
- Publico: evento:scorecard_atualizado, policy:compatibilidade_publica
- Tocar: c:\GitHub\Sema\pacotes\cli\src\projeto.ts, c:\GitHub\Sema\pacotes\nucleo\src\formatador\index.ts, c:\GitHub\Sema\pacotes\nucleo\src\ir\conversor.ts, c:\GitHub\Sema\pacotes\nucleo\src\semantico\analisador.ts
- Score: 90 | Confianca: alta | Risco: alto
- Lacunas: sem_impl, vinculo_quebrado

### sema.produto.governanca_ia
- Faz: governa 2 superficie(s), 4 task(s) com foco em preparar briefing contextual
- Publico: webhook:confirmar_contexto_publico, worker:preparar_briefing_contextual
- Tocar: c:\GitHub\Sema\pacotes\cli\src\drift.ts, c:\GitHub\Sema\pacotes\cli\src\index.ts, c:\GitHub\Sema\pacotes\cli\src\projeto.ts, c:\GitHub\Sema\pacotes\nucleo\src\formatador\index.ts
- Score: 90 | Confianca: alta | Risco: alto
- Lacunas: sem_impl, vinculo_quebrado

### sema.produto.linguagem_composta
- Faz: governa 1 superficie(s), 5 task(s) com foco em regressao composta
- Publico: storage:regressao_composta
- Tocar: c:\GitHub\Sema\pacotes\gerador-python\src\index.ts, c:\GitHub\Sema\pacotes\gerador-typescript\src\index.ts, c:\GitHub\Sema\pacotes\nucleo\src\formatador\index.ts, c:\GitHub\Sema\pacotes\nucleo\src\ir\conversor.ts (+1)
- Score: 90 | Confianca: alta | Risco: alto
- Lacunas: sem_impl, vinculo_quebrado

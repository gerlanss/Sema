# Prompt-Base Oficial para IA Trabalhar com Sema

Este arquivo serve como prompt-base oficial para qualquer IA que precise ler, escrever, revisar ou transformar arquivos `.sema`.

O objetivo nao e fazer a IA "improvisar bonito". O objetivo e fazer a IA operar a linguagem com previsibilidade.

## Prompt-base

Use o texto abaixo como base:

```text
Voce esta trabalhando com Sema, uma DSL semantica orientada a contrato, desenhada para facilitar entendimento e operacao por IA.

Trate a Sema como linguagem de especificacao executavel. Nao invente sintaxe, palavras-chave ou blocos fora da gramatica e dos exemplos oficiais.

Fontes de verdade, em ordem:
1. README do projeto
2. gramatica e documentacao de sintaxe da Sema
3. especificacao semantica da linguagem
4. exemplos oficiais, com prioridade para o vertical de pagamento
5. AST, IR e diagnosticos exportados pela CLI em JSON

Regras de operacao:
- preserve o significado semantico
- use o formatador oficial da Sema como fonte unica de estilo
- use diagnosticos estruturados como contrato de correcao
- use a IR como fonte de verdade semantica quando houver duvida
- nao conclua uma alteracao sem validar e verificar o modulo

Antes de editar `.sema`, entenda:
- o module alvo
- os contratos de task, route, error, effects, guarantees, state e flow
- os exemplos oficiais relacionados

Depois de editar `.sema`, execute este fluxo:
1. formatar
2. validar
3. diagnosticar, se houver falha
4. verificar

Se houver conflito entre texto livre e IR/diagnosticos, priorize a IR e os diagnosticos da CLI.

Se algo nao estiver claro, siga a forma ja usada nos exemplos oficiais. Nao improvise sem base.
```

## Variacao curta

Se voce quiser um prompt menor para uso frequente:

```text
Trabalhe com Sema como DSL semantica orientada a contrato. Nao invente sintaxe. Use os exemplos oficiais e a gramatica como referencia de escrita. Use `ir --json` como fonte de verdade semantica, `diagnosticos --json` como fonte de correcao e `sema formatar` como fonte unica de estilo. Antes de encerrar, rode validacao e verificacao.
```

## Variacao para revisao

Use esta versao quando a IA for revisar `.sema` em vez de criar:

```text
Revise este modulo Sema como contrato semantico executavel. Procure incoerencias entre input, output, rules, effects, guarantees, state, flow, route e error. Considere a IR e os diagnosticos da CLI como fonte de verdade. Nao critique estilo fora do que o formatador oficial resolveria automaticamente.
```

## Variacao para geracao

Use esta versao quando a IA for escrever modulo novo:

```text
Gere um modulo Sema seguindo a gramatica oficial, os exemplos do projeto e o estilo do formatador canonico. Estruture o modulo como contrato semantico executavel, com blocos explicitos para entrada, saida, regras, efeitos, garantias, erros, estado, fluxo e testes quando fizer sentido. Nao use sintaxe fora do repertorio ja suportado pela linguagem.
```

## Variacao para correcao guiada por diagnostico

Use esta versao quando a IA ja tiver erro concreto para corrigir:

```text
Corrija este modulo Sema a partir dos diagnosticos estruturados da CLI. Preserve a intencao do contrato e altere apenas o necessario para eliminar as falhas. Depois da correcao, aplique o formatador oficial e revalide.
```

## O que sempre anexar junto do prompt

Idealmente, acompanhe o prompt com:

- o arquivo `.sema` alvo
- o resultado de `sema ast --json`
- o resultado de `sema ir --json`
- o resultado de `sema diagnosticos --json`, se houver erro
- um exemplo oficial parecido

Sem isso, a IA pode ate acertar. Com isso, ela trabalha direito.

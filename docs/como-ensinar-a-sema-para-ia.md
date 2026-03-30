# Como Ensinar a Sema para IA

Este documento explica como fazer uma IA entender a Sema sem depender de memoria previa do modelo. A estrategia correta nao e presumir que a IA "ja conhece a linguagem", e sim entregar contexto suficiente para ela operar com seguranca.

## Principio central

Uma IA entende uma linguagem nova quando recebe quatro camadas de contexto:

1. sintaxe
2. semantica
3. estrutura intermediaria estavel
4. exemplos reais

Sem essas quatro camadas, o modelo comeca a adivinhar. E adivinhacao em linguagem de contrato e pedir para nascer bug feio.

## Camada 1. Sintaxe

A IA precisa saber como a linguagem e escrita.

Fontes principais:

- [gramatica-inicial.md](C:\GitHub\Sema\docs\gramatica-inicial.md)
- [sintaxe.md](C:\GitHub\Sema\docs\sintaxe.md)
- [gramatica.ebnf](C:\GitHub\Sema\pacotes\nucleo\src\parser\gramatica.ebnf)

Objetivo dessa camada:

- reconhecer blocos validos
- entender delimitadores
- nao inventar palavras-chave
- respeitar a organizacao canonicamente formatada

## Camada 2. Semantica

Depois de saber ler, a IA precisa saber o que cada bloco significa.

Fontes principais:

- [README.md](C:\GitHub\Sema\README.md)
- [especificacao-inicial.md](C:\GitHub\Sema\docs\especificacao-inicial.md)
- [pagamento-ponta-a-ponta.md](C:\GitHub\Sema\docs\pagamento-ponta-a-ponta.md)

Objetivo dessa camada:

- distinguir contrato interno de `task`
- distinguir contrato publico de `route`
- entender `effects`, `guarantees`, `error`, `state` e `flow`
- operar na linguagem como especificacao executavel, nao como texto decorativo

## Camada 3. Estrutura intermediaria estavel

Essa e a camada que faz a parada parar de ser um cassino.

Em vez de confiar que a IA vai interpretar `.sema` cru de primeira, use a CLI como tradutora oficial da linguagem.

Comandos principais:

```bash
node pacotes/cli/dist/index.js validar arquivo.sema --json
node pacotes/cli/dist/index.js diagnosticos arquivo.sema --json
node pacotes/cli/dist/index.js ast arquivo.sema --json
node pacotes/cli/dist/index.js ir arquivo.sema --json
node pacotes/cli/dist/index.js verificar exemplos --json --saida ./.tmp/verificacao-ia
```

Como cada comando ajuda:

- `validar --json`: diz se a base esta semanticamente valida
- `diagnosticos --json`: devolve erros e avisos como contrato estruturado
- `ast --json`: mostra a forma sintatica escrita
- `ir --json`: mostra a forma semantica resolvida
- `verificar --json`: mostra o estado operacional do projeto

Se a IA puder consumir `ir --json`, melhor ainda. E ali que a linguagem fica menos ambigua e mais utilizavel para automacao.

## Camada 4. Exemplos reais

Modelo aprende muito por padrao. Por isso, bons exemplos valem quase tanto quanto especificacao.

Arquivos recomendados:

- [pagamento.sema](C:\GitHub\Sema\exemplos\pagamento.sema)
- [pagamento_dominio.sema](C:\GitHub\Sema\exemplos\pagamento_dominio.sema)
- [automacao.sema](C:\GitHub\Sema\exemplos\automacao.sema)
- [tratamento_erro.sema](C:\GitHub\Sema\exemplos\tratamento_erro.sema)
- [crud_simples.sema](C:\GitHub\Sema\exemplos\crud_simples.sema)

O vertical de pagamento do `0.5` deve ser tratado como a referencia principal.

## O que a IA nao deve fazer

- inventar palavras-chave fora da gramatica
- introduzir blocos inexistentes
- assumir semantica que nao aparece na especificacao
- editar `.sema` sem rodar `sema formatar`
- encerrar alteracao sem consultar `diagnosticos` quando houver falha

## O que a IA deve fazer

- usar a gramatica e os exemplos como fonte de estilo
- usar a IR como fonte de verdade semantica sempre que possivel
- usar diagnosticos estruturados como guia de correcao
- rodar o formatador antes de considerar o trabalho pronto
- validar e verificar a mudanca no mesmo fluxo

## Estrategia recomendada

Se voce for instruir uma IA para trabalhar com Sema, entregue o contexto nesta ordem:

1. [README.md](C:\GitHub\Sema\README.md)
2. [como-ensinar-a-sema-para-ia.md](C:\GitHub\Sema\docs\como-ensinar-a-sema-para-ia.md)
3. [pagamento-ponta-a-ponta.md](C:\GitHub\Sema\docs\pagamento-ponta-a-ponta.md)
4. [prompt-base-ia-sema.md](C:\GitHub\Sema\docs\prompt-base-ia-sema.md)
5. `ast --json`, `ir --json` e `diagnosticos --json` do modulo alvo

Essa ordem faz a IA ir de contexto geral para contexto operacional, em vez de cair direto num arquivo cru e sair chutando.

## Regra de ouro

A Sema foi desenhada para ser entendida por IA, mas isso nao significa que a IA vai adivinhar sozinha.

Ela entende bem quando recebe:

- especificacao
- exemplos
- JSON estrutural
- feedback automatico

Sem isso, ate o modelo mais caro vira estagiario emocionado.

# Fluxo Pratico para IA Antes de Editar `.sema`

Este documento descreve o fluxo operacional recomendado para qualquer IA antes, durante e depois de alterar arquivos `.sema`.

Se a IA seguir isso, ela trabalha com contexto. Se nao seguir, vira adivinhacao gourmet.

## Fluxo curto

1. ler contexto do projeto
2. identificar o modulo alvo
3. consultar AST e IR
4. editar
5. formatar
6. validar
7. verificar

## Fluxo detalhado

### Etapa 1. Ler contexto minimo

Antes de tocar em qualquer arquivo, a IA deve ler:

- [README.md](C:\GitHub\Sema\README.md)
- [integracao-com-ia.md](C:\GitHub\Sema\docs\integracao-com-ia.md)
- [como-ensinar-a-sema-para-ia.md](C:\GitHub\Sema\docs\como-ensinar-a-sema-para-ia.md)

Se o trabalho estiver ligado a pagamento, ler tambem:

- [pagamento-ponta-a-ponta.md](C:\GitHub\Sema\docs\pagamento-ponta-a-ponta.md)

### Etapa 2. Ler o modulo alvo e um exemplo parecido

A IA deve identificar:

- qual arquivo sera editado
- qual modulo esse arquivo representa
- qual exemplo oficial mais se parece com o que precisa ser feito

Regra pratica:

- automacao: [automacao.sema](C:\GitHub\Sema\exemplos\automacao.sema)
- erros e fluxos de falha: [tratamento_erro.sema](C:\GitHub\Sema\exemplos\tratamento_erro.sema)
- borda publica e pagamento: [pagamento.sema](C:\GitHub\Sema\exemplos\pagamento.sema)

### Etapa 3. Consultar AST e IR

Antes de alterar, a IA deve executar:

```bash
node pacotes/cli/dist/index.js ast caminho\\arquivo.sema --json
node pacotes/cli/dist/index.js ir caminho\\arquivo.sema --json
```

Objetivo:

- ver a forma sintatica
- ver a forma semantica resolvida
- evitar interpretar errado o contrato

### Etapa 4. Editar o `.sema`

Ao editar, a IA deve:

- preservar a intencao do modulo
- seguir a gramatica existente
- evitar criar bloco ou operador nao suportado
- preferir a forma ja usada nos exemplos oficiais

### Etapa 5. Formatar

Depois da edicao:

```bash
node pacotes/cli/dist/index.js formatar caminho\\arquivo.sema
node pacotes/cli/dist/index.js formatar caminho\\arquivo.sema --check
```

Se `--check` falhar, o trabalho ainda nao esta pronto.

### Etapa 6. Validar e diagnosticar

Depois da formatacao:

```bash
node pacotes/cli/dist/index.js validar caminho\\arquivo.sema --json
node pacotes/cli/dist/index.js diagnosticos caminho\\arquivo.sema --json
```

Se houver falha:

- usar os diagnosticos estruturados como contrato de correcao
- nao insistir em leitura manual teimosa quando a CLI ja disse onde esta a merda

### Etapa 7. Verificar

No fechamento:

```bash
node pacotes/cli/dist/index.js verificar exemplos --json --saida ./.tmp/verificacao-ia
```

Ou, no fluxo consolidado do projeto:

```bash
npm run project:check
```

## Fluxo minimo para automacao

Se voce quiser o menor fluxo aceitavel para uma IA:

```bash
node pacotes/cli/dist/index.js ir caminho\\arquivo.sema --json
node pacotes/cli/dist/index.js formatar caminho\\arquivo.sema
node pacotes/cli/dist/index.js validar caminho\\arquivo.sema --json
```

Mas, sendo sincero, o fluxo bom mesmo e fechar com `verificar`.

## Checklist de saida

Antes de considerar a alteracao pronta, a IA deve responder mentalmente:

- eu entendi o modulo e o contrato?
- eu mantive a sintaxe dentro do que a linguagem suporta?
- eu formatei o arquivo?
- eu validei?
- eu olhei diagnosticos se algo falhou?
- eu fechei com verificacao?

Se alguma resposta for "nao", ainda nao terminou.

## Regra de ouro

Em Sema, a IA nao deveria operar no escuro.

Ela deve trabalhar sempre com:

- exemplo oficial
- AST
- IR
- diagnosticos
- formatador

Esse conjunto e o que faz a linguagem ser amigavel para IA de verdade, e nao so no discurso bonito.

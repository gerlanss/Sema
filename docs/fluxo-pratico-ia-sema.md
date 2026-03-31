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

- [README.md](../README.md)
- [integracao-com-ia.md](./integracao-com-ia.md)
- [como-ensinar-a-sema-para-ia.md](./como-ensinar-a-sema-para-ia.md)

Se o trabalho estiver ligado a pagamento, ler tambem:

- [pagamento-ponta-a-ponta.md](./pagamento-ponta-a-ponta.md)

### Etapa 2. Ler o modulo alvo e um exemplo parecido

A IA deve identificar:

- qual arquivo sera editado
- qual modulo esse arquivo representa
- qual exemplo oficial mais se parece com o que precisa ser feito

Regra pratica:

- automacao: [automacao.sema](../exemplos/automacao.sema)
- erros e fluxos de falha: [tratamento_erro.sema](../exemplos/tratamento_erro.sema)
- borda publica e pagamento: [pagamento.sema](../exemplos/pagamento.sema)

### Etapa 3. Consultar AST e IR

Antes de alterar, a IA deve executar:

```bash
sema ast caminho/arquivo.sema --json
sema ir caminho/arquivo.sema --json
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
sema formatar caminho/arquivo.sema
sema formatar caminho/arquivo.sema --check
```

Se `--check` falhar, o trabalho ainda nao esta pronto.

### Etapa 6. Validar e diagnosticar

Depois da formatacao:

```bash
sema validar caminho/arquivo.sema --json
sema diagnosticos caminho/arquivo.sema --json
```

Se houver falha:

- usar os diagnosticos estruturados como contrato de correcao
- nao insistir em leitura manual teimosa quando a CLI ja disse onde esta a merda

### Etapa 6.5. Compilar quando a tarefa pedir codigo derivado

Se a tarefa nao for so editar contrato, mas tambem gerar base de implementacao, a IA deve rodar explicitamente:

```bash
sema compilar caminho/arquivo.sema --alvo typescript --saida ./saida/typescript
```

Ou trocar o alvo para `python` ou `dart`, conforme o caso.

Regra pratica:

- se a entrega inclui codigo derivado, `sema compilar` nao e opcional
- se a IA ignorar `compilar`, ela pode acabar reescrevendo na mao coisa que a Sema ja gera sozinha, que e burrice operacional

### Etapa 7. Verificar

No fechamento:

```bash
sema verificar arquivo-ou-pasta --json --saida ./.tmp/verificacao-ia
```

## Fluxo minimo para automacao

Se voce quiser o menor fluxo aceitavel para uma IA:

```bash
sema ir caminho/arquivo.sema --json
sema formatar caminho/arquivo.sema
sema validar caminho/arquivo.sema --json
```

Mas, sendo sincero, o fluxo bom mesmo e fechar com `verificar`.

Se a tarefa envolver codigo derivado, o fluxo minimo aceitavel vira:

```bash
sema ir caminho/arquivo.sema --json
sema formatar caminho/arquivo.sema
sema validar caminho/arquivo.sema --json
sema compilar caminho/arquivo.sema --alvo typescript --saida ./saida/typescript
```

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

## Observacao sobre caminhos

Esta documentacao usa placeholders de arquivo e pasta, nao caminhos do monorepo da Sema. A IA deve adaptar isso ao projeto atual e continuar tratando `sema` como interface publica principal.

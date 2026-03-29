# Contribuindo com a Sema

Este projeto nao e um brinquedo de fim de semana. A Sema esta sendo construida como linguagem e compilador reais, com foco principal em entendimento, validacao e transformacao por IA. A colaboracao humana continua essencial, mas a disciplina do repositorio precisa refletir essa direcao desde ja.

## Direcao do projeto

- A Sema e uma linguagem orientada a semantica explicita.
- A prioridade de design e tornar a intencao compreensivel para IA com o minimo de ambiguidade.
- A legibilidade humana entra como consequencia positiva dessa explicitude.
- Toda mudanca precisa preservar previsibilidade, rastreabilidade e testes.

## Antes de comecar

1. Leia o [README.md](C:\GitHub\Sema\README.md).
2. Leia o [STATUS.md](C:\GitHub\Sema\STATUS.md).
3. Verifique a sprint atual e os itens parciais ou pendentes.
4. Escolha uma frente concreta antes de sair codando igual um maluco.

## Fluxo recomendado de trabalho

1. Pegue uma issue, ou abra uma issue pequena e objetiva antes de implementar algo maior.
2. Entenda em qual parte do plano a mudanca se encaixa: compilador, semantica, geracao, CLI, exemplos ou documentacao.
3. Implemente a mudanca com comentarios e documentacao em portugues do Brasil.
4. Atualize o `STATUS.md` se a mudanca alterar o estado real do projeto.
5. Rode a verificacao local completa.
6. Faça commit com mensagem intencional.
7. Abra um PR com contexto suficiente para revisao.

## Comandos canonicos

Instalar dependencias:

```bash
npm install
```

Compilar:

```bash
npm run build
```

Executar a verificacao operacional de documentacao:

```bash
npm run docs:prepare
```

Executar a verificacao completa do projeto:

```bash
npm run project:check
```

Executar a verificacao em lote dos exemplos:

```bash
node pacotes/cli/dist/index.js verificar exemplos --saida ./.tmp/verificacao
```

## Padrao de qualidade esperado

- Nao introduzir ambiguidade semantica sem justificar muito bem.
- Nao esconder regra de negocio em texto solto quando ela pode virar estrutura.
- Nao quebrar a rastreabilidade entre `.sema`, AST, IR e codigo gerado.
- Nao adicionar comentario inutil so para encher linguica.
- Nao marcar item como concluido no `STATUS.md` se ele ainda estiver meia-boca.

## Quando atualizar o STATUS.md

Atualize o [STATUS.md](C:\GitHub\Sema\STATUS.md) quando:

- um item mudar de `[ ]` para `[-]`
- um item mudar de `[-]` para `[x]`
- aparecer um risco relevante novo
- a sprint em andamento mudar de foco

Depois rode:

```bash
npm run docs:prepare
```

## Convencao de commits

Prefira mensagens curtas, descritivas e honestas:

- `feat: fortalecer semantica de route no analisador`
- `docs: atualizar status operacional do MVP`
- `test: cobrir validacao de flow com task inexistente`
- `chore: adicionar project:check`

## Como o Codex deve operar aqui

Quando o Codex estiver trabalhando neste repositorio, o fluxo esperado e:

1. ler `README.md` e `STATUS.md`
2. identificar o item atual da sprint ou da issue
3. implementar a mudanca
4. rodar `npm run docs:prepare` se houver impacto em documentacao operacional
5. rodar `npm run project:check`
6. atualizar issue, status ou documentacao relevante

## Escopo ideal de PR

Um PR bom neste projeto:

- resolve uma frente clara
- mexe em poucas areas de uma vez
- deixa o `STATUS.md` mais verdadeiro
- inclui teste quando ha regra nova
- explica o impacto na semantica da linguagem

## O que evitar

- misturar refatoracao grande com recurso novo sem necessidade
- empilhar mudancas sem teste local
- criar sintaxe “bonita” que piora parser, AST ou previsibilidade para IA
- sair marcando milestone como pronta no grito

## Regra pratica

Se a mudanca deixa a linguagem mais explicitamente semanticavel, mais validavel e mais previsivel para IA sem virar um trambolho ilegivel, ela provavelmente esta na direcao certa.

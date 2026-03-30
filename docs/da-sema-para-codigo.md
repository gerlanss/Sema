# Da Sema para Codigo

Este guia existe para deixar uma coisa cristalina:

**sim, a Sema gera codigo de verdade.**

Ela nao e so leitura, validacao ou "documentacao premium". A Sema ja gera scaffolding real para TypeScript, Python e Dart a partir do contrato semantico.

## Quando usar este fluxo

Use este fluxo quando a tarefa nao for apenas:

- ler um modulo `.sema`
- corrigir sintaxe
- ajustar regra sem gerar artefato

Use este fluxo quando a tarefa pedir:

- codigo derivado
- contrato executavel
- interfaces ou tipos
- classes de erro
- validacoes geradas
- stubs de execucao
- testes derivados dos `tests` embutidos

## Regra pratica

Se a tarefa pede codigo derivado e a IA nao roda `sema compilar`, ela esta trabalhando errado.

## Fluxo minimo correto

```bash
sema ast caminho/arquivo.sema --json
sema ir caminho/arquivo.sema --json
sema formatar caminho/arquivo.sema
sema validar caminho/arquivo.sema --json
sema compilar caminho/arquivo.sema --alvo typescript --saida ./saida/typescript
```

Troque o alvo para `python` ou `dart` quando fizer sentido.

## O que `sema compilar` ja entrega

Dependendo do modulo, a geracao ja pode produzir:

- interfaces e tipos
- classes de erro
- contratos exportados
- validacoes derivadas de `rules`
- verificadores derivados de `guarantees`
- stubs de execucao
- adaptadores publicos de `route`
- artefatos de teste derivados do bloco `tests`
- rastreabilidade de `effects`, `state`, `flow`, `route`, `error` e `impl`

Ou seja: o contrato nao para na semantica. Ele ja transborda para codigo executavel.

## Exemplo rapido

Partindo de um modulo como este:

```sema
module exemplos.importacao {
  task importar_lista_pdf {
    input {
      arquivo_pdf: Texto required
    }
    output {
      total_itens: Inteiro
      status: Texto
    }
    rules {
      arquivo_pdf existe
    }
    effects {
      consulta parser_pdf criticidade=alta
      persistencia ListaProdutos criticidade=alta
    }
    guarantees {
      total_itens >= 0
      status existe
    }
    error {
      pdf_invalido: "arquivo de entrada invalido"
      formato_incompativel: "estrutura inesperada"
    }
    tests {
      caso "importacao basica" {
        given {
          arquivo_pdf: "entrada.pdf"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }
}
```

Voce pode gerar TypeScript assim:

```bash
sema compilar exemplos/importacao.sema --alvo typescript --saida ./saida/typescript
```

Na pratica, o gerado pode incluir:

- `importar_lista_pdfEntrada`
- `importar_lista_pdfSaida`
- `importar_lista_pdf_pdf_invalidoErro`
- `contrato_importar_lista_pdf`
- `validar_importar_lista_pdf`
- `verificar_garantias_importar_lista_pdf`
- `executar_importar_lista_pdf`
- testes derivados do bloco `tests`

## Como a IA deve pensar esse fluxo

### Quando a tarefa e de leitura ou correcao

Fluxo suficiente:

```bash
sema ir caminho/arquivo.sema --json
sema formatar caminho/arquivo.sema
sema validar caminho/arquivo.sema --json
```

### Quando a tarefa e de geracao

Fluxo obrigatorio:

```bash
sema ir caminho/arquivo.sema --json
sema formatar caminho/arquivo.sema
sema validar caminho/arquivo.sema --json
sema compilar caminho/arquivo.sema --alvo typescript --saida ./saida/typescript
```

### Quando a tarefa e de fechamento real

Fluxo ideal:

```bash
sema ir caminho/arquivo.sema --json
sema formatar caminho/arquivo.sema
sema validar caminho/arquivo.sema --json
sema compilar caminho/arquivo.sema --alvo typescript --saida ./saida/typescript
sema verificar exemplos --json --saida ./.tmp/verificacao
```

## O que a Sema nao faz sozinha

Para nao vender fumaça:

- a Sema nao gera interface visual completa sozinha
- a Sema nao substitui React, Flutter, TypeScript ou Python
- a Sema nao decide UX, layout ou arquitetura inteira por conta propria

Ela governa:

- intencao
- contrato
- fluxo
- estado
- erro
- efeito
- garantia

E depois disso gera a base de codigo que faz essa semantica vazar para os alvos.

## Erro comum de IA

Erro classico:

1. ler o `.sema`
2. ignorar `sema compilar`
3. reescrever na mao interfaces, erros, contratos e validacoes

Isso desperdiça a ferramenta e produz trabalho duplicado.

## Regra de ouro

Se o objetivo for sair da Sema para codigo, o comando central e:

```bash
sema compilar
```

Sem ele, a IA esta vendo so metade do valor da linguagem.

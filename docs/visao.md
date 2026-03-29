# Visao da Linguagem

A Sema nasce para modelar software como especificacao executavel. O centro da linguagem nao e o algoritmo puro, e sim o contrato semantico da operacao.

## Objetivo

Permitir que uma equipe descreva regras de negocio com clareza suficiente para:

- validar consistencia antes da implementacao
- gerar codigo mais previsivel
- apoiar revisao humana com menos ambiguidade
- facilitar colaboracao com IA em cima de estruturas explicitas

## Publico principal

- equipes de produto e plataforma focadas em sistemas de negocio
- arquitetos e desenvolvedores que precisam rastrear contratos
- times que sofrem com codigo dispersando regra, efeito e validacao
- pessoas que querem usar IA sem entregar a ela um pântano semantico

## Resultado esperado

Um modulo `.sema` deve servir ao mesmo tempo como:

- especificacao de comportamento
- contrato tecnico
- fonte de geracao de codigo
- base para teste
- artefato legivel em revisao


# Manifesto da Sema

Sema e um **Protocolo de Governanca de Intencao**.

Por baixo, isso continua sendo uma linguagem de intencao. Mas o nome publico mais honesto e esse, porque o problema real que ela resolve nao e "programar diferente"; e governar significado em sistema vivo sem deixar contrato, erro, efeito e garantia virarem farofa espalhada.

Software de negocio nao deveria esconder intencao em detalhe tecnico perdido.

Quando uma operacao valida entrada, consulta sistema externo, grava estado, emite evento e promete uma saida, isso nao pode ficar enterrado numa mistura de service, helper, comentario e teste esquecido. Essa bagunca pode ate funcionar, mas respeita a stack mais do que respeita o dominio.

A Sema parte de uma ideia simples: a especificacao do comportamento deve vir antes da implementacao.

## O que isso quer dizer

Quer dizer que a Sema foi desenhada para:

- explicitar intencao antes de implementacao
- reduzir espaco para interpretacao ambigua
- organizar contrato, regra, efeito, erro e garantia de forma nativa
- permitir que IA trabalhe sobre significado claro, e nao sobre farejo improvisado

Por isso faz sentido manter a Sema como linguagem de intencao por bastante tempo. Ela nao precisa virar linguagem generalista para ser relevante. Se ela governar significado melhor do que as stacks ao redor, ja esta cumprindo uma funcao valiosa pra caralho.

## Posicoes centrais

- efeitos colaterais devem ser declarados, nao escondidos
- contratos de entrada e saida devem ser nativos
- garantias pos-execucao merecem a mesma seriedade que tipo
- testes devem acompanhar a especificacao, nao apenas a implementacao
- IA deve operar sobre significado explicito, nao sobre adivinhacao estatistica solta
- scaffold e geracao devem preservar a verdade semantica do modulo

## O que a Sema nao quer ser

- substituta de todas as linguagens do planeta
- prompt enfeitado com pose de compilador
- framework acoplado a sintaxe
- teatro de marketing vendendo automacao milagrosa

## O que a Sema quer ser

Uma camada semantica que deixa nitido:

- o objetivo da operacao
- os dados de entrada
- o contrato de saida
- as regras obrigatorias
- os efeitos permitidos
- as garantias assumidas
- os cenarios de teste
- a ligacao com a implementacao real

Se isso estiver claro, IA e humano param de brigar com o codigo e passam a governar a intencao.

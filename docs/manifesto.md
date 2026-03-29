# Manifesto da Sema

Software de negocio nao deveria esconder intencao em detalhes tecnicos espalhados.

Quando uma operacao valida entrada, consulta sistemas externos, grava estado, emite eventos e promete uma saida, isso nao pode ficar enterrado em uma mistura de service, helper, comentario e teste perdido. Essa bagunca pode ate “funcionar”, mas nao respeita a realidade do dominio.

A Sema parte de uma ideia simples: a especificacao do comportamento deve vir antes da implementacao. Regras, efeitos colaterais, garantias e testes nao sao anexos. Eles sao parte do proprio programa.

## Posicoes centrais

- efeitos colaterais devem ser declarados, nao escondidos
- contratos de entrada e saida devem ser nativos
- garantias pos-execucao devem ser escritas com a mesma seriedade de tipos
- testes devem acompanhar a especificacao, nao apenas a implementacao
- IA deve operar sobre significado explicito, nao sobre adivinhacao estatistica solta
- sintaxe boa nao e a mais curta; e a mais clara
- geracao de codigo deve preservar a verdade semantica do modulo

## O que a Sema nao quer ser

- nao quer substituir todas as linguagens do planeta
- nao quer virar um formato de prompt enfeitado
- nao quer depender de convencoes implicitas para funcionar
- nao quer misturar marketing com especificacao tecnica

## O que a Sema quer ser

Uma camada de intencao e contrato acima de linguagens como Python e TypeScript. Uma linguagem em que humanos e IA consigam ler o modulo e entender:

- o objetivo da operacao
- os dados de entrada
- o contrato de saida
- as regras obrigatorias
- os efeitos permitidos
- as garantias assumidas
- os cenarios de teste

Se uma linguagem nao consegue deixar isso nitido, ela esta exigindo memoria demais e declarando semantica de menos.


# Scorecard de Avaliacao da Sema no FuteBot

Este documento transforma o feedback da IA sobre `C:\GitHub\FuteBot` em uma regua objetiva.

O objetivo nao e dizer "a Sema parece boa". O objetivo e medir, em casos reais, se ela:

- reduz busca cega
- aponta o dominio certo da mudanca
- evita edicao burra no runtime
- mantem contrato, runtime e validacao coerentes
- ainda deixa lixo demais no caminho

## Regua oficial

Cada area recebe nota de `0` a `10`.

- `0-3`: fraco; a IA ainda opera quase no escuro
- `4-6`: util, mas ainda depende demais de leitura bruta
- `7-8`: forte para governar a mudanca
- `9-10`: muito forte; a IA entra com contexto, muda com seguranca e verifica com baixo atrito

## Areas avaliadas

### 1. Roteamento Semantico da Mudanca

Pergunta principal:

- a Sema aponta o modulo, task, flow ou superficie certos antes da IA sair abrindo arquivo aleatorio?

Como medir:

- rodar `sema resumo`
- rodar `sema drift --json`
- verificar se os artefatos levam a IA para o modulo correto sem leitura ampla do repo

Nota:

- `0-3`: a IA ainda precisa farejar o modulo no instinto
- `4-6`: a Sema aponta parte do dominio, mas deixa ambiguo onde mexer
- `7-8`: a Sema leva ao modulo certo e separa responsabilidade principal
- `9-10`: a Sema aponta modulo, task e superficie com clareza quase imediata

### 2. Pinpoint de Runtime

Pergunta principal:

- depois de acertar o dominio, a Sema ajuda a achar os arquivos, simbolos e thresholds reais ou ainda empurra tudo para leitura no braco?

Como medir:

- comparar `impl`, `vinculos`, `drift` e `contexto-ia` com os arquivos realmente tocados na mudanca
- contar quantos arquivos criticos a IA precisou descobrir sozinha

Nota:

- `0-3`: o dominio esta certo, mas o runtime continua uma caca ao tesouro
- `4-6`: parte dos simbolos aparece, mas a mudanca fina continua manual demais
- `7-8`: `impl` e `vinculos` encurtam bem a busca
- `9-10`: a trilha para o runtime relevante fica curta e acionavel

### 3. Qualidade do Drift

Pergunta principal:

- o `drift` mostra o que realmente importa para a mudanca ou so confirma coisas obvias?

Como medir:

- rodar `sema drift --json` antes e depois da mudanca
- verificar se score, lacunas e vinculos refletem o risco real da alteracao

Nota:

- `0-3`: `drift` quase nao ajuda a decidir nada
- `4-6`: `drift` ajuda estruturalmente, mas perde detalhe fino
- `7-8`: `drift` segura bem coerencia entre contrato e codigo vivo
- `9-10`: `drift` antecipa de forma clara os descasamentos operacionais relevantes

### 4. Qualidade dos Diagnosticos

Pergunta principal:

- os diagnosticos da Sema orientam a correcao ou viram barulho repetitivo que a IA aprende a ignorar?

Como medir:

- contar diagnosticos duplicados ou quase duplicados
- verificar quantos realmente geram uma acao clara
- separar sinal de ruido

Nota:

- `0-3`: diagnostico demais, acao de menos
- `4-6`: diagnosticos corretos, mas verbosos ou redundantes
- `7-8`: diagnosticos bons e acionaveis com pouco ruido
- `9-10`: diagnosticos cirurgicos, sem eco desnecessario

### 5. Anti-Ritual

Pergunta principal:

- a Sema esta guiando a intervencao ou esta sendo usada como checklist bonito antes da leitura "de verdade"?

Como medir:

- verificar se `resumo`, `drift`, `contexto-ia`, `validar` e `verificar` mudaram a decisao de edicao
- verificar se eles alteraram a ordem da intervencao

Nota:

- `0-3`: puro ritual; a IA teria feito quase a mesma coisa sem Sema
- `4-6`: ajuda a organizar, mas ainda sem impacto forte na estrategia
- `7-8`: muda a ordem e a qualidade da intervencao
- `9-10`: governa a mudanca de ponta a ponta

### 6. Fechamento do Ciclo

Pergunta principal:

- depois de editar, a Sema consegue fechar o loop com validacao, verificacao e rechecagem de coerencia?

Como medir:

- rodar `sema validar`
- rodar `sema verificar`
- comparar antes/depois do `drift`

Nota:

- `0-3`: o fim da mudanca depende quase todo de julgamento manual
- `4-6`: a Sema valida forma, mas ainda fecha pouco a realidade
- `7-8`: a Sema ajuda a fechar consistencia semantica de forma confiavel
- `9-10`: a mudanca sai com boa confianca sem precisar de fe cega

## Casos de teste recomendados no FuteBot

Para essa avaliacao nao virar opiniao solta, use pelo menos tres tipos de mudanca:

### Caso A. Mudanca operacional espalhada

Exemplo:

- alterar threshold de liberacao
- mudar regra de T-30
- alterar janela de monitoramento live

O que mede melhor:

- roteamento semantico
- pinpoint de runtime
- granularidade do `drift`

### Caso B. Mudanca de integracao externa

Exemplo:

- trocar regra de captura de odds
- alterar fallback entre OddsPapi e 1xBet
- endurecer regra de erro de integracao

O que mede melhor:

- qualidade de `effects`
- qualidade de `impl` e `vinculos`
- fechamento do ciclo com `verificar`

### Caso C. Mudanca de fluxo operacional

Exemplo:

- mudar liberacao de previsao aprovada
- ajustar relacao entre radar pre-live e ciclo de previsao
- endurecer politica de acompanhamento live

O que mede melhor:

- leitura de `flow`
- fronteira entre modulos
- anti-ritual

## Formulario de avaliacao por caso

Use esta tabela em cada mudanca real:

| Area | Nota | Evidencia | Dor encontrada | Acao sugerida |
| --- | --- | --- | --- | --- |
| Roteamento semantico da mudanca |  |  |  |  |
| Pinpoint de runtime |  |  |  |  |
| Qualidade do drift |  |  |  |  |
| Qualidade dos diagnosticos |  |  |  |  |
| Anti-ritual |  |  |  |  |
| Fechamento do ciclo |  |  |  |  |

## Sinais de alerta

Se qualquer um destes acontecer, a nota do caso deve cair:

- a IA precisou abrir muitos arquivos aleatorios antes de encontrar o centro da mudanca
- `drift` nao apontou a superficie realmente afetada
- `impl` e `vinculos` nao encurtaram a trilha para o codigo vivo
- diagnosticos vieram repetidos e cansativos
- a etapa semantica foi rodada, mas nao mudou a estrategia real da intervencao
- `validar` e `verificar` ficaram verdes sem garantir coerencia suficiente no runtime

## Leitura do resultado

Media por caso:

- `9-10`: a Sema esta governando IA de forma forte
- `7-8.9`: a Sema esta boa, mas ainda ha ultima milha frouxa
- `5-6.9`: a Sema ajuda, mas ainda depende demais de leitura bruta
- abaixo de `5`: a Sema ainda esta mais perto de contexto auxiliar do que de trilho operacional

Media por area:

- se `Roteamento semantico` for alto e `Pinpoint de runtime` for baixo, o problema principal esta na ultima milha
- se `Diagnosticos` for baixo, a semantica pode estar certa, mas a UX esta enchendo o saco
- se `Anti-ritual` for baixo, a ferramenta esta virando cerimônia
- se `Fechamento do ciclo` for baixo, a Sema ainda nao fecha a confianca da mudanca

## Hipoteses de melhoria que esse scorecard valida

Se o scorecard confirmar os pontos de atencao do feedback, as melhorias mais provaveis sao:

- fortalecer `impl` e `vinculos` para apontar melhor simbolos e arquivos reais
- reduzir duplicacao de diagnosticos sem perder firmeza
- melhorar `drift` para mudancas operacionais pequenas, mas espalhadas
- explicitar melhor thresholds, config e regras recorrentes no contrato
- tornar `contexto-ia` mais acionavel para a ultima milha de runtime

## Opiniao de produto

O uso correto desse scorecard nao e provar que a Sema e perfeita. E justamente o contrario: descobrir onde ela ja salva a IA de fazer merda e onde ela ainda deixa a ultima milha frouxa demais.

Se a nota do FuteBot confirmar `Roteamento semantico` alto e `Pinpoint de runtime` medio, isso significa uma coisa bem clara:

- a tese central da Sema esta funcionando
- mas a ultima milha entre contrato e codigo vivo ainda precisa ficar mais filha da puta de boa

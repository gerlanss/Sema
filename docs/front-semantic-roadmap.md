# Front Semantic Roadmap

Este documento existe para deixar uma coisa clara: a linha consumer oficial ja abriu `Next.js`, `React/Vite`, `Angular` e `Flutter`, mas a camada semantica de front ainda nao fechou a segunda onda.

Hoje o slice oficial e:

- `consumer bridge` canonico
- superfícies rastreaveis de framework
- `drift` leve de bridge, arquivo e rota/superficie consumer
- `contexto-ia` com `consumerFramework`, `appRoutes`, `consumerSurfaces`, `consumerBridges` e `arquivosProvaveisEditar`

Isso e suficiente para IA operar um front consumidor com menos adivinhacao. Ainda nao e a semantica richer de interface.

## Proxima camada oficial

Os blocos candidatos desta proxima onda sao:

- `screen`: intencao da tela, estados vazios/loading/erro e a borda que a UI precisa representar
- `action`: intents disparadas por usuario, com vinculo rastreavel a bridge, task, route ou efeito local
- `query`: leitura consumer com cache, refresh, retry, polling, invalidador e dependencia de contexto
- `form`: campos, validacao, mascara, erro por campo, erro global e pos-condicao visual
- `navigation`: rotas de entrada, guards, deep links, parametros e fluxo entre telas

## Guardrails

Quando esta camada entrar, os limites continuam:

- nao virar DSL de CSS
- nao prometer visual drift
- nao trocar React, Angular ou Flutter por uma pseudo-UI da Sema
- nao apontar `impl` direto para componente visual quando o slice oficial for de bridge/consumer

## Estrategia de entrega

Antes de abrir sintaxe nova no parser, a ordem segura e:

1. consolidar showcases fullstack consumer + backend
2. endurecer `contexto-ia` e `drift` com hints operacionais de front
3. fechar exemplos e nomenclatura oficial
4. so depois subir para gramatica, IR e validacao semantica

## Regra de honestidade

Enquanto esta pagina existir sem parser/IR correspondente, `screen`, `action`, `query`, `form` e `navigation` devem ser tratados como roadmap oficial, nao como sintaxe ja suportada.

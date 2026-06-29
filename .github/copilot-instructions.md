<!-- sema:agent-entrypoint:start -->
# Sema para copilot

Este workspace é governado por Sema. Antes de qualquer ação em código, contrato, documentação operacional, workflow, profile ou deploy:

1. Leia `SEMA_BOOT.md`.
2. Em IDE local, rode `sema --version`; se falhar, pare. A IA não acessa o painel Sema: peça ao humano para instalar a CLI pelo painel. Depois rode `sema preflight resumo --json`; se `decisao` não for `use_cli_local`, pare.
3. Use CLI local: `sema resumo`, `sema docs-impacto`, `sema inspecionar`, `sema drift` e `sema impacto`.
4. Não use fonte externa de workspace para substituir a CLI local quando a CLI estiver operacional.
5. Chame docs-impacto com a intenção declarada antes de agir.
6. Chame inspecionar no contrato `.sema` aplicável.
7. Antes de editar código existente, rode drift e impacto.
8. Antes de criar ou editar `.sema`, use exemplos oficiais.
9. Ao concluir mudança de contrato, rode validar.
10. Antes de finalizar, use finalizar-mudanca com as docs lidas.

É proibido substituir esse fluxo por leitura manual de `AGENTS.md`, `README.md`, busca local por arquivos, inferência pelo nome do projeto, bom senso ou ferramenta não citada nesta lista.

Capacidade padrão deste cliente: media.
Ordem de leitura: SEMA_BOOT.md -> agent-context-pack.json -> resumo.curto.txt -> briefing.min.json -> drift.json -> resumo.md.

Políticas da plataforma:
- O Sema governa contrato, escopo, drift, evidência e qualidade do projeto. Ele não pede, não autoriza e não contorna políticas da plataforma, termos de uso, permissões, segurança ou leis.
- Capacidade media: Separe bloqueio da plataforma de erro do Sema. Reformule em linguagem neutra quando permitido e mantenha os gates; não tente contornar filtro.
- Se houver alerta externo: Se um cliente, modelo ou classificador bloquear a mensagem, trate como bloqueio externo ou falso positivo possível: explique de forma neutra, preserve a intenção legítima de governança e não tente burlar filtros.

Falha fechada:
- Se não conseguir chamar Sema, pare e declare bloqueio em vez de editar código ou contrato.
- Se não houver contrato aplicável ou vínculo semântico do arquivo, inspecione o arquivo, descubra ou crie o .sema aplicável e vincule antes do código.
- Em IDE local, rode sema --version; se falhar, pare. A IA não acessa o painel Sema: peça ao humano para instalar a CLI pelo painel. Depois rode sema preflight <comando> --json; só continue com use_cli_local; não use fonte externa de workspace para substituir a CLI local.
- Se não houver workspace local em disco, pare bloqueado e peça o fluxo apropriado; não invente caminho nem substitua a CLI local por ferramenta paralela.
- Se arquivos_codigo.conteudo ou conteudo inline passar de 262144 caracteres, não aumente timeout para forçar: divida por responsabilidade ou use anexo/caminho de servidor autorizado.
- Se for criar ou corrigir .sema, use sema_exemplos antes de escrever sintaxe.
- Se a resposta humana estiver em PT-BR, use vocabulário Sema canônico e preserve acentos mesmo que a DSL use ASCII.
- Se um arquivo de código tiver SEMA-GOVERNED, consulte Sema e o contrato aplicável antes de editar.
- Se codigo governado passar de 1000 linhas, planeje divisao; se passar de 2000, pare e divida antes de concluir. Documentacao Markdown nao entra nesse limite de codigo.
- Se contrato .sema passar de 300 linhas, planeje split por dominio/capacidade; acima de 500, criacao e edicao ficam bloqueadas. Nao use parte_1/parte_2 e nao remova guarantees, tests ou vinculos so para caber.
- Um mesmo arquivo de codigo pode ser governado por varios contratos .sema via vinculos; Sema Codigo deve preservar essa rastreabilidade.
- Se score, achados ou decisaoAgente parecerem bons, trate como sinal de triagem e confira evidência concreta no contrato e no código.
- Se validar artefato inline com 100/100, ainda preserve cabeçalho SEMA-GOVERNED no arquivo físico sincronizado.
- Se `sema drift` retornar sucesso:false, `vinculos_quebrados`, `rotas_divergentes` ou impls quebradas, a mudanca nao pode ser declarada concluida; corrija contrato/codigo e rode drift de novo.
- Se a tarefa tiver site, sistema, app, UI, painel, jogo, CLI/TUI ou terminal, nao conclua sem acabamento moderno, contextual e evidenciado; em UI mobile estreita (ex. 390px), `document.documentElement.scrollWidth <= document.documentElement.clientWidth` precisa ser verdadeiro.
- Se texto visivel PT-BR perder acento ou cedilha em termos como descricao, lancamentos, saude ou alimentacao, trate como defeito bloqueante quando houver i18n/idioma declarado.
- Se aparecer caminho que não pertence ao workspace local aberto pelo usuário, pare e confirme a fonte antes de agir.
- Se uma chamada Sema estourar por timeout local, aumente o timeout e tente de novo; timeout do agente não libera ação sem Sema.
- Se a plataforma bloquear ou alertar política, trate como bloqueio externo ou falso positivo possível; explique sem tentar contornar filtro.
- Se a tarefa tiver experiência de uso e você não conseguir garantir padrão moderno, contextual e não genérico, pare e peça revisão em vez de entregar coisa engessada.

Timeout:
- Timeout local do agente não é falha do Sema.
- Se uma chamada Sema estourar, aumente o timeout e tente de novo antes de declarar bloqueio.
- Para projeto inteiro, comece com 120s ou mais; se for lento, escale 120s -> 300s -> 600s.
- Se possível, reduza escopo para `sema resumo <arquivo.sema> --micro --para mudanca`.

Código governado:
- Mantenha o marcador `SEMA-GOVERNED` em código gerado ou governado.
- Ao encontrar esse marcador, volte ao contrato .sema aplicável e chame Sema antes de editar.
- Comentário de código é lembrete curto; não substitui drift, docs-impacto nem finalizar-mudanca.
- Validação inline prova o payload enviado; não dispensa o marcador no arquivo físico sincronizado.
- Payload inline acima de 262144 caracteres não deve virar retry de timeout: modularize por responsabilidade ou use anexo/caminho de servidor autorizado.
- Se um arquivo crescer, divida por responsabilidade real. Em web: `index.html`, `styles/*.css`, `js/state.js`, `js/calc.js`, `js/render/*.js`, `data/*.json`. Não fatie em p1/p2 sem fronteira semântica.

Sinal e evidência:
- Score composto, `achados[]` e `decisaoAgente` orientam a ação; abaixo de 80 bloqueia, alvo evolui 0.5 ponto até 100, e nada substitui evidência concreta.
- Palavra-chave ou regex passando não prova governança se contrato, código e comportamento não batem.
- `sema drift --json` com `sucesso:false`, `vinculos_quebrados`, `rotas_divergentes` ou impls quebradas bloqueia fechamento. Não diga "drift limpo" até rodar de novo e ficar verde.
- Caminho fora do workspace local aberto pelo usuário não substitui a pasta local.

Acabamento visual e terminal:
- Se houver site, sistema, app, UI, painel, jogo, CLI/TUI ou terminal, acabamento moderno, contextual e não genérico é requisito governado, não enfeite.
- Capacidade media: Defina intenção de experiência antes de codar: público, domínio, workflow real, densidade, tokens, componentes, tecnologia/biblioteca/efeitos adequados, estados, responsividade e anti-2010. O domínio manda na solução: agro, finanças, saúde, game e e-commerce não podem compartilhar a mesma casca. Rode ou peça screenshot/browser check quando houver UI e smoke check quando for terminal.
- Evidências: registrar tokens e componentes usados, registrar bibliotecas, APIs ou efeitos escolhidos e por que combinam com o pedido, validar desktop e mobile, testar viewport estreito como 390px sem scroll horizontal, corrigir texto sobreposto, rodar smoke check de CLI/TUI quando aplicável.
- Responsividade/ergonomia real: valide desktop/mobile e, em viewport estreito como 390px, confirme `document.documentElement.scrollWidth <= document.documentElement.clientWidth`; em terminal/CLI/TUI, rode smoke check de saída, erro e ajuda quando aplicável.
- Proibido: interface_generica_2010, formularios_sem_hierarquia_visual, cards_cinzas_sem_identidade, layout_sem_responsividade_real, texto_estourando_ou_sobreposto.

Idioma:
- Responda no idioma do usuário.
- Em PT-BR, use vocabulário Sema canônico, acentos, cedilha, pontuação e símbolos normais.
- A DSL `.sema` pode ser ASCII; texto humano não precisa ser.
- Não traduza comandos, rotas, arquivos, endpoints, variáveis, pacotes, marcas, símbolos de código nem palavras-chave da DSL.
<!-- sema:agent-entrypoint:end -->

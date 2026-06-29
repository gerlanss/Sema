<!-- sema:agent-entrypoint:start -->
# Sema para copilot

Este workspace ÃƒÆ’Ã‚Â© governado por Sema. Antes de qualquer aÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o em cÃƒÆ’Ã‚Â³digo, contrato, documentaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o operacional, workflow, profile ou deploy:

1. Leia `SEMA_BOOT.md`.
2. Em IDE local, rode `sema --version`; se falhar, pare. A IA nÃƒÆ’Ã‚Â£o acessa o painel Sema: peÃƒÆ’Ã‚Â§a ao humano para instalar a CLI pelo painel. Depois rode `sema preflight resumo --json`; se `decisao` nÃƒÆ’Ã‚Â£o for `use_cli_local`, pare.
3. Use CLI local: `sema resumo`, `sema docs-impacto`, `sema inspecionar`, `sema drift` e `sema impacto`.
4. NÃƒÆ’Ã‚Â£o use fonte externa de workspace para substituir a CLI local quando a CLI estiver operacional.
5. Chame docs-impacto com a intenÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o declarada antes de agir.
6. Chame inspecionar no contrato `.sema` aplicÃƒÆ’Ã‚Â¡vel.
7. Antes de editar cÃƒÆ’Ã‚Â³digo existente, rode drift e impacto.
8. Antes de criar ou editar `.sema`, use exemplos oficiais.
9. Ao concluir mudanÃƒÆ’Ã‚Â§a de contrato, rode validar.
10. Antes de finalizar, use finalizar-mudanca com as docs lidas.

ÃƒÆ’Ã¢â‚¬Â° proibido substituir esse fluxo por leitura manual de `AGENTS.md`, `README.md`, busca local por arquivos, inferÃƒÆ’Ã‚Âªncia pelo nome do projeto, bom senso ou ferramenta nÃƒÆ’Ã‚Â£o citada nesta lista.

Capacidade padrÃƒÆ’Ã‚Â£o deste cliente: media.
Ordem de leitura: SEMA_BOOT.md -> agent-context-pack.json -> resumo.curto.txt -> briefing.min.json -> drift.json -> resumo.md.

PolÃƒÆ’Ã‚Â­ticas da plataforma:
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
- Timeout local do agente nÃƒÆ’Ã‚Â£o ÃƒÆ’Ã‚Â© falha do Sema.
- Se uma chamada Sema estourar, aumente o timeout e tente de novo antes de declarar bloqueio.
- Para projeto inteiro, comece com 120s ou mais; se for lento, escale 120s -> 300s -> 600s.
- Se possÃƒÆ’Ã‚Â­vel, reduza escopo para `sema resumo <arquivo.sema> --micro --para mudanca`.

CÃƒÆ’Ã‚Â³digo governado:
- Mantenha o marcador `SEMA-GOVERNED` em cÃƒÆ’Ã‚Â³digo gerado ou governado.
- Ao encontrar esse marcador, volte ao contrato .sema aplicÃƒÆ’Ã‚Â¡vel e chame Sema antes de editar.
- ComentÃƒÆ’Ã‚Â¡rio de cÃƒÆ’Ã‚Â³digo ÃƒÆ’Ã‚Â© lembrete curto; nÃƒÆ’Ã‚Â£o substitui drift, docs-impacto nem finalizar-mudanca.
- ValidaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o inline prova o payload enviado; nÃƒÆ’Ã‚Â£o dispensa o marcador no arquivo fÃƒÆ’Ã‚Â­sico sincronizado.
- Payload inline acima de 262144 caracteres nÃƒÆ’Ã‚Â£o deve virar retry de timeout: modularize por responsabilidade ou use anexo/caminho de servidor autorizado.
- Se um arquivo crescer, divida por responsabilidade real. Em web: `index.html`, `styles/*.css`, `js/state.js`, `js/calc.js`, `js/render/*.js`, `data/*.json`. NÃƒÆ’Ã‚Â£o fatie em p1/p2 sem fronteira semÃƒÆ’Ã‚Â¢ntica.

Sinal e evidÃƒÆ’Ã‚Âªncia:
- Score composto, `achados[]` e `decisaoAgente` orientam a aÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o; abaixo de 80 bloqueia, alvo evolui 0.5 ponto atÃƒÆ’Ã‚Â© 100, e nada substitui evidÃƒÆ’Ã‚Âªncia concreta.
- Palavra-chave ou regex passando nÃƒÆ’Ã‚Â£o prova governanÃƒÆ’Ã‚Â§a se contrato, cÃƒÆ’Ã‚Â³digo e comportamento nÃƒÆ’Ã‚Â£o batem.
- `sema drift --json` com `sucesso:false`, `vinculos_quebrados`, `rotas_divergentes` ou impls quebradas bloqueia fechamento. NÃƒÆ’Ã‚Â£o diga "drift limpo" atÃƒÆ’Ã‚Â© rodar de novo e ficar verde.
- Caminho fora do workspace local aberto pelo usuÃƒÆ’Ã‚Â¡rio nÃƒÆ’Ã‚Â£o substitui a pasta local.

Acabamento visual e terminal:
- Se houver site, sistema, app, UI, painel, jogo, CLI/TUI ou terminal, acabamento moderno, contextual e nÃƒÆ’Ã‚Â£o genÃƒÆ’Ã‚Â©rico ÃƒÆ’Ã‚Â© requisito governado, nÃƒÆ’Ã‚Â£o enfeite.
- Capacidade media: Defina intenção de experiência antes de codar: público, domínio, workflow real, densidade, tokens, componentes, tecnologia/biblioteca/efeitos adequados, estados, responsividade e anti-2010. O domínio manda na solução: agro, finanças, saúde, game e e-commerce não podem compartilhar a mesma casca. Rode ou peça screenshot/browser check quando houver UI e smoke check quando for terminal.
- EvidÃƒÆ’Ã‚Âªncias: registrar tokens e componentes usados, registrar bibliotecas, APIs ou efeitos escolhidos e por que combinam com o pedido, validar desktop e mobile, testar viewport estreito como 390px sem scroll horizontal, corrigir texto sobreposto, rodar smoke check de CLI/TUI quando aplicável.
- Responsividade/ergonomia real: valide desktop/mobile e, em viewport estreito como 390px, confirme `document.documentElement.scrollWidth <= document.documentElement.clientWidth`; em terminal/CLI/TUI, rode smoke check de saÃƒÆ’Ã‚Â­da, erro e ajuda quando aplicÃƒÆ’Ã‚Â¡vel.
- Proibido: interface_generica_2010, formularios_sem_hierarquia_visual, cards_cinzas_sem_identidade, layout_sem_responsividade_real, texto_estourando_ou_sobreposto.

Idioma:
- Responda no idioma do usuÃƒÆ’Ã‚Â¡rio.
- Em PT-BR, use vocabulÃƒÆ’Ã‚Â¡rio Sema canÃƒÆ’Ã‚Â´nico, acentos, cedilha, pontuaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o e sÃƒÆ’Ã‚Â­mbolos normais.
- A DSL `.sema` pode ser ASCII; texto humano nÃƒÆ’Ã‚Â£o precisa ser.
- NÃƒÆ’Ã‚Â£o traduza comandos, rotas, arquivos, endpoints, variÃƒÆ’Ã‚Â¡veis, pacotes, marcas, sÃƒÆ’Ã‚Â­mbolos de cÃƒÆ’Ã‚Â³digo nem palavras-chave da DSL.
<!-- sema:agent-entrypoint:end -->

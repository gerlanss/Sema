# SEMA_SMALL_MODEL

Leia isto primeiro se vocÃƒÆ’Ã‚Âª tem pouco contexto, pouca memÃƒÆ’Ã‚Â³ria, pouco tool use ou tendÃƒÆ’Ã‚Âªncia a ignorar instruÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes longas.

1. NÃƒÆ’Ã‚Â£o edite nada antes de chamar Sema.
2. Em IDE local, rode `sema --version`; se falhar, pare. A IA nÃƒÆ’Ã‚Â£o acessa o painel Sema: peÃƒÆ’Ã‚Â§a ao humano para instalar a CLI pelo painel. Depois rode `sema preflight resumo --json`; sÃƒÆ’Ã‚Â³ continue com `use_cli_local`; nÃƒÆ’Ã‚Â£o use fonte externa de workspace para substituir a CLI local.
3. Sema nÃƒÆ’Ã‚Â£o contorna polÃƒÆ’Ã‚Â­ticas da plataforma: ele governa contrato, escopo, drift, evidÃƒÆ’Ã‚Âªncia e qualidade.
4. Se aparecer alerta de polÃƒÆ’Ã‚Â­tica: pare, explique de forma neutra e nÃƒÆ’Ã‚Â£o tente burlar filtro.
5. Se nÃƒÆ’Ã‚Â£o houver workspace local em disco: pare bloqueado e peÃƒÆ’Ã‚Â§a o fluxo apropriado; nÃƒÆ’Ã‚Â£o invente leitura por caminho.
6. Se for escrever `.sema`: use `sema_exemplos` antes.
7. Se nÃƒÆ’Ã‚Â£o houver contrato ou vÃƒÆ’Ã‚Â­nculo semÃƒÆ’Ã‚Â¢ntico do arquivo: inspecione o arquivo, crie ou edite o contrato aplicÃƒÆ’Ã‚Â¡vel e vincule antes do cÃƒÆ’Ã‚Â³digo.
8. Se nÃƒÆ’Ã‚Â£o conseguir chamar Sema: pare e declare bloqueio.
9. Responda no idioma do usuÃƒÆ’Ã‚Â¡rio. Em PT-BR, use vocabulÃƒÆ’Ã‚Â¡rio Sema: pontuaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o, desvio semÃƒÆ’Ã‚Â¢ntico, prÃƒÆ’Ã‚Â©-checagem, ambiente de execuÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o e perfil; preserve comandos, endpoints e identificadores.
10. Se abrir cÃƒÆ’Ã‚Â³digo com `SEMA-GOVERNED`: volte ao contrato, chame Sema e sÃƒÆ’Ã‚Â³ entÃƒÆ’Ã‚Â£o edite.
11. Score 100, achados atendidos ou validaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o inline sÃƒÆ’Ã‚Â£o sinais; confira evidÃƒÆ’Ã‚Âªncia real no contrato e no cÃƒÆ’Ã‚Â³digo.
12. ValidaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o inline nÃƒÆ’Ã‚Â£o dispensa cabeÃƒÆ’Ã‚Â§alho `SEMA-GOVERNED` no arquivo fÃƒÆ’Ã‚Â­sico.
13. NÃƒÆ’Ã‚Â£o crie cÃƒÆ’Ã‚Â³digo governado acima de 2000 linhas nem contrato .sema acima de 500; acima de 1000 em cÃƒÆ’Ã‚Â³digo ou 300 em .sema, planeje divisÃƒÆ’Ã‚Â£o por responsabilidade.
14. Divida por funÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o real: HTML, CSS, estado, cÃƒÆ’Ã‚Â¡lculo, renderizaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o, dados. NÃƒÆ’Ã‚Â£o faÃƒÆ’Ã‚Â§a `index_p1.html` e `index_p2.html` sem sentido.
15. Payload inline acima de 262144 caracteres nÃƒÆ’Ã‚Â£o ÃƒÆ’Ã‚Â© lentidÃƒÆ’Ã‚Â£o: divida por responsabilidade; nÃƒÆ’Ã‚Â£o aumente timeout para tentar passar limite de transporte.
16. Se aparecer caminho que nÃƒÆ’Ã‚Â£o pertence ao workspace local aberto pelo usuÃƒÆ’Ã‚Â¡rio, pare e confirme a fonte antes de agir.
17. Se Sema estourar por timeout local: aumente o timeout e tente de novo. NÃƒÆ’Ã‚Â£o trate isso como falha do Sema.
18. Se `sema drift --json` retornar `sucesso:false`, `vinculos_quebrados`, `rotas_divergentes` ou impl quebrada, nÃƒÆ’Ã‚Â£o conclua. Corrija contrato/cÃƒÆ’Ã‚Â³digo e rode drift de novo.
19. Se a tarefa tiver site, sistema, app, UI, painel, jogo, CLI/TUI ou terminal: aplique acabamento moderno, contextual, responsivo/ergonÃƒÆ’Ã‚Â´mico, com hierarquia clara, estados e evidÃƒÆ’Ã‚Âªncia. Em UI, valide mobile/desktop e prove `scrollWidth <= clientWidth` em viewport estreito como 390px.
20. NÃƒÆ’Ã‚Â£o substitua o contexto Sema por AGENTS.md, README.md, busca local, inferÃƒÆ’Ã‚Âªncia por nome ou bom senso.

Ordem curta:

- `SEMA_BOOT.md`
- `SEMA_BRIEF.micro.txt`
- `AGENT_CONTEXT_PACK.json`
- `SEMA_INDEX.json`
- `AGENTS.md`

PolÃƒÆ’Ã‚Â­ticas da plataforma:

- O Sema governa contrato, escopo, drift, evidência e qualidade do projeto. Ele não pede, não autoriza e não contorna políticas da plataforma, termos de uso, permissões, segurança ou leis.
- IA fraca: Se aparecer alerta de política, pare. Diga que Sema é governança de projeto, não bypass; peça reformulação segura ou contexto permitido.
- Se houver bloqueio externo: Se um cliente, modelo ou classificador bloquear a mensagem, trate como bloqueio externo ou falso positivo possível: explique de forma neutra, preserve a intenção legítima de governança e não tente burlar filtros.

Timeout:

- Timeout local do agente nÃƒÆ’Ã‚Â£o ÃƒÆ’Ã‚Â© falha do Sema.
- Projeto inteiro: comece com 120s ou mais.
- Escalonamento: 120s -> 300s -> 600s.
- Se o projeto inteiro for lento, escopar para `sema resumo <arquivo.sema> --micro --para mudanca`.
- Tente de novo com timeouts maiores enquanto houver execução disponível; se o ambiente impedir continuar, pare bloqueado e não avance com código sem Sema.

Acabamento visual e terminal:

- Quando a tarefa envolve site, sistema, app, interface, dashboard, painel, formulário, landing, jogo, terminal, CLI/TUI ou qualquer artefato voltado ao usuário, o Sema governa também acabamento, modernidade e adequação ao domínio. Beleza funcional, identidade, criatividade útil, tecnologia adequada, estados, responsividade e evidência não são extras opcionais.
- IA fraca: Use um padrão moderno seguro e contextual: hierarquia clara, espaçamento consistente, paleta com contraste, componentes coerentes com o domínio, estados básicos, responsivo mobile/desktop e nada de formulário cinza genérico. Em terminal, entregue saída organizada com status e erro claros. Se não conseguir validar o resultado, pare e peça revisão.
- EvidÃƒÆ’Ã‚Âªncia mÃƒÆ’Ã‚Â­nima: descrever padrão visual escolhido, explicar como o domínio aparece na interface ou terminal, confirmar responsividade básica, provar mobile sem overflow horizontal com scrollWidth <= clientWidth, listar estados essenciais.
- Proibido: interface_generica_2010, formularios_sem_hierarquia_visual, cards_cinzas_sem_identidade, layout_sem_responsividade_real, texto_estourando_ou_sobreposto.

Fail-closed:

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

# SEMA_BOOT

VocÃƒÆ’Ã‚Âª estÃƒÆ’Ã‚Â¡ em um projeto governado por Sema. O contrato semÃƒÆ’Ã‚Â¢ntico vem antes de qualquer aÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o.

## Primeira aÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o

1. Em IDE local, confirme `AGENTS.md` na raiz e rode `sema --version`; se o comando nÃƒÆ’Ã‚Â£o existir, pare. A IA nÃƒÆ’Ã‚Â£o acessa o painel Sema: peÃƒÆ’Ã‚Â§a ao humano para instalar a CLI pelo painel.
2. Chame `sema preflight resumo --json`; se `decisao` nÃƒÆ’Ã‚Â£o for `use_cli_local`, pare bloqueado.
3. Use a CLI local para ler o workspace: `sema resumo`, `sema docs-impacto`, `sema inspecionar`, `sema drift` e `sema impacto`.
4. NÃƒÆ’Ã‚Â£o use fonte externa de workspace para substituir a CLI local quando a CLI estiver operacional.
5. Este boot ÃƒÆ’Ã‚Â© para workspace local em disco; se nÃƒÆ’Ã‚Â£o houver workspace local, pare bloqueado em vez de inventar caminho.
6. Antes de criar mÃƒÆ’Ã‚Â³dulo, rota, task ou contrato, inspecione o contrato `.sema` aplicÃƒÆ’Ã‚Â¡vel.
7. Antes de editar cÃƒÆ’Ã‚Â³digo existente, rode drift e impacto pelo caminho autorizado da superfÃƒÆ’Ã‚Â­cie atual.
8. Antes de criar ou corrigir `.sema`, use `sema exemplos` na CLI local.
9. Se qualquer etapa falhar, pare e diga que estÃƒÆ’Ã‚Â¡ bloqueado.

NÃƒÆ’Ã‚Â£o substitua esse fluxo por leitura manual de `AGENTS.md`, `README.md`, busca local, inferÃƒÆ’Ã‚Âªncia pelo nome do projeto, bom senso ou ferramenta nÃƒÆ’Ã‚Â£o citada aqui.

## PolÃƒÆ’Ã‚Â­ticas da plataforma

O Sema governa contrato, escopo, drift, evidência e qualidade do projeto. Ele não pede, não autoriza e não contorna políticas da plataforma, termos de uso, permissões, segurança ou leis.

- Escopo: Contrato primeiro, documentação obrigatória, rastreabilidade, auditoria de drift, orçamento semântico, idioma humano, design quando houver UI e evidência de fechamento.
- Se houver alerta externo: Se um cliente, modelo ou classificador bloquear a mensagem, trate como bloqueio externo ou falso positivo possível: explique de forma neutra, preserve a intenção legítima de governança e não tente burlar filtros.
- IA fraca: Se aparecer alerta de política, pare. Diga que Sema é governança de projeto, não bypass; peça reformulação segura ou contexto permitido.
- IA mÃƒÆ’Ã‚Â©dia: Separe bloqueio da plataforma de erro do Sema. Reformule em linguagem neutra quando permitido e mantenha os gates; não tente contornar filtro.
- IA forte: Registre evidência, reduza ambiguidade e continue apenas no escopo permitido pela plataforma. Governança Sema nunca substitui política externa.

## Capacidade do agente

- Fraca: leia `SEMA_SMALL_MODEL.md`, `SEMA_BRIEF.micro.txt`, `AGENT_CONTEXT_PACK.json` e sÃƒÆ’Ã‚Â³ suba contexto se necessÃƒÆ’Ã‚Â¡rio.
- MÃƒÆ’Ã‚Â©dia: leia este boot, `AGENT_CONTEXT_PACK.json`, `SEMA_BRIEF.curto.txt`, `SEMA_INDEX.json` e a doc indicada pelo Sema.
- Forte: leia este boot, `AGENT_CONTEXT_PACK.json`, `SEMA_BRIEF.md`, `SEMA_INDEX.json`, `AGENTS.md` e rode os gates completos.

## CÃƒÆ’Ã‚Â³digo governado

Arquivos de codigo gerados ou governados pela Sema devem manter cabecalho curto com modulo de origem, contrato .sema aplicavel e descricao humana. Validacao inline prova apenas o payload enviado; o arquivo fisico ainda precisa de SEMA-GOVERNED para orientar a proxima IA. Codigo governado avisa acima de 1000 linhas e bloqueia acima de 2000. Contrato .sema avisa acima de 300 linhas e bloqueia criacao, edicao, drift, finalizacao, geracao e snapshot acima de 500. O split de .sema deve ser por dominio/capacidade, nunca parte_1/parte_2; varios contratos podem governar o mesmo arquivo de codigo via vinculos. Sema Codigo deve preservar essa rastreabilidade em cabecalhos e saidas geradas. Documentacao Markdown nao entra nesse limite de codigo; continua governada por docs-impacto, limite de bytes e verificacao de segredos. Payload inline acima de 262144 caracteres nao e caso de aumentar timeout: divida por responsabilidade ou use anexo/caminho de servidor autorizado.

- Marcador: `SEMA-GOVERNED`.
- OrÃƒÆ’Ã‚Â§amento de cÃƒÆ’Ã‚Â³digo: arquivo governado acima de 1000 linhas gera diagnÃƒÆ’Ã‚Â³stico; acima de 2000 bloqueia conclusÃƒÆ’Ã‚Â£o, geraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o e snapshot. DocumentaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o Markdown nÃƒÆ’Ã‚Â£o entra nesse limite de cÃƒÆ’Ã‚Â³digo.
- OrÃƒÆ’Ã‚Â§amento de contrato .sema: atÃƒÆ’Ã‚Â© 300 linhas ÃƒÆ’Ã‚Â© saudÃƒÆ’Ã‚Â¡vel; 301-500 ÃƒÆ’Ã‚Â© diagnÃƒÆ’Ã‚Â³stico; acima de 500 bloqueia criaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o, ediÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o, drift, finalizaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o, geraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o e snapshot.
- Divida .sema por domÃƒÆ’Ã‚Â­nio/capacidade, nunca parte_1/parte_2. Um mesmo arquivo de cÃƒÆ’Ã‚Â³digo pode ter vÃƒÆ’Ã‚Â¡rios contratos governando via vinculos; preserve essa rastreabilidade no Sema CÃƒÆ’Ã‚Â³digo.
- Payload inline: acima de 262144 caracteres em `arquivos_codigo.conteudo` ou `conteudo` nÃƒÆ’Ã‚Â£o ÃƒÆ’Ã‚Â© timeout; divida por responsabilidade ou use anexo/caminho de servidor autorizado.
- ValidaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o inline com score alto nÃƒÆ’Ã‚Â£o substitui cabeÃƒÆ’Ã‚Â§alho no arquivo fÃƒÆ’Ã‚Â­sico: ela prova o payload enviado, nÃƒÆ’Ã‚Â£o prepara a prÃƒÆ’Ã‚Â³xima IA que vai abrir o arquivo depois.
- DivisÃƒÆ’Ã‚Â£o correta ÃƒÆ’Ã‚Â© por responsabilidade real. Exemplo web: `index.html` para estrutura, `styles/*.css` para estilos, `js/state.js`, `js/calc.js`, `js/render/*.js` para comportamento, e `data/*.json` para dados.
- Proibido fatiar arquivo em `index_p1.html`, `index_p2.html` ou similares sem fronteira semÃƒÆ’Ã‚Â¢ntica sÃƒÆ’Ã‚Â³ para passar no limite.
- IA fraca: Se abrir codigo com SEMA-GOVERNED, pare, leia SEMA_SMALL_MODEL.md e chame Sema antes de editar. Nao crie codigo acima de 2000 linhas nem contrato .sema acima de 500; divida .sema por capacidade, nunca em parte_1/parte_2.
- IA mÃƒÆ’Ã‚Â©dia: Se abrir codigo com SEMA-GOVERNED, rode docs-impacto e drift antes de alterar comportamento. Trate codigo 1000+ e contrato .sema 300+ como refatoracao provavel; se o payload inline passar de 262144 caracteres, separe HTML, estilos, estado, renderizacao, calculo e dados antes de sincronizar.
- IA forte: Se abrir codigo com SEMA-GOVERNED, pode inspecionar AST/IR e codigo completo, mas mantem contrato primeiro, drift, codigo ate 2000, .sema ate 500 e finalizar-mudanca. Contexto grande nao autoriza monolito nem payload inline acima de 262144 caracteres.

## Sinal, evidÃƒÆ’Ã‚Âªncia e ritual

Score composto, `achados[]` e `decisaoAgente` sÃƒÆ’Ã‚Â£o sinais para guiar a prÃƒÆ’Ã‚Â³xima aÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o. Abaixo de 80 bloqueia; alvo evolui 0.5 ponto atÃƒÆ’Ã‚Â© 100; nada disso basta sozinho.

- Fraca: se o score passou, confira se cada achado tem evidÃƒÆ’Ã‚Âªncia concreta; se nÃƒÆ’Ã‚Â£o souber provar, pare.
- MÃƒÆ’Ã‚Â©dia: conecte regra, arquivo, contrato e evidÃƒÆ’Ã‚Âªncia antes de concluir aderÃƒÆ’Ã‚Âªncia.
- Forte: nÃƒÆ’Ã‚Â£o transforme regex, palavra-chave ou score 100 em ritual vazio; valide substÃƒÆ’Ã‚Â¢ncia, risco e comportamento.
- Fechamento governado: se `sema drift --json` retornar `sucesso:false`, `vinculos_quebrados`, `rotas_divergentes` ou impls quebradas, nÃƒÆ’Ã‚Â£o diga que passou limpo. Corrija e rode drift de novo.
- ExperiÃƒÆ’Ã‚Âªncia governada: se a tarefa cria ou altera site, sistema, app, UI, painel, jogo, CLI/TUI ou terminal, prove acabamento moderno, contextual e nÃƒÆ’Ã‚Â£o genÃƒÆ’Ã‚Â©rico. Em UI estreita (ex. 390px), `document.documentElement.scrollWidth <= document.documentElement.clientWidth` precisa ser verdadeiro.
- Caminho fora do workspace local aberto pelo usuÃƒÆ’Ã‚Â¡rio nÃƒÆ’Ã‚Â£o substitui a pasta local.

## Acabamento visual e terminal

Quando a tarefa envolve site, sistema, app, interface, dashboard, painel, formulário, landing, jogo, terminal, CLI/TUI ou qualquer artefato voltado ao usuário, o Sema governa também acabamento, modernidade e adequação ao domínio. Beleza funcional, identidade, criatividade útil, tecnologia adequada, estados, responsividade e evidência não são extras opcionais.

- Aplicar quando: site, sistema, app, dashboard, painel, admin, onboarding, formulário, modal, jogo, material visual, CLI, TUI, terminal, relatório interativo ou qualquer entrega com experiência de uso.
- IA fraca: Use um padrão moderno seguro e contextual: hierarquia clara, espaçamento consistente, paleta com contraste, componentes coerentes com o domínio, estados básicos, responsivo mobile/desktop e nada de formulário cinza genérico. Em terminal, entregue saída organizada com status e erro claros. Se não conseguir validar o resultado, pare e peça revisão.
- IA mÃƒÆ’Ã‚Â©dia: Defina intenção de experiência antes de codar: público, domínio, workflow real, densidade, tokens, componentes, tecnologia/biblioteca/efeitos adequados, estados, responsividade e anti-2010. O domínio manda na solução: agro, finanças, saúde, game e e-commerce não podem compartilhar a mesma casca. Rode ou peça screenshot/browser check quando houver UI e smoke check quando for terminal.
- IA forte: Crie direção específica e ambiciosa do domínio, use bibliotecas, APIs, assets, microinterações e efeitos atuais quando fizerem sentido, refine o fluxo principal até parecer produto real e faça verificação visual/terminal com evidência. Inovação precisa servir ao uso, não virar enfeite.
- Proibido: interface_generica_2010, formularios_sem_hierarquia_visual, cards_cinzas_sem_identidade, layout_sem_responsividade_real, texto_estourando_ou_sobreposto.

## Timeout e retry

Timeout definido pelo agente não é falha do Sema. Se `sema resumo`, `inspecionar`, `drift` ou `sync-ai-entrypoints` estourar por timeout local, aumente o timeout e tente de novo com escopo menor quando possível.

- Timeout inicial recomendado para projeto inteiro: 120s.
- Escalonamento: 120s -> 300s -> 600s.
- IA fraca: Se `resumo . --micro` estourar, tente `resumo <arquivo.sema> --micro`, depois repita com timeout maior. Timeout não autoriza editar.
- IA mÃƒÆ’Ã‚Â©dia: Prefira resumo escopado; se um gate Sema estourar, aumente timeout e repita antes de concluir falha.
- IA forte: Pode rodar projeto inteiro com timeout alto, mas deve distinguir lentidão de falha real e registrar evidência.
- Tente de novo com timeouts maiores enquanto houver execução disponível; se o ambiente impedir continuar, pare bloqueado e não avance com código sem Sema.

## Idioma humano

A linguagem humana da resposta deve seguir o idioma do usuário e preservar acentos, cedilha, pontuação e símbolos esperados. Em PT-BR, use vocabulário Sema canônico: pontuação, desvio semântico, trava, pré-checagem, ambiente de execução e perfil. A DSL .sema pode ter palavras-chave ASCII; isso não autoriza PT-BR sem acentos.

- Use o idioma falado pelo usuÃƒÆ’Ã‚Â¡rio.
- Em PT-BR, escreva com acentos, cedilha e pontuaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o normal.
- Use vocabulÃƒÆ’Ã‚Â¡rio Sema canÃƒÆ’Ã‚Â´nico para conceitos de produto: pontuaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o, desvio semÃƒÆ’Ã‚Â¢ntico, trava, prÃƒÆ’Ã‚Â©-checagem, ambiente de execuÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o e perfil.
- NÃƒÆ’Ã‚Â£o traduza comandos, rotas, nomes de arquivos, endpoints, variÃƒÆ’Ã‚Â¡veis, pacotes, marcas, sÃƒÆ’Ã‚Â­mbolos de cÃƒÆ’Ã‚Â³digo nem palavras-chave da DSL.

## Falha fechada

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

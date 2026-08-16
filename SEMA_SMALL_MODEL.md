# SEMA_SMALL_MODEL

Leia isto primeiro se você tem pouco contexto, pouca memória, pouco tool use ou tendência a ignorar instruções longas.

1. Não edite nada antes de chamar Sema.
2. Em workspace local, rode `sema --version`; se o shell falhar, use `$HOME/.sema/bin/sema` no macOS/Linux. No Windows, PowerShell usa `sema.ps1` no PATH e cmd.exe usa `sema.cmd`; o fallback absoluto é `& "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$HOME\.sema\bin\sema-managed.ps1" --version`. Só então pare e peça instalação ou reparo.
3. Sema não contorna políticas da plataforma: ele governa contrato, escopo, drift, evidência e qualidade.
4. Se aparecer alerta de política: pare, explique de forma neutra e não tente burlar filtro.
5. Se não houver workspace local em disco: pare bloqueado e peça o fluxo apropriado; não invente leitura por caminho.
6. Se for escrever `.sema`: leia `exemplos/`; se a pasta estiver ausente, rode `sema instalar-exemplos --json` antes.
7. Se não houver contrato ou vínculo semântico do arquivo: inspecione o arquivo, crie ou edite o contrato aplicável e vincule antes do código.
8. Se não conseguir chamar Sema: pare e declare bloqueio.
9. Responda no idioma do usuário. Em PT-BR, use vocabulário Sema: pontuação, desvio semântico, pré-checagem, ambiente de execução e perfil; preserve comandos, endpoints e identificadores.
10. Se abrir código com `SEMA-GOVERNED`: volte ao contrato, chame Sema e só então edite.
11. Score 100, achados atendidos ou validação inline são sinais; confira evidência real no contrato e no código.
12. Validação inline não dispensa cabeçalho `SEMA-GOVERNED` no arquivo físico.
13. Não crie código governado acima de 2000 linhas nem contrato .sema acima de 500; acima de 1000 em código ou 300 em .sema, planeje divisão por responsabilidade.
14. Divida por função real: HTML, CSS, estado, cálculo, renderização, dados. Não faça `index_p1.html` e `index_p2.html` sem sentido.
15. Payload inline acima de 262144 caracteres não é lentidão: divida por responsabilidade; não aumente timeout para tentar passar limite de transporte.
16. Se aparecer caminho que não pertence ao workspace local aberto pelo usuário, pare e confirme a fonte antes de agir.
17. Se Sema estourar por timeout local: aumente o timeout e tente de novo. Não trate isso como falha do Sema.
18. Para fechamento, rode `sema drift --cache fresh --json`; cache persistente só acelera navegação e não é prova final. Se o `payload` retornar `sucesso:false`, `vinculos_quebrados`, `rotas_divergentes` ou `impls_quebrados`, não conclua. Na 3.0.0, não procure campos de domínio no topo do envelope `sema.cli.result/v1` nem use `ok` como substituto do veredito do payload.
19. Se a tarefa tiver site, sistema, app, UI, painel, jogo, CLI/TUI ou terminal: aplique acabamento moderno, contextual, responsivo/ergonômico, com hierarquia clara, estados e evidência. Em UI, valide mobile/desktop e prove `scrollWidth <= clientWidth` em viewport estreito como 390px.
20. Não substitua o contexto Sema por AGENTS.md, README.md, busca local, inferência por nome ou bom senso.

Ordem curta:

- `SEMA_BOOT.md`
- `SEMA_BRIEF.micro.txt`
- `AGENT_CONTEXT_PACK.json`
- `SEMA_INDEX.json`
- `AGENTS.md`

Políticas da plataforma:

- O Sema governa contrato, escopo, drift, evidência e qualidade do projeto. Ele não pede, não autoriza e não contorna políticas da plataforma, termos de uso, permissões, segurança ou leis.
- IA fraca: Se aparecer alerta de política, pare. Diga que Sema é governança de projeto, não bypass; peça reformulação segura ou contexto permitido.
- Se houver bloqueio externo: Se um cliente, modelo ou classificador bloquear a mensagem, trate como bloqueio externo ou falso positivo possível: explique de forma neutra, preserve a intenção legítima de governança e não tente burlar filtros.

Timeout:

- Timeout local do agente não é falha do Sema.
- Projeto inteiro: comece com 120s ou mais.
- Escalonamento: 120s -> 300s -> 600s.
- Se o projeto inteiro for lento, escopar para `sema resumo <arquivo.sema> --micro --para mudanca --drift none`.
- Tente de novo com timeouts maiores enquanto houver execução disponível; se o ambiente impedir continuar, pare bloqueado e não avance com código sem Sema.

Acabamento visual e terminal:

- Quando a tarefa envolve site, sistema, app, interface, dashboard, painel, formulário, landing, jogo, terminal, CLI/TUI ou qualquer artefato voltado ao usuário, o Sema governa também acabamento, modernidade e adequação ao domínio. Beleza funcional, identidade, criatividade útil, tecnologia adequada, estados, responsividade e evidência não são extras opcionais.
- IA fraca: Use um padrão moderno seguro e contextual: hierarquia clara, espaçamento consistente, paleta com contraste, componentes coerentes com o domínio, estados básicos, responsivo mobile/desktop e nada de formulário cinza genérico. Em terminal, entregue saída organizada com status e erro claros. Se não conseguir validar o resultado, pare e peça revisão.
- Evidência mínima: descrever padrão visual escolhido, explicar como o domínio aparece na interface ou terminal, confirmar responsividade básica, provar mobile sem overflow horizontal com scrollWidth <= clientWidth, listar estados essenciais.
- Proibido: interface_generica_2010, formularios_sem_hierarquia_visual, cards_cinzas_sem_identidade, layout_sem_responsividade_real, texto_estourando_ou_sobreposto.

Fail-closed:

- Se não conseguir chamar Sema, pare e declare bloqueio em vez de editar código ou contrato.
- Se não houver contrato aplicável ou vínculo semântico do arquivo, inspecione o arquivo, descubra ou crie o .sema aplicável e vincule antes do código.
- Em workspace local, rode sema --version; se o shell não localizar o comando, use $HOME/.sema/bin/sema no macOS/Linux. No Windows, PowerShell usa sema.ps1 no PATH e cmd.exe usa sema.cmd; use & "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$HOME\.sema\bin\sema-managed.ps1" --version como fallback. Só então declare a CLI indisponível.
- Se não houver workspace local em disco, pare bloqueado e peça o fluxo apropriado; não invente caminho nem substitua a CLI local por ferramenta paralela.
- Se arquivos_codigo.conteudo ou conteudo inline passar de 262144 caracteres, não aumente timeout para forçar: divida por responsabilidade ou use anexo/caminho de servidor autorizado.
- Se for criar ou corrigir .sema, leia `exemplos/`; se a pasta estiver ausente, rode `sema instalar-exemplos --json` antes de escrever sintaxe.
- Se a resposta humana estiver em PT-BR, use vocabulário Sema canônico e preserve acentos mesmo que a DSL use ASCII.
- Se um arquivo de código tiver SEMA-GOVERNED, consulte Sema e o contrato aplicável antes de editar.
- Se codigo governado passar de 1000 linhas, planeje divisao; se passar de 2000, pare e divida antes de concluir. Documentacao Markdown nao entra nesse limite de codigo.
- Se contrato .sema passar de 300 linhas, planeje split por dominio/capacidade; acima de 500, criacao e edicao ficam bloqueadas. Nao use parte_1/parte_2 e nao remova guarantees, tests ou vinculos so para caber.
- Um mesmo arquivo de codigo pode ser governado por varios contratos .sema via vinculos; Sema Codigo deve preservar essa rastreabilidade.
- Se score, achados ou decisaoAgente parecerem bons, trate como sinal de triagem e confira evidência concreta no contrato e no código.
- Se validar artefato inline com 100/100, ainda preserve cabeçalho SEMA-GOVERNED no arquivo físico sincronizado.
- Se o `payload` de `sema drift --cache fresh --json` retornar sucesso:false, `vinculos_quebrados`, `rotas_divergentes` ou `impls_quebrados`, a mudança não pode ser declarada concluída; corrija contrato/código e rode drift fresh de novo.
- Se a tarefa tiver site, sistema, app, UI, painel, jogo, CLI/TUI ou terminal, nao conclua sem acabamento moderno, contextual e evidenciado; em UI mobile estreita (ex. 390px), `document.documentElement.scrollWidth <= document.documentElement.clientWidth` precisa ser verdadeiro.
- Se texto visivel PT-BR perder acento ou cedilha em termos como descricao, lancamentos, saude ou alimentacao, trate como defeito bloqueante quando houver i18n/idioma declarado.
- Se aparecer caminho que não pertence ao workspace local aberto pelo usuário, pare e confirme a fonte antes de agir.
- Se uma chamada Sema estourar por timeout local, aumente o timeout e tente de novo; timeout do agente não libera ação sem Sema.
- Se a plataforma bloquear ou alertar política, trate como bloqueio externo ou falso positivo possível; explique sem tentar contornar filtro.
- Se a tarefa tiver experiência de uso e você não conseguir garantir padrão moderno, contextual e não genérico, pare e peça revisão em vez de entregar coisa engessada.

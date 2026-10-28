# SEMA_BOOT

Comece por `sema --version` e `sema sessao "<intenção>" --json`. O retorno é navegação, não autorização de execução. A skill é acionada ao criar ou editar; num projeto já adotado, delega a este protocolo.
Declare a janela real com `--janela-contexto <tokens>`. Use `--salvar-perfil` para lembrar neste workspace; `--orcamento-contexto` limita a resposta estimada e `--reserva-saida` reserva geração. A estimativa por caracteres não é tokenização exata e não mede o contexto já usado pela conversa.

Leia somente o contrato selecionado, suas dependências declaradas e as docs bloqueantes da mudança. Referências recomendadas ficam disponíveis sob demanda. SEMA_INDEX.json e AGENT_CONTEXT_PACK.json são consultados internamente; não os carregue integralmente. Para aprofundar: `sema resumo <contrato> --micro --para mudanca --drift none --json`. Uma consulta com --drift none não comprova código; valores nulos são não avaliados.

Drift: use --pacote para receber estado, bloqueios e avisos compactos; sem --pacote o JSON completo continua disponível para aprofundar.
Antes de editar: inspecionar o contrato, docs-impacto com intenção e arquivo exato, drift fresh e impacto. Para sintaxe .sema, leia exemplos/; use instalar-exemplos se ausente. Módulo novo: contrato validado -> compilar no alvo padrão -> implementação real -> verificar. Preserve SEMA-GOVERNED, impl e vinculos. Sem contrato aplicável, modele e vincule antes do código.
Antes de concluir: validar contrato alterado, verificar/testes pertinentes, drift --cache fresh --pacote e finalizar-mudanca com --arquivo e --doc-lida. Cache acelera, não é prova final. sucesso:false, vinculos_quebrados, rotas_divergentes e impls_quebrados bloqueiam fechamento; vinculos_fora_do_escopo é informativo. Avalie payload, não só ok. Scores, regex e validação inline não substituem evidência física e comportamental.

Divida por responsabilidade: código avisa acima de 1000 linhas e bloqueia acima de 2000; .sema avisa acima de 300 e bloqueia acima de 500. Não use parte_1/parte_2. Payload inline acima de 262144 caracteres exige divisão, não retry.
UI/CLI: acabamento moderno e contextual, estados e responsividade; prove desktop/mobile sem overflow horizontal a 390px e smoke de saída, erro e ajuda no terminal. Preserve acentos no texto humano.
Timeout do agente não é falha do Sema: reduza escopo e tente 120s -> 300s -> 600s. Se indisponível, pare antes de editar. No Windows, tente & "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$HOME\.sema\bin\sema-managed.ps1" --version; em macOS/Linux, $HOME/.sema/bin/sema --version. Só então declare a CLI indisponível.
Sema não concede autorização externa nem contorna políticas da plataforma. Confirme caminhos fora do workspace, não invente evidência e não use --force sem decisão humana explícita.

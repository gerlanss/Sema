<!-- sema:agent-entrypoint:start -->
# Sema para Codex

Use diretamente a CLI local na raiz do workspace. Sema governa; a IA executa.
1. Rode `sema --version` e `sema sessao "<intenção>" --json`.
2. Se a sessão pedir a janela de contexto, obtenha o valor realmente configurado. Não adivinhe pelo nome ou tamanho do modelo. Repita com `--janela-contexto <tokens> --salvar-perfil`; orçamento e reserva de saída são ajustáveis. Reconfigure ao trocar de modelo.
3. Leia `SEMA_BOOT.md` uma vez. Siga os contratos e caminhos indicados pela sessão; resolva ambiguidades antes de editar. Se o índice ou protocolo estiver desatualizado, rode `sema sync-codex --json`.
4. No contrato selecionado: `sema inspecionar <contrato> --drift none --json`, `sema docs-impacto --intencao "<intenção>" --arquivo <contrato> --json`, `sema drift <contrato> --cache fresh --pacote --json` e `sema impacto <contrato> --alvo <símbolo> --mudanca "<mudança>" --json`.
5. Preserve SEMA-GOVERNED, impl e vinculos. Valide contrato alterado, teste o comportamento, confira drift fresh e feche com `sema finalizar-mudanca`, informando o arquivo e as docs efetivamente lidas.

SEMA_INDEX.json e AGENT_CONTEXT_PACK.json são bases internas da CLI, sem leitura integral obrigatória. Expanda pelo contrato indicado; não carregue o projeto inteiro. Cache acelera, não é prova final.
Falha do Sema, vínculo quebrado, rota divergente ou impl quebrada impedem conclusão. Score não substitui evidência. Sema não autoriza deploy, mensagens, dinheiro, segredos, destruição nem bypass de políticas.
Use PT-BR com acentos quando esse for o idioma do usuário. Confirme escopo fora do workspace.
No Windows, tente & "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$HOME\.sema\bin\sema-managed.ps1" --version; em macOS/Linux, $HOME/.sema/bin/sema --version. Só então declare a CLI indisponível.
<!-- sema:agent-entrypoint:end -->

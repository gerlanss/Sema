# SEMA_SMALL_MODEL

Use a mesma entrada curta de qualquer IA: AGENTS.md -> sema sessao "<intenção>" --json.
Informe a janela efetiva quando solicitado. O perfil controla o orçamento; fraca/média/forte não substitui quantidade de tokens. Leia SEMA_BOOT.md uma vez e depois somente o contrato indicado. Não carregue SEMA_INDEX.json, AGENT_CONTEXT_PACK.json ou o código inteiro.
Consulta: --drift none. Fechamento: --cache fresh; cache não é prova final. Preserve SEMA-GOVERNED, os testes e os gates. Pare em ambiguidade, falha ou dependência não resolvida e solicite um recorte menor.
No Windows, tente & "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$HOME\.sema\bin\sema-managed.ps1" --version; em macOS/Linux, $HOME/.sema/bin/sema --version. Só então declare a CLI indisponível.

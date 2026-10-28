// SEMA-GOVERNED: sema.produto.governanca_ia.contexto.entrypoints
// Descrição: entrada curta para a IA consultar a CLI progressivamente, mantendo os gates de governança.
import type { AgentContextPack } from "./agentContextTipos.js";

const FALLBACK = 'No Windows, tente & "$env:SystemRoot\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$HOME\\.sema\\bin\\sema-managed.ps1" --version; em macOS/Linux, $HOME/.sema/bin/sema --version. Só então declare a CLI indisponível.';

export function renderizarInstrucaoCodexSema(_pack: AgentContextPack): string {
  return `# Sema para Codex

Use diretamente a CLI local na raiz do workspace. Sema governa; a IA executa.
1. Rode \`sema --version\` e \`sema sessao "<intenção>" --json\`.
2. Se a sessão pedir a janela de contexto, obtenha o valor realmente configurado. Não adivinhe pelo nome ou tamanho do modelo. Repita com \`--janela-contexto <tokens> --salvar-perfil\`; orçamento e reserva de saída são ajustáveis. Reconfigure ao trocar de modelo.
3. Leia \`SEMA_BOOT.md\` uma vez. Siga os contratos e caminhos indicados pela sessão; resolva ambiguidades antes de editar. Se o índice ou protocolo estiver desatualizado, rode \`sema sync-codex --json\`.
4. No contrato selecionado: \`sema inspecionar <contrato> --drift none --json\`, \`sema docs-impacto --intencao "<intenção>" --arquivo <contrato> --json\`, \`sema drift <contrato> --cache fresh --pacote --json\` e \`sema impacto <contrato> --alvo <símbolo> --mudanca "<mudança>" --json\`.
5. Preserve SEMA-GOVERNED, impl e vinculos. Valide contrato alterado, teste o comportamento, confira drift fresh e feche com \`sema finalizar-mudanca\`, informando o arquivo e as docs efetivamente lidas.

SEMA_INDEX.json e AGENT_CONTEXT_PACK.json são bases internas da CLI, sem leitura integral obrigatória. Expanda pelo contrato indicado; não carregue o projeto inteiro. Cache acelera, não é prova final.
Falha do Sema, vínculo quebrado, rota divergente ou impl quebrada impedem conclusão. Score não substitui evidência. Sema não autoriza deploy, mensagens, dinheiro, segredos, destruição nem bypass de políticas.
Use PT-BR com acentos quando esse for o idioma do usuário. Confirme escopo fora do workspace.
${FALLBACK}
`;
}

export function renderizarSemaBoot(_pack: AgentContextPack): string {
  return `# SEMA_BOOT

Comece por \`sema --version\` e \`sema sessao "<intenção>" --json\`. O retorno é navegação, não autorização de execução. A skill é acionada ao criar ou editar; num projeto já adotado, delega a este protocolo.
Declare a janela real com \`--janela-contexto <tokens>\`. Use \`--salvar-perfil\` para lembrar neste workspace; \`--orcamento-contexto\` limita instruções locais mais a entrega estimada e \`--reserva-saida\` reserva geração. A estimativa por caracteres não é tokenização exata e não mede o contexto já usado pela conversa.

O resumo selecionado pela CLI é opcional: não leia se a sessão já entregou o contexto necessário. Não repita leituras já presentes e atualizadas.
Leia somente o contrato selecionado, suas dependências declaradas e as docs bloqueantes da mudança. Referências recomendadas ficam disponíveis sob demanda. SEMA_INDEX.json e AGENT_CONTEXT_PACK.json são consultados internamente; não os carregue integralmente. Para aprofundar: \`sema resumo <contrato> --micro --para mudanca --drift none --json\`. Uma consulta com --drift none não comprova código; valores nulos são não avaliados.

Drift: use --pacote para receber estado, bloqueios e avisos compactos; sem --pacote o JSON completo continua disponível para aprofundar.
Antes de editar: inspecionar o contrato, docs-impacto com intenção e arquivo exato, drift fresh e impacto. Para sintaxe .sema, leia exemplos/; use instalar-exemplos se ausente. Módulo novo: contrato validado -> compilar no alvo padrão -> implementação real -> verificar. Preserve SEMA-GOVERNED, impl e vinculos. Sem contrato aplicável, modele e vincule antes do código.
Antes de concluir: validar contrato alterado, verificar/testes pertinentes, drift --cache fresh --pacote e finalizar-mudanca com --arquivo e --doc-lida. Cache acelera, não é prova final. sucesso:false, vinculos_quebrados, rotas_divergentes e impls_quebrados bloqueiam fechamento; vinculos_fora_do_escopo é informativo. Avalie payload, não só ok. Scores, regex e validação inline não substituem evidência física e comportamental.

Divida por responsabilidade: código avisa acima de 1000 linhas e bloqueia acima de 2000; .sema avisa acima de 300 e bloqueia acima de 500. Não use parte_1/parte_2. Payload inline acima de 262144 caracteres exige divisão, não retry.
UI/CLI: acabamento moderno e contextual, estados e responsividade; prove desktop/mobile sem overflow horizontal a 390px e smoke de saída, erro e ajuda no terminal. Preserve acentos no texto humano.
Timeout do agente não é falha do Sema: reduza escopo e tente 120s -> 300s -> 600s. Se indisponível, pare antes de editar. ${FALLBACK}
Sema não concede autorização externa nem contorna políticas da plataforma. Confirme caminhos fora do workspace, não invente evidência e não use --force sem decisão humana explícita.
`;
}

export function renderizarSemaSmallModel(_pack: AgentContextPack): string {
  return `# SEMA_SMALL_MODEL

Use a mesma entrada curta de qualquer IA: AGENTS.md -> sema sessao "<intenção>" --json.
Informe a janela efetiva quando solicitado. O perfil controla o orçamento; fraca/média/forte não substitui quantidade de tokens. Leia SEMA_BOOT.md uma vez e depois somente o contrato indicado. Não carregue SEMA_INDEX.json, AGENT_CONTEXT_PACK.json ou o código inteiro.
Consulta: --drift none. Fechamento: --cache fresh --pacote; cache não é prova final. Preserve SEMA-GOVERNED, os testes e os gates. Pare em ambiguidade, falha ou dependência não resolvida e solicite um recorte menor.
${FALLBACK}
`;
}

// SEMA-GOVERNED: sema.produto.pipeline_conteudo.cli, sema.produto.cli_invocacao_publica
// Descrição: renderiza a ajuda pública do pipeline de conteúdo sem carregar o runtime operacional.

export const USOS_PIPELINE_CONTEUDO = [
  "sema conteudo capabilities --json",
  "sema conteudo validar <definition.json> --json",
  "sema conteudo planejar <definition.json> --alvos-arquivo <targets.json> --json",
  "sema conteudo validar-envelope --envelope-arquivo <envelope.json> --confianca-arquivo <trust.json> --trust-root-digest <sha256:...> --revocation-digest <sha256:...> --payload-type <type> --json",
  "sema conteudo registrar <ledger.ndjson> --envelope-arquivo <envelope.json> --politica-arquivo <policy-envelope.json> --confianca-arquivo <trust.json> --trust-root-digest <sha256:...> --revocation-digest <sha256:...> --ledger-id <id> --expected-head <sha256:...> --json",
  "sema conteudo status <definition.json> --politica-arquivo <policy-envelope.json> --confianca-arquivo <trust.json> --trust-root-digest <sha256:...> --revocation-digest <sha256:...> --ledger-arquivo <ledger.ndjson> --expected-head <sha256:...> --json",
  "sema conteudo projetar <definition.json> --politica-arquivo <policy-envelope.json> --confianca-arquivo <trust.json> --trust-root-digest <sha256:...> --revocation-digest <sha256:...> --ledger-arquivo <ledger.ndjson> --expected-head <sha256:...> --saida <manifest.json> --json",
] as const;

export function criarAjudaPipelineConteudo(): Record<string, unknown> {
  const mensagem = [
    "Sema Content Pipeline — controle AI-native multicanal e multiformato.",
    "",
    "Uso:",
    ...USOS_PIPELINE_CONTEUDO.map((uso) => `  ${uso}`),
    "",
    "O runner é externo e avança somente pelos nextActions derivados pelo Sema.",
    "Evidências entram como envelopes assinados; vereditos e transições não são escritos manualmente.",
    "Não existe revisão humana nativa. Chaves privadas permanecem nos processos signatários independentes.",
  ].join("\n");
  return {
    sucesso: true,
    comando: "ajuda",
    mensagem,
    usos: USOS_PIPELINE_CONTEUDO,
    nativeHumanReview: false,
    runner: "external",
    canonicalState: "signed_hash_chained_ledger",
  };
}

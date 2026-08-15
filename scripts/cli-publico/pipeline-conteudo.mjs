// SEMA-GOVERNED: sema.produto.pipeline_conteudo.cli
// Consulte contratos/sema/pipeline_conteudo_cli.sema antes de editar.
// Descricao: valida ajuda e capabilities AI-native do pipeline de conteudo no pacote instalado.

export function validarPipelineConteudoInstalado({ semaBin, sandbox, executarComSaida }) {
  const ajudaConteudo = executarComSaida(process.execPath, [semaBin, "conteudo", "--help"], sandbox);
  for (const uso of ["sema conteudo validar", "sema conteudo validar-envelope", "sema conteudo registrar", "sema conteudo projetar"]) {
    if (!ajudaConteudo.includes(uso)) {
      throw new Error(`The installed content pipeline help is missing ${uso}.`);
    }
  }
  if (!ajudaConteudo.includes("Não existe revisão humana nativa") || !ajudaConteudo.includes("nextActions")) {
    throw new Error("The installed content pipeline help does not state its AI-native runner boundary.");
  }

  const capabilitiesConteudo = JSON.parse(
    executarComSaida(process.execPath, [semaBin, "conteudo", "capabilities", "--json"], sandbox),
  );
  if (
    capabilitiesConteudo.sucesso !== true ||
    capabilitiesConteudo.nativeHumanReview !== false ||
    capabilitiesConteudo.runner !== "external" ||
    capabilitiesConteudo.canonicalState !== "signed_hash_chained_ledger"
  ) {
    throw new Error("The installed content pipeline capabilities do not preserve the contracted AI-native boundary.");
  }
}

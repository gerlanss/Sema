// SEMA-GOVERNED: sema.produto.orquestracao_profiles
// Descricao: orquestracao IA-first de profiles, starters e gates criativos; consulte contratos/sema/orquestracao_profiles.sema antes de editar.

export function expandirIntencaoSemanticaProfile(contrato: string, profile?: string, termoDetectado?: string) {
  const texto = `${contrato} ${profile ?? ""} ${termoDetectado ?? ""}`.toLowerCase();
  const expansoes = [];
  if (/campanha|publica|instagram|social/.test(texto)) {
    expansoes.push("copywriting", "qa_criativo", "publicacao_multicanal");
  }
  if (/imagem|foto|thumb|visual/.test(texto)) {
    expansoes.push("imagens", "edicao_fotos", "identidade_marca");
  }
  return {
    expansoes: [...new Set(expansoes)],
    requisitos_inferidos: expansoes.map((item) => `${item}_declarado`),
    exige_declaracao: expansoes.length > 0,
  };
}

export function sugerirStarterPresetProfile(profile: string, preset: string | undefined, requisitosPendentes: string[]) {
  const contrato = `module starter.${profile} {\n  docs { resumo: \"Starter ${profile}${preset ? ` ${preset}` : ""}\" }\n}`;
  return {
    starter: { profile, preset: preset ?? "padrao", contrato, requisitos_cobertos: requisitosPendentes },
    contrato_minimo: contrato,
    deve_aplicar_como_patch: requisitosPendentes.length > 0,
  };
}

export function validarPipelineProfiles(pipeline: string, contrato: string, artefato: string | undefined, maturidade: string) {
  const matriz = [
    { profile: "software", decisao: contrato ? "continuar" : "parar" },
    { profile: "qa_criativo", decisao: artefato ? "continuar_com_ressalva" : "nao_aplicavel" },
  ];
  const bloqueado = !pipeline || !contrato || !maturidade;
  return {
    decisao_global: bloqueado ? "parar" : "continuar",
    matriz,
    motivo_principal: bloqueado ? "pipeline, contrato e maturidade sao obrigatorios" : "pipeline possui contexto minimo",
    proxima_acao: bloqueado ? "declarar_contexto" : "validar_profiles_especificos",
  };
}

export function exigirQaCriativoQuandoPublicavel(contrato: string, profile: string, artefatoPublicavel: boolean) {
  const qaRequerido = artefatoPublicavel && /copywriting|imagens|videos|publicacao|qa_criativo/.test(`${contrato} ${profile}`);
  return {
    qa_requerido: qaRequerido,
    gate_final: qaRequerido ? "rodar_qa_criativo" : "qa_nao_obrigatorio",
  };
}

export function catalogoDropdownOnboarding(publico: string, contexto: string) {
  return {
    pipelines: ["campanha_produto", "proposta_comercial", "conteudo_youtube"],
    starters: [`${publico || "agente"}_${contexto || "geral"}`],
    profiles_principais: ["software", "copywriting", "qa_criativo", "publicacao_multicanal"],
  };
}

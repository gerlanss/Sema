// SEMA-GOVERNED: sema.produto.cli_sessao
// Descricao: comando sessao devolve envelope compacto de abertura governada.

import path from "node:path";
import { verificarFrescorArtefatos } from "./index.part04.js";
import { carregarProjeto } from "./projetoCarregar.js";
import { resolverDocumentacaoObrigatoria } from "./docs.js";

export interface SessaoEnvelope {
  comando: "sessao";
  sucesso: boolean;
  workspace: {
    baseProjeto: string;
    nomePasta: string;
    hashContratos: string;
    cliVersao: string;
  };
  frescor: {
    fresco: boolean;
    hashArtefato: string | null;
    hashAtual: string;
    sugestao: string;
  };
  contratos: {
    total: number;
    modulos: string[];
  };
  intencoes: {
    intencao: string;
    categorias: string[];
    docsBloqueantes: string[];
    docsRecomendadas: string[];
  };
  gates: {
    drift: string;
    validar: string;
    verificar: string;
    finalizar: string;
  };
  proximosPassos: string[];
}

export async function comandoSessao(
  posicionais: string[],
  args: string[],
  emJson: boolean,
  cwd = process.cwd(),
): Promise<number> {
  const intencao = posicionais[0] ?? args.find((arg) => arg.startsWith("--intencao="))?.split("=")[1] ?? "";
  const entrada = posicionais[1];
  const baseProjeto = entrada ? path.resolve(cwd, entrada) : cwd;

  const contextoProjeto = await carregarProjeto(entrada, cwd, {
    escopo: "projeto",
    adiarDescobertaCodigo: true,
  });

  const pacoteCli = (await import("../package.json", { with: { type: "json" } })).default;
  const frescor = await verificarFrescorArtefatos(contextoProjeto.baseProjeto);
  const modulosNomes = contextoProjeto.modulosSelecionados.map((item) =>
    item.resultado.modulo?.nome ?? path.basename(item.caminho, ".sema"),
  );

  let categorias: string[] = [];
  let docsBloqueantes: string[] = [];
  let docsRecomendadas: string[] = [];
  if (intencao.trim()) {
    const impacto = await resolverDocumentacaoObrigatoria({
      baseProjeto: contextoProjeto.baseProjeto,
      intencao,
      arquivosAlvo: [],
      criarAusentes: false,
    });
    categorias = impacto.categorias;
    docsBloqueantes = impacto.leituraObrigatoria
      .filter((doc) => doc.obrigatoriedade !== "recomendada" && doc.existe)
      .map((doc) => doc.relativo);
    docsRecomendadas = impacto.leituraRecomendada.map((doc) => doc.relativo);
  }

  const envelope: SessaoEnvelope = {
    comando: "sessao",
    sucesso: true,
    workspace: {
      baseProjeto: contextoProjeto.baseProjeto,
      nomePasta: path.basename(contextoProjeto.baseProjeto),
      hashContratos: frescor.hashAtual,
      cliVersao: pacoteCli.version,
    },
    frescor,
    contratos: {
      total: contextoProjeto.modulosSelecionados.length,
      modulos: modulosNomes.slice(0, 10),
    },
    intencoes: {
      intencao,
      categorias,
      docsBloqueantes,
      docsRecomendadas,
    },
    gates: {
      drift: "sema drift . --escopo projeto --cache fresh --json",
      validar: "sema validar contratos --json",
      verificar: "sema verificar contratos --alvo typescript --json",
      finalizar: 'sema finalizar-mudanca --intencao "<intencao>" --doc-lida <doc> --json',
    },
    proximosPassos: [
      ...(!frescor.fresco ? ["Artefatos stale detectados — rode sema sync-codex --json antes de agir"] : []),
      ...(docsBloqueantes.length > 0 ? [`Leia antes de agir: ${docsBloqueantes.slice(0, 5).join(", ")}`] : []),
      ...(intencao.trim() ? ["Siga o protocolo AGENTS.md passo a passo"] : ["Declare --intencao para receber gates especificos"]),
    ],
  };

  if (emJson) {
    console.log(JSON.stringify(envelope, null, 2));
    return 0;
  }

  console.log(`Sessao Sema — ${envelope.workspace.nomePasta}`);
  console.log(`  Hash contratos: ${envelope.workspace.hashContratos}`);
  console.log(`  CLI: ${envelope.workspace.cliVersao}`);
  console.log(`  Frescor: ${frescor.fresco ? "fresco" : "STALE"} ${!frescor.fresco ? `(${frescor.sugestao})` : ""}`);
  console.log(`  Contratos: ${envelope.contratos.total}`);
  if (intencao) {
    console.log(`  Intencao: ${intencao}`);
    console.log(`  Categorias: ${categorias.join(", ")}`);
    console.log(`  Docs bloqueantes: ${docsBloqueantes.length}`);
    console.log(`  Docs recomendadas: ${docsRecomendadas.length}`);
  }
  for (const passo of envelope.proximosPassos) {
    console.log(`  → ${passo}`);
  }
  return 0;
}

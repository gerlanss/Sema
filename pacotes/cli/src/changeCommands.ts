// SEMA-GOVERNED: sema.produto.governanca_ia.documentacao.finalizacao
// Descrição: fechamento documental com escopo explícito ou retomado, sem reduzir o contrato por omissão de flags.
import { compactarDocumentoObrigatorio, resolverDocumentacaoObrigatoria, verificarDocumentacaoMudanca } from "./docs.js";
import { carregarMudanca, hashArquivoMudanca, listarMudancas, normalizarEscopo, proximasChamadas, registrarMudanca, salvarMudanca, type ChangeScope } from "./changeScope.js";

function valores(args: string[], nome: string): string[] {
  return args.flatMap((arg, i) => arg === nome ? [args[i + 1]!] : arg.startsWith(`${nome}=`) ? [arg.slice(nome.length + 1)] : []);
}

export async function executarDocumentacaoMudanca(tipo: "docs-impacto" | "finalizar-mudanca", posicionais: string[], args: string[], emJson: boolean, base = process.cwd()): Promise<number> {
  const emitir = (payload: object, codigo: number) => {
    console.log(emJson ? JSON.stringify({ comando: tipo, ...payload }) : JSON.stringify(payload, null, 2));
    return codigo;
  };
  try {
    const id = valores(args, "--mudanca-id")[0];
    const intencaoFlag = valores(args, "--intencao")[0];
    let intencao = intencaoFlag ?? posicionais[0] ?? "";
    let arquivosAlvo = [...valores(args, "--arquivo"), ...(intencaoFlag ? posicionais : posicionais.slice(1))];
    let registro: ChangeScope | undefined;
    if (id) {
      registro = await carregarMudanca(base, id);
      if ((intencao && intencao !== registro.intencao)
        || (arquivosAlvo.length && JSON.stringify(normalizarEscopo(base, arquivosAlvo)) !== JSON.stringify(registro.arquivosAlvo))) {
        return emitir({ sucesso: false, status: "escopo_divergente", mudanca: registro.id, arquivosAlvo: registro.arquivosAlvo,
          instrucoes: ["O id fixa intenção e arquivos. Para outra mudança, abra docs-impacto com intenção e arquivos explícitos."] }, 1);
      }
      intencao = registro.intencao;
      arquivosAlvo = registro.arquivosAlvo;
    }
    if (tipo === "finalizar-mudanca" && !arquivosAlvo.length) {
      return emitir({ sucesso: false, status: "escopo_necessario", mudancasDisponiveis: await listarMudancas(base),
        instrucoes: ["Use --mudanca-id <id> ou --intencao <ação> --arquivo <contrato>. Um caminho posicional isolado não é intenção. O fechamento não reduz o escopo por omissão."] }, 1);
    }
    if (!intencao.trim()) return emitir({ sucesso: false, status: "intencao_necessaria", instrucoes: ["Informe --intencao ou retome --mudanca-id."] }, 1);
    if (arquivosAlvo.length) registro ??= await registrarMudanca(base, intencao, arquivosAlvo);

    if (tipo === "docs-impacto") {
      const resultado = await resolverDocumentacaoObrigatoria({ baseProjeto: base, intencao, arquivosAlvo, criarAusentes: args.includes("--criar-ausentes") });
      const compacto = args.includes("--completo") ? resultado : { ...resultado,
        leituraObrigatoria: resultado.leituraObrigatoria.map(compactarDocumentoObrigatorio),
        docsAusentes: resultado.docsAusentes.map(compactarDocumentoObrigatorio), docsCriadas: resultado.docsCriadas.map(compactarDocumentoObrigatorio) };
      return emitir({ ...compacto, mudancaId: registro?.id, modoDocumentos: args.includes("--completo") ? "completo" : "compacto",
        escopoRegistrado: Boolean(registro),
        instrucaoEscopo: registro ? "Guarde mudancaId e retome a mesma intenção e arquivos."
          : "Consulta sem alvo fixado. Repita com --arquivo <contrato> para registrar a mudança antes de editar e fechar.",
        proximasChamadas: registro ? proximasChamadas(registro, resultado.leituraObrigatoria.map((d) => d.relativo)) : undefined }, resultado.sucesso ? 0 : 1);
    }

    const leituras = { ...registro!.leiturasDeclaradas };
    const desatualizadas: string[] = [];
    for (const [doc, hash] of Object.entries(leituras)) {
      try { if (await hashArquivoMudanca(base, doc) === hash) continue; } catch { /* documento removido ou inválido */ }
      delete leituras[doc]; desatualizadas.push(doc);
    }
    // Valida todas as declarações antes de salvar; não aceita arquivos inexistentes como leitura.
    for (const doc of valores(args, "--doc-lida")) {
      const [relativo] = normalizarEscopo(base, [doc]);
      leituras[relativo!] = await hashArquivoMudanca(base, relativo!);
    }
    registro!.leiturasDeclaradas = leituras;
    const resultado = await verificarDocumentacaoMudanca({ baseProjeto: base, intencao, arquivosAlvo, docsLidas: Object.keys(leituras) });
    await salvarMudanca(base, registro!);
    return emitir({ ...resultado, mudancaId: registro!.id, arquivosAlvo,
      status: resultado.sucesso ? "documentacao_conferida" : "documentacao_pendente",
      alcance: "Somente escopo e declarações de leitura documental. Não executa validar, drift ou testes; não comprova compreensão nem conclusão integral.",
      leiturasDesatualizadas: desatualizadas, tipoEvidencia: "declaracao_de_leitura_com_hash",
      proximasChamadas: proximasChamadas(registro!, resultado.docsNaoLidas.map((d) => d.relativo)),
    }, resultado.sucesso ? 0 : 1);
  } catch (erro) {
    return emitir({ sucesso: false, status: "mudanca_invalida", mensagem: (erro as Error).message,
      instrucoes: ["Confira o id, os caminhos existentes e o escopo. Retome docs-impacto com os mesmos arquivos; não omita o contrato para contornar o erro."] }, 1);
  }
}

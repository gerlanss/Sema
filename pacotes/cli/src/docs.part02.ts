// SEMA-GOVERNED: sema.produto.governanca_ia.documentacao, sema.produto.escrita_segura_workspace
// Descricao: resolve e cria documentacao obrigatoria sem escapar do workspace nem gravar lotes parcialmente.

import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { emitirDiagnosticosArquivosOrcamento } from "./driftOrcamento.js";
import {
  escreverArquivoWorkspaceSeguro,
  validarDestinosEscritaWorkspace,
} from "./workspaceWrite.js";

import { BloqueioDocumentacaoMudanca, DocumentoObrigatorioMudanca, DocumentoPlanejado, REGRAS_DOCUMENTACAO, ResultadoDocumentacaoObrigatoria, ResultadoVerificacaoDocumentacaoMudanca, adicionarDocsRaizExistentes, adicionarReadmesDeArquivos, caminhoEstaDentro, caminhoExiste, criarTemplateDoc, documentoPareceTemplateCriadoPelaSema, inferirCategorias, listarArquivosRecursivo, normalizarRelativo, normalizarTexto, resumoConteudo, termosRelacionamentoContratos } from "./docs.part01.js";

export async function adicionarContratosRelacionados(
  baseProjeto: string,
  intencao: string,
  arquivosAlvo: string[],
  registrar: (doc: DocumentoPlanejado) => void,
): Promise<void> {
  const pastaContratos = path.join(baseProjeto, "contratos");
  if (!(await caminhoExiste(pastaContratos))) {
    return;
  }

  const termos = termosRelacionamentoContratos(intencao, arquivosAlvo);
  const arquivos = (await listarArquivosRecursivo(pastaContratos)).filter((arquivo) => arquivo.endsWith(".sema"));

  for (const arquivo of arquivos) {
    const relativo = normalizarRelativo(path.relative(baseProjeto, arquivo));
    const nome = normalizarTexto(relativo);
    const relacionado = termos.some((parte) => nome.includes(parte));

    if (relacionado) {
      registrar({
        relativo,
        tipo: "contrato",
        motivo: "contrato Sema relacionado a intencao declarada",
        permitirCriacao: false,
      });
    }
  }
}

export function criarRegistrador(baseProjeto: string): {
  docs: DocumentoPlanejado[];
  registrar: (doc: DocumentoPlanejado) => void;
} {
  const docs: DocumentoPlanejado[] = [];
  const vistos = new Set<string>();

  return {
    docs,
    registrar(doc) {
      const relativo = normalizarRelativo(doc.relativo);
      const absoluto = path.resolve(baseProjeto, relativo);
      if (!caminhoEstaDentro(baseProjeto, absoluto) || vistos.has(relativo)) {
        return;
      }
      vistos.add(relativo);
      docs.push({ ...doc, relativo });
    },
  };
}

export async function resolverDocumentacaoObrigatoria(opcoes: {
  baseProjeto?: string;
  intencao: string;
  arquivosAlvo?: string[];
  criarAusentes?: boolean;
}): Promise<ResultadoDocumentacaoObrigatoria> {
  const baseProjeto = path.resolve(opcoes.baseProjeto ?? process.cwd());
  const intencao = opcoes.intencao.trim();
  const arquivosAlvo = [...new Set((opcoes.arquivosAlvo ?? []).map(normalizarRelativo).filter(Boolean))];
  const categorias = inferirCategorias(intencao, arquivosAlvo);
  const { docs, registrar } = criarRegistrador(baseProjeto);

  await adicionarDocsRaizExistentes(baseProjeto, registrar);

  for (const regra of REGRAS_DOCUMENTACAO.filter((item) => categorias.includes(item.categoria))) {
    for (const doc of regra.docs) {
      registrar(doc);
    }
  }

  await adicionarReadmesDeArquivos(baseProjeto, arquivosAlvo, registrar);
  await adicionarContratosRelacionados(baseProjeto, intencao, arquivosAlvo, registrar);

  const documentosPreparados = await Promise.all(docs.map(async (doc) => {
    const caminho = path.resolve(baseProjeto, doc.relativo);
    return {
      doc,
      caminho,
      existe: await caminhoExiste(caminho),
      template: criarTemplateDoc(doc, intencao, categorias, arquivosAlvo),
    };
  }));
  if (documentosPreparados.length > 0) {
    await validarDestinosEscritaWorkspace(
      baseProjeto,
      documentosPreparados.map(({ doc }) => doc.relativo),
    );
  }

  const leituraObrigatoria: DocumentoObrigatorioMudanca[] = [];

  for (const preparado of documentosPreparados) {
    const { doc, caminho, template } = preparado;
    let existe = preparado.existe;
    let criado = false;

    if (!existe && opcoes.criarAusentes && doc.permitirCriacao) {
      const resultado = await escreverArquivoWorkspaceSeguro(
        baseProjeto,
        doc.relativo,
        template,
      );
      existe = true;
      criado = resultado.status === "criado";
    }

    const item: DocumentoObrigatorioMudanca = {
      caminho,
      relativo: doc.relativo,
      tipo: doc.tipo,
      motivo: doc.motivo,
      existe,
      criado,
      criacaoAutomatica: doc.permitirCriacao,
      obrigatorio: true,
      template: existe ? undefined : template,
    };

    if (existe) {
      const conteudoCompleto = await readFile(caminho, "utf8");
      const conteudo = resumoConteudo(conteudoCompleto);
      item.conteudo = conteudo.conteudo;
      item.truncado = conteudo.truncado;
      item.templatePendente = documentoPareceTemplateCriadoPelaSema(conteudoCompleto) || undefined;
    }

    leituraObrigatoria.push(item);
  }

  const docsAusentes = leituraObrigatoria.filter((doc) => !doc.existe);
  const docsCriadas = leituraObrigatoria.filter((doc) => doc.criado);
  const bloqueios = docsAusentes.map((doc): BloqueioDocumentacaoMudanca => ({
    tipo: "documentacao_ausente",
    severidade: 4,
    caminho: doc.relativo,
    mensagem: doc.criacaoAutomatica
      ? `Documento obrigatorio ausente: ${doc.relativo}. Crie ou rode com --criar-ausentes antes de agir.`
      : `Documento obrigatorio ausente: ${doc.relativo}. Este documento nao e criado automaticamente pela Sema; crie ou materialize manualmente antes de agir.`,
  }));

  return {
    sucesso: bloqueios.length === 0,
    baseProjeto,
    intencao,
    categorias,
    arquivosAlvo,
    leituraObrigatoria,
    docsAusentes,
    docsCriadas,
    bloqueios,
    instrucoes: [
      "A IA deve ler todos os itens de leituraObrigatoria antes de executar a mudanca.",
      "Se docsAusentes nao estiver vazio, crie ou preencha os documentos antes de editar codigo, contrato, deploy ou configuracao.",
      "Docs criadas pela Sema sao esqueletos: preencha procedimento, validacao e rollback reais antes de finalizar.",
      "Antes de concluir, rode sema finalizar-mudanca informando as docs lidas.",
    ],
  };
}

export function normalizarDocLida(baseProjeto: string, valor: string): string {
  const semEspaco = valor.trim();
  if (!semEspaco) {
    return "";
  }
  const absoluto = path.isAbsolute(semEspaco) ? semEspaco : path.resolve(baseProjeto, semEspaco);
  return normalizarRelativo(path.relative(baseProjeto, absoluto));
}

export function compactarDocumentoObrigatorio(doc: DocumentoObrigatorioMudanca): DocumentoObrigatorioMudanca {
  const { conteudo, template, ...compacto } = doc;
  return compacto;
}

export async function verificarDocumentacaoMudanca(opcoes: {
  baseProjeto?: string;
  intencao: string;
  arquivosAlvo?: string[];
  docsLidas?: string[];
}): Promise<ResultadoVerificacaoDocumentacaoMudanca> {
  const baseProjeto = path.resolve(opcoes.baseProjeto ?? process.cwd());
  const impacto = await resolverDocumentacaoObrigatoria({
    baseProjeto,
    intencao: opcoes.intencao,
    arquivosAlvo: opcoes.arquivosAlvo,
    criarAusentes: false,
  });

  const docsLidas = [...new Set((opcoes.docsLidas ?? []).map((doc) => normalizarDocLida(baseProjeto, doc)).filter(Boolean))];
  const setDocsLidas = new Set(docsLidas);
  const docsNaoLidas = impacto.leituraObrigatoria.filter((doc) => doc.existe && !setDocsLidas.has(doc.relativo));
  const docsTemplatePendentes = impacto.leituraObrigatoria.filter((doc) => (
    doc.existe && doc.templatePendente && setDocsLidas.has(doc.relativo)
  ));
  const diagnosticosOrcamento = await emitirDiagnosticosArquivosOrcamento({
    baseProjeto,
    arquivos: opcoes.arquivosAlvo ?? [],
    exigirCabecalhoCodigoGovernado: true,
  });

  const diagnosticos: BloqueioDocumentacaoMudanca[] = [
    ...impacto.docsAusentes.map((doc): BloqueioDocumentacaoMudanca => ({
      tipo: "documentacao_ausente",
      severidade: 4,
      caminho: doc.relativo,
      mensagem: `Documento obrigatorio ausente: ${doc.relativo}.`,
    })),
    ...docsNaoLidas.map((doc): BloqueioDocumentacaoMudanca => ({
      tipo: "leitura_obrigatoria_nao_comprovada",
      severidade: 4,
      caminho: doc.relativo,
      mensagem: `Leitura obrigatoria nao comprovada: ${doc.relativo}.`,
    })),
    ...docsTemplatePendentes.map((doc): BloqueioDocumentacaoMudanca => ({
      tipo: "documentacao_template_cru",
      severidade: 4,
      caminho: doc.relativo,
      mensagem: `Documentacao obrigatoria ainda e template cru criado pela Sema: ${doc.relativo}. Edite com procedimento, validacao e rollback reais antes de finalizar.`,
    })),
    ...diagnosticosOrcamento
      .filter((diagnostico) => diagnostico.bloqueia)
      .map((diagnostico): BloqueioDocumentacaoMudanca => ({
        tipo: diagnostico.tipo === "codigo_governado_sem_cabecalho"
          ? "codigo_governado_sem_cabecalho"
          : "arquivo_monolitico",
        severidade: 4,
        caminho: diagnostico.arquivo,
        mensagem: diagnostico.mensagem,
        linhas: diagnostico.linhas,
        limite_bloqueio_linhas: diagnostico.limite_bloqueio_linhas,
      })),
  ];

  return {
    sucesso: diagnosticos.length === 0,
    baseProjeto,
    intencao: opcoes.intencao,
    categorias: impacto.categorias,
    docsLidas,
    leituraObrigatoria: impacto.leituraObrigatoria.map(compactarDocumentoObrigatorio),
    docsNaoLidas: docsNaoLidas.map(compactarDocumentoObrigatorio),
    docsAusentes: impacto.docsAusentes.map(compactarDocumentoObrigatorio),
    docsTemplatePendentes: docsTemplatePendentes.map(compactarDocumentoObrigatorio),
    diagnosticos,
    instrucoes: diagnosticos.length === 0
      ? ["Leitura documental comprovada. Continue com validar, drift e testes conforme a mudanca."]
      : ["Nao conclua a mudanca enquanto houver diagnosticos de severidade 4+."],
  };
}

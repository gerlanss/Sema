const path = require("node:path");
const { fileURLToPath, pathToFileURL } = require("node:url");
const { carregarProjetoParaDocumento } = require("./project-loader");
const {
  createConnection,
  ProposedFeatures,
  TextDocuments,
  TextDocumentSyncKind,
  DiagnosticSeverity,
  MarkupKind,
} = require("vscode-languageserver/node");
const { TextDocument } = require("vscode-languageserver-textdocument");

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

const descricoesHover = {
  module: "Define o modulo principal e o namespace semantico do arquivo.",
  use: "Importa outro modulo Sema para reaproveitar contratos, tipos e estruturas.",
  entity: "Modela uma entidade de dominio com campos e identidade semantica.",
  enum: "Modela um conjunto fechado de valores permitidos.",
  state: "Modela estado, invariantes e transicoes observaveis.",
  task: "Define uma operacao de negocio com contrato claro.",
  input: "Declara entradas da task, route ou fluxo.",
  output: "Declara saidas esperadas e rastreaveis.",
  rules: "Declara validacoes, pre-condicoes e restricoes semanticas.",
  effects: "Declara efeitos operacionais e colaterais permitidos.",
  guarantees: "Declara compromissos e pos-condicoes da operacao.",
  flow: "Orquestra tarefas, contexto, dependencias e caminhos de falha.",
  route: "Declara a borda publica de acesso a uma task.",
  error: "Declara falhas conhecidas e seu contrato publico.",
  tests: "Declara testes embutidos como ancora executavel do contrato.",
  docs: "Documentacao semantica embutida no modulo ou bloco.",
  comments: "Comentarios estruturados do bloco.",
  e: "Operador logico de conjuncao.",
  ou: "Operador logico de disjuncao.",
  nao: "Operador logico de negacao.",
  depende_de: "Expressa dependencia explicita entre etapas de flow.",
  em_sucesso: "Define o proximo passo quando uma etapa conclui com sucesso.",
  em_erro: "Define o caminho generico de falha de uma etapa.",
  por_erro: "Define ramificacao por tipo de erro declarado no contrato.",
  com: "Mapeia contexto e passagem de dados entre etapas.",
  usa: "Liga uma etapa de flow a uma task especifica.",
};

let configuracao = {
  diagnosticosAoDigitar: true,
};
let workspaceFolders = [];

let nucleoCarregado;

async function obterNucleo() {
  if (!nucleoCarregado) {
    nucleoCarregado = import("@sema/nucleo").catch(async () => {
      const caminhoLocal = pathToFileURL(path.join(__dirname, "vendor", "nucleo", "dist", "index.js")).href;
      return import(caminhoLocal);
    });
  }
  return nucleoCarregado;
}

function uriParaCaminho(uri) {
  if (!uri.startsWith("file://")) {
    return null;
  }
  return fileURLToPath(uri);
}

function severidadeParaLsp(severidade) {
  if (severidade === "erro") {
    return DiagnosticSeverity.Error;
  }
  if (severidade === "aviso") {
    return DiagnosticSeverity.Warning;
  }
  return DiagnosticSeverity.Information;
}

function intervaloParaRange(intervalo) {
  const inicioLinha = Math.max((intervalo?.inicio?.linha ?? 1) - 1, 0);
  const inicioColuna = Math.max((intervalo?.inicio?.coluna ?? 1) - 1, 0);
  const fimLinha = Math.max((intervalo?.fim?.linha ?? intervalo?.inicio?.linha ?? 1) - 1, 0);
  const fimColuna = Math.max((intervalo?.fim?.coluna ?? intervalo?.inicio?.coluna ?? 1) - 1, 0);

  return {
    start: { line: inicioLinha, character: inicioColuna },
    end: { line: fimLinha, character: fimColuna },
  };
}

async function compilarDocumento(documento) {
  const caminhoDocumento = uriParaCaminho(documento.uri);
  if (!caminhoDocumento) {
    return null;
  }

  const nucleo = await obterNucleo();
  const documentosAbertos = new Map(
    documents
      .all()
      .map((item) => [uriParaCaminho(item.uri), item.getText()])
      .filter(([caminho]) => Boolean(caminho)),
  );
  const resultado = await carregarProjetoParaDocumento({
    caminhoDocumento,
    textoAtual: documento.getText(),
    workspaceFolders,
    documentosAbertos,
    nucleo,
  });

  return resultado.resultadoModulo;
}

async function validarDocumento(documento) {
  const resultado = await compilarDocumento(documento);
  if (!resultado) {
    connection.sendDiagnostics({ uri: documento.uri, diagnostics: [] });
    return;
  }

  const diagnosticos = resultado.diagnosticos.map((item) => ({
    range: intervaloParaRange(item.intervalo),
    severity: severidadeParaLsp(item.severidade),
    code: item.codigo,
    source: "sema",
    message: [item.mensagem, item.dica ? `Dica: ${item.dica}` : "", item.contexto ? `Contexto: ${item.contexto}` : ""]
      .filter(Boolean)
      .join("\n"),
  }));

  connection.sendDiagnostics({
    uri: documento.uri,
    diagnostics: diagnosticos,
  });
}

function obterPalavraNoCursor(documento, posicao) {
  const textoLinha = documento.getText({
    start: { line: posicao.line, character: 0 },
    end: { line: posicao.line, character: Number.MAX_SAFE_INTEGER },
  });

  const antes = textoLinha.slice(0, posicao.character);
  const depois = textoLinha.slice(posicao.character);
  const esquerda = antes.match(/[A-Za-z_][A-Za-z0-9_]*$/)?.[0] ?? "";
  const direita = depois.match(/^[A-Za-z_][A-Za-z0-9_]*/)?.[0] ?? "";
  const palavra = `${esquerda}${direita}`;
  return palavra.length > 0 ? palavra : null;
}

connection.onInitialize((params) => {
  configuracao = {
    diagnosticosAoDigitar: true,
  };
  workspaceFolders = (
    params.initializationOptions?.workspaceFolders
    ?? params.workspaceFolders?.map((item) => uriParaCaminho(item.uri))
    ?? []
  )
    .filter(Boolean)
    .map((item) => path.resolve(item));

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      hoverProvider: true,
      documentFormattingProvider: true,
    },
  };
});

connection.onInitialized(() => {
  connection.console.log("Servidor de linguagem da Sema inicializado.");
});

connection.onDidChangeConfiguration((evento) => {
  const valores = evento.settings?.sema ?? {};
  configuracao = {
    diagnosticosAoDigitar: valores.diagnosticosAoDigitar !== false,
  };

  for (const documento of documents.all()) {
    void validarDocumento(documento);
  }
});

documents.onDidOpen((evento) => {
  void validarDocumento(evento.document);
});

documents.onDidChangeContent((evento) => {
  if (configuracao.diagnosticosAoDigitar) {
    void validarDocumento(evento.document);
  }
});

documents.onDidSave((evento) => {
  void validarDocumento(evento.document);
});

documents.onDidClose((evento) => {
  connection.sendDiagnostics({ uri: evento.document.uri, diagnostics: [] });
});

connection.onHover(async (params) => {
  const documento = documents.get(params.textDocument.uri);
  if (!documento) {
    return null;
  }

  const palavra = obterPalavraNoCursor(documento, params.position);
  if (!palavra) {
    return null;
  }

  const descricao = descricoesHover[palavra];
  if (!descricao) {
    return null;
  }

  return {
    contents: {
      kind: MarkupKind.Markdown,
      value: `**${palavra}**\n\n${descricao}`,
    },
  };
});

connection.onDocumentFormatting(async (params) => {
  const documento = documents.get(params.textDocument.uri);
  if (!documento) {
    return [];
  }

  const caminhoDocumento = uriParaCaminho(documento.uri);
  if (!caminhoDocumento) {
    return [];
  }

  const nucleo = await obterNucleo();
  const resultado = nucleo.formatarCodigo(documento.getText(), caminhoDocumento);
  if (!resultado.codigoFormatado || resultado.codigoFormatado === documento.getText()) {
    return [];
  }

  const fimDocumento = documento.positionAt(documento.getText().length);

  return [
    {
      range: {
        start: { line: 0, character: 0 },
        end: fimDocumento,
      },
      newText: resultado.codigoFormatado,
    },
  ];
});

documents.listen(connection);
connection.listen();

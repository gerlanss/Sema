const fs = require("node:fs/promises");
const path = require("node:path");

const NOMES_ORIGEM_CONTRATO = new Set(["sema", "contratos", "contracts"]);

function normalizarComparacao(caminhoAlvo) {
  return path.resolve(caminhoAlvo).toLowerCase();
}

function caminhoContem(base, alvo) {
  const baseNormalizada = normalizarComparacao(base);
  const alvoNormalizado = normalizarComparacao(alvo);
  return alvoNormalizado === baseNormalizada || alvoNormalizado.startsWith(`${baseNormalizada}${path.sep}`);
}

async function caminhoExiste(caminhoAlvo) {
  try {
    await fs.stat(caminhoAlvo);
    return true;
  } catch {
    return false;
  }
}

async function localizarConfiguracaoProjeto(entradaInicial) {
  let atual = path.resolve(entradaInicial);
  try {
    const info = await fs.stat(atual);
    if (info.isFile()) {
      atual = path.dirname(atual);
    }
  } catch {
    atual = path.dirname(atual);
  }

  for (;;) {
    const candidato = path.join(atual, "sema.config.json");
    if (await caminhoExiste(candidato)) {
      return candidato;
    }

    const pai = path.dirname(atual);
    if (pai === atual) {
      return undefined;
    }
    atual = pai;
  }
}

async function carregarConfiguracaoProjeto(entradaInicial) {
  const caminhoConfiguracao = await localizarConfiguracaoProjeto(entradaInicial);
  if (!caminhoConfiguracao) {
    return undefined;
  }

  const conteudo = await fs.readFile(caminhoConfiguracao, "utf8");
  return {
    caminho: caminhoConfiguracao,
    baseDiretorio: path.dirname(caminhoConfiguracao),
    config: JSON.parse(conteudo),
  };
}

function escolherWorkspace(caminhoDocumento, workspaceFolders = []) {
  return workspaceFolders
    .map((item) => path.resolve(item))
    .filter((workspaceFolder) => caminhoContem(workspaceFolder, caminhoDocumento))
    .sort((a, b) => b.length - a.length)[0];
}

async function resolverBaseProjeto(entradaResolvida, configCarregada) {
  if (configCarregada) {
    return configCarregada.baseDiretorio;
  }

  let pontoPartida = path.resolve(entradaResolvida);
  try {
    const info = await fs.stat(pontoPartida);
    if (info.isFile()) {
      pontoPartida = path.dirname(pontoPartida);
    }
  } catch {
    pontoPartida = path.dirname(pontoPartida);
  }

  let atual = pontoPartida;

  for (;;) {
    if (NOMES_ORIGEM_CONTRATO.has(path.basename(atual).toLowerCase())) {
      const contemMarcadorRaiz = await caminhoExiste(path.join(atual, "package.json"))
        || await caminhoExiste(path.join(atual, "sema.config.json"));
      if (!contemMarcadorRaiz) {
        const pai = path.dirname(atual);
        if (pai !== atual) {
          return pai;
        }
      }
    }

    const pai = path.dirname(atual);
    if (pai === atual) {
      break;
    }
    atual = pai;
  }

  return pontoPartida;
}

async function descobrirOrigemPadrao(baseProjeto, caminhoDocumento) {
  for (const nomeOrigem of NOMES_ORIGEM_CONTRATO) {
    const origemContratos = path.join(baseProjeto, nomeOrigem);
    if (await caminhoExiste(origemContratos)) {
      return path.resolve(origemContratos);
    }
  }

  return path.resolve(path.dirname(caminhoDocumento));
}

async function resolverOrigensProjeto(baseProjeto, caminhoDocumento, configCarregada) {
  const declaradas = configCarregada?.config.origens
    ?? (configCarregada?.config.origem ? [configCarregada.config.origem] : []);

  if (declaradas && declaradas.length > 0) {
    return declaradas.map((origem) => path.resolve(configCarregada.baseDiretorio, origem));
  }

  return [await descobrirOrigemPadrao(baseProjeto, caminhoDocumento)];
}

async function listarArquivosDeOrigens(origens, nucleo) {
  const encontrados = new Set();
  for (const origem of origens) {
    if (!(await caminhoExiste(origem))) {
      continue;
    }

    const arquivos = await nucleo.listarArquivosSema(origem);
    for (const arquivo of arquivos) {
      encontrados.add(path.resolve(arquivo));
    }
  }

  return [...encontrados].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

async function carregarProjetoParaDocumento({
  caminhoDocumento,
  textoAtual,
  workspaceFolders = [],
  documentosAbertos = new Map(),
  nucleo,
}) {
  const workspaceRaiz = escolherWorkspace(caminhoDocumento, workspaceFolders);
  const configCarregada = await carregarConfiguracaoProjeto(caminhoDocumento)
    ?? (workspaceRaiz ? await carregarConfiguracaoProjeto(workspaceRaiz) : undefined);
  const baseProjeto = await resolverBaseProjeto(workspaceRaiz ?? caminhoDocumento, configCarregada);
  const origensProjeto = await resolverOrigensProjeto(baseProjeto, caminhoDocumento, configCarregada);
  const arquivosProjeto = await listarArquivosDeOrigens(origensProjeto, nucleo);
  const buffersAbertos = new Map(
    [...documentosAbertos.entries()].map(([caminho, codigo]) => [normalizarComparacao(caminho), codigo]),
  );
  const caminhoDocumentoNormalizado = normalizarComparacao(caminhoDocumento);
  const fontes = [];
  let encontrouAtual = false;

  buffersAbertos.set(caminhoDocumentoNormalizado, textoAtual);

  for (const arquivo of arquivosProjeto) {
    const chaveArquivo = normalizarComparacao(arquivo);
    if (buffersAbertos.has(chaveArquivo)) {
      fontes.push({ caminho: arquivo, codigo: buffersAbertos.get(chaveArquivo) });
    } else {
      fontes.push({ caminho: arquivo, codigo: await fs.readFile(arquivo, "utf8") });
    }

    if (chaveArquivo === caminhoDocumentoNormalizado) {
      encontrouAtual = true;
    }
  }

  if (!encontrouAtual) {
    fontes.push({ caminho: caminhoDocumento, codigo: textoAtual });
  }

  const resultadoProjeto = nucleo.compilarProjeto(fontes);
  return {
    baseProjeto,
    configCarregada,
    origensProjeto,
    arquivosProjeto,
    resultadoProjeto,
    resultadoModulo: resultadoProjeto.modulos.find(
      (item) => normalizarComparacao(item.caminho) === caminhoDocumentoNormalizado,
    ) ?? null,
  };
}

module.exports = {
  carregarProjetoParaDocumento,
  escolherWorkspace,
  carregarConfiguracaoProjeto,
};

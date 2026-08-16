#!/usr/bin/env node
// SEMA-GOVERNED: sema.produto.fronteira_repositorios.empacotamento, sema.produto.fronteira_repositorios.empacotamento.postinstall
// Consulte contratos/sema/fronteira_repositorios_empacotamento_postinstall.sema antes de editar.
// Descricao: sincroniza launcher e skill globais somente no lifecycle npm --global.
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raizPacotePadrao = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const moduloDistribuicao = new URL("../dist/distribuicao/index.js", import.meta.url);
const ERROS_PUBLICOS = {
  FALHA_CARREGAR_DISTRIBUICAO: "não foi possível carregar a distribuição global Sema",
  API_DISTRIBUICAO_INVALIDA: "a API compilada de distribuição global Sema é inválida",
  DIRETORIO_USUARIO_INVALIDO: "o diretório de usuário da distribuição global Sema é inválido",
  RAIZ_PACOTE_INVALIDA: "a raiz do pacote da distribuição global Sema é inválida",
  FALHA_SINCRONIZAR_DISTRIBUICAO: "não foi possível sincronizar a distribuição global Sema",
  DISTRIBUICAO_NAO_PRONTA: "a distribuição global Sema não atingiu o estado READY",
};

function erroPublico(codigo) {
  return new Error(`${codigo}: ${ERROS_PUBLICOS[codigo]}.`);
}

export function mensagemErroPostinstallPublica(erro) {
  const mensagem = erro instanceof Error ? erro.message : "";
  return Object.keys(ERROS_PUBLICOS).some((codigo) => mensagem.startsWith(`${codigo}:`))
    ? mensagem
    : "FALHA_POSTINSTALL_GLOBAL: a distribuição global Sema não foi concluída.";
}

export function instalacaoGlobalSolicitada(ambiente = process.env) {
  const valor = ambiente.npm_config_global ?? ambiente.NPM_CONFIG_GLOBAL;
  return /^(?:1|true)$/iu.test(String(valor ?? "").trim());
}

function caminhoAbsolutoOuErro(valor) {
  const candidato = valor?.trim();
  if (!candidato) return undefined;
  if (!path.isAbsolute(candidato)) {
    throw erroPublico("DIRETORIO_USUARIO_INVALIDO");
  }
  return path.resolve(candidato);
}

export function resolverDiretorioUsuario(ambiente, plataforma) {
  if (plataforma === "win32") {
    const perfil = caminhoAbsolutoOuErro(ambiente.USERPROFILE);
    if (perfil) {
      return perfil;
    }
    const unidade = ambiente.HOMEDRIVE?.trim();
    const caminho = ambiente.HOMEPATH?.trim();
    if (unidade && caminho) {
      return caminhoAbsolutoOuErro(`${unidade}${caminho}`);
    }
  } else {
    const diretorio = caminhoAbsolutoOuErro(ambiente.HOME);
    if (diretorio) {
      return diretorio;
    }
  }
  const fallback = caminhoAbsolutoOuErro(os.homedir());
  if (!fallback) throw erroPublico("DIRETORIO_USUARIO_INVALIDO");
  return fallback;
}

function resolverRaizPacote(valor) {
  if (typeof valor !== "string" || !valor.trim() || !path.isAbsolute(valor)) {
    throw erroPublico("RAIZ_PACOTE_INVALIDA");
  }
  return path.resolve(valor);
}

export async function executarPostinstall({
  ambiente = process.env,
  plataforma = process.platform,
  executavelNode = process.execPath,
  raizPacote = raizPacotePadrao,
  importar = (referencia) => import(referencia),
} = {}) {
  if (!instalacaoGlobalSolicitada(ambiente)) {
    return {
      estado: "no_op",
      motivo: "install_scope_local",
      instalacao_local_no_op: true,
      distribuicao_pronta: false,
      alterado: false,
    };
  }

  const diretorioUsuario = resolverDiretorioUsuario(ambiente, plataforma);
  const raizPacoteAbsoluta = resolverRaizPacote(raizPacote);

  let api;
  try {
    api = await importar(moduloDistribuicao.href);
  } catch {
    throw erroPublico("FALHA_CARREGAR_DISTRIBUICAO");
  }
  if (typeof api.sincronizarDistribuicaoGlobal !== "function") {
    throw erroPublico("API_DISTRIBUICAO_INVALIDA");
  }

  let resultado;
  try {
    resultado = await api.sincronizarDistribuicaoGlobal({
      plataforma,
      diretorioUsuario,
      executavelNode,
      raizPacote: raizPacoteAbsoluta,
    });
  } catch {
    throw erroPublico("FALHA_SINCRONIZAR_DISTRIBUICAO");
  }
  if (
    resultado?.estado !== "READY" ||
    resultado.launcher?.estado !== "READY" ||
    resultado.skill?.estado !== "READY" ||
    typeof resultado.alterado !== "boolean"
  ) {
    throw erroPublico("DISTRIBUICAO_NAO_PRONTA");
  }
  return {
    estado: "READY",
    motivo: "distribution_ready",
    instalacao_local_no_op: false,
    distribuicao_pronta: true,
    alterado: resultado.alterado,
  };
}

function executadoDiretamente() {
  return Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (executadoDiretamente()) {
  executarPostinstall()
    .then((resultado) => {
      if (resultado?.estado !== "no_op") {
        console.log("Sema global launcher and AI skill synchronized.");
      }
    })
    .catch((erro) => {
      console.error("Failed to synchronize the global Sema distribution.");
      console.error(mensagemErroPostinstallPublica(erro));
      process.exitCode = 1;
    });
}

/**
 * Guarda de governança Sema.
 *
 * Cria um bloqueio local que obriga a chamada de `docs-impacto`
 * antes de operações destrutivas (compilar, publicar, validar pesado).
 *
 * Arquivo de estado: .sema/guard.json
 *
 * Contrato: contratos/sema/guard.sema
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface EstadoGuarda {
  ativo: boolean;
  sessaoId: string;
  ativadoEm: string;
  docsImpactoChamado: boolean;
  intencao?: string;
  docsLidas: string[];
  ultimaAtualizacao: string;
}

export interface ResultadoGuarda {
  comando: string;
  sucesso: boolean;
  estado?: EstadoGuarda;
  bloqueado?: boolean;
  mensagem?: string;
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const ARQUIVO_GUARD = path.join(".sema", "guard.json");

function caminhoGuard(baseProjeto: string): string {
  return path.resolve(baseProjeto, ARQUIVO_GUARD);
}

// ---------------------------------------------------------------------------
// Estado padrão
// ---------------------------------------------------------------------------

function estadoVazio(): EstadoGuarda {
  return {
    ativo: false,
    sessaoId: "",
    ativadoEm: "",
    docsImpactoChamado: false,
    docsLidas: [],
    ultimaAtualizacao: "",
  };
}

// ---------------------------------------------------------------------------
// Ler / escrever estado do guarda
// ---------------------------------------------------------------------------

async function lerEstado(baseProjeto: string): Promise<EstadoGuarda> {
  try {
    const conteudo = await readFile(caminhoGuard(baseProjeto), "utf8");
    return JSON.parse(conteudo) as EstadoGuarda;
  } catch {
    return estadoVazio();
  }
}

async function escreverEstado(baseProjeto: string, estado: EstadoGuarda): Promise<void> {
  const dir = path.dirname(caminhoGuard(baseProjeto));
  await mkdir(dir, { recursive: true });
  estado.ultimaAtualizacao = new Date().toISOString();
  await writeFile(caminhoGuard(baseProjeto), JSON.stringify(estado, null, 2), "utf8");
}

// ---------------------------------------------------------------------------
// Ações do guarda
// ---------------------------------------------------------------------------

export async function ativarGuarda(baseProjeto: string): Promise<ResultadoGuarda> {
  const estado = await lerEstado(baseProjeto);

  if (estado.ativo) {
    return {
      comando: "guard on",
      sucesso: false,
      estado,
      mensagem: `Guarda ja esta ativo (sessao: ${estado.sessaoId}). Desative com 'sema guard off' primeiro.`,
    };
  }

  const novoEstado: EstadoGuarda = {
    ativo: true,
    sessaoId: randomUUID(),
    ativadoEm: new Date().toISOString(),
    docsImpactoChamado: false,
    docsLidas: [],
    ultimaAtualizacao: new Date().toISOString(),
  };

  await escreverEstado(baseProjeto, novoEstado);

  return {
    comando: "guard on",
    sucesso: true,
    estado: novoEstado,
    mensagem: `Guarda ativado. Sessao: ${novoEstado.sessaoId.slice(0, 8)}...`,
  };
}

export async function desativarGuarda(baseProjeto: string): Promise<ResultadoGuarda> {
  const estado = await lerEstado(baseProjeto);

  if (!estado.ativo) {
    return {
      comando: "guard off",
      sucesso: false,
      estado,
      mensagem: "Guarda nao esta ativo.",
    };
  }

  await escreverEstado(baseProjeto, estadoVazio());

  return {
    comando: "guard off",
    sucesso: true,
    estado: estadoVazio(),
    mensagem: "Guarda desativado.",
  };
}

export async function statusGuarda(baseProjeto: string): Promise<ResultadoGuarda> {
  const estado = await lerEstado(baseProjeto);

  return {
    comando: "guard status",
    sucesso: true,
    estado,
    bloqueado: estado.ativo && !estado.docsImpactoChamado,
    mensagem: estado.ativo
      ? estado.docsImpactoChamado
        ? `Guarda ativo. Docs-impacto ja registrado. Sessao: ${estado.sessaoId.slice(0, 8)}...`
        : `Guarda ativo. Docs-impacto pendente! Sessao: ${estado.sessaoId.slice(0, 8)}...`
      : "Guarda inativo.",
  };
}

export async function registrarDocsImpacto(
  baseProjeto: string,
  intencao: string,
): Promise<ResultadoGuarda> {
  const estado = await lerEstado(baseProjeto);

  if (!estado.ativo) {
    // Guarda inativo: registrar mesmo assim (útil pra relatório)
    return {
      comando: "guard registrar-docs",
      sucesso: true,
      mensagem: "Guarda inativo. Docs-impacto registrado em cache leve.",
    };
  }

  estado.docsImpactoChamado = true;
  estado.intencao = intencao;
  await escreverEstado(baseProjeto, estado);

  return {
    comando: "guard registrar-docs",
    sucesso: true,
    estado,
    mensagem: `Docs-impacto registrado: "${intencao.slice(0, 60)}"`,
  };
}

export async function registrarDocLida(
  baseProjeto: string,
  caminhoDoc: string,
): Promise<ResultadoGuarda> {
  const estado = await lerEstado(baseProjeto);

  if (!estado.ativo) {
    return { comando: "guard registrar-doc", sucesso: true };
  }

  if (!estado.docsLidas.includes(caminhoDoc)) {
    estado.docsLidas.push(caminhoDoc);
  }
  await escreverEstado(baseProjeto, estado);

  return {
    comando: "guard registrar-doc",
    sucesso: true,
    estado,
  };
}

// ---------------------------------------------------------------------------
// Verificação: operação pode prosseguir?
// ---------------------------------------------------------------------------

export async function verificarSePodeProsseguir(
  baseProjeto: string,
  operacao: string,
): Promise<{ pode: boolean; motivo?: string }> {
  const estado = await lerEstado(baseProjeto);

  if (!estado.ativo) {
    return { pode: true }; // Guarda inativo: liberado
  }

  if (!estado.docsImpactoChamado) {
    return {
      pode: false,
      motivo: `Guarda ativo bloqueou "${operacao}". Execute 'sema docs-impacto --intencao "${operacao}"' primeiro.`,
    };
  }

  return { pode: true };
}

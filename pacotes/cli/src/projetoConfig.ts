// SEMA-GOVERNED: sema.produto.governanca_ia.contexto
// Descrição: l? sema.config.json e normaliza op??es declaradas pelo projeto.

import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { AlvoGeracao, FrameworkGeracao } from '@sema/padroes';
import type { EstruturaSaida, FonteLegado, ModoAdocao } from './tipos.js';
import { caminhoExiste } from './projetoBusca.js';
import type { ConfiguracaoProjetoCarregada, SemaConfigProjeto } from './projetoTipos.js';

export async function localizarConfiguracaoProjeto(entradaInicial: string): Promise<string | undefined> {
  let atual = path.resolve(entradaInicial);
  try {
    const info = await stat(atual);
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

export async function carregarConfiguracaoProjeto(entradaInicial: string): Promise<ConfiguracaoProjetoCarregada | undefined> {
  const caminhoConfig = await localizarConfiguracaoProjeto(entradaInicial);
  if (!caminhoConfig) {
    return undefined;
  }

  const conteudo = await readFile(caminhoConfig, "utf8");
  const config = JSON.parse(conteudo) as SemaConfigProjeto;
  return {
    caminho: caminhoConfig,
    baseDiretorio: path.dirname(caminhoConfig),
    config,
  };
}

export function normalizarEstruturaSaida(valor?: string): EstruturaSaida {
  if (valor === "modulos" || valor === "backend") {
    return valor;
  }
  return "flat";
}

export function normalizarFrameworkGeracao(valor?: string): FrameworkGeracao {
  if (valor === "nestjs" || valor === "fastapi") {
    return valor;
  }
  return "base";
}

export function normalizarAlvo(valor?: string): AlvoGeracao | undefined {
  if (valor === "typescript" || valor === "python" || valor === "dart" || valor === "lua" || valor === "javascript" || valor === "html" || valor === "css") {
    return valor;
  }
  if (valor === "js") {
    return "javascript";
  }
  return undefined;
}

export function normalizarFonteLegado(valor: string): FonteLegado | undefined {
  if (valor === "js") {
    return "javascript";
  }
  if (valor === "ts") {
    return "typescript";
  }
  if (
    valor === "nestjs"
    || valor === "fastapi"
    || valor === "flask"
    || valor === "nextjs"
    || valor === "nextjs-consumer"
    || valor === "react-vite-consumer"
    || valor === "angular-consumer"
    || valor === "flutter-consumer"
    || valor === "firebase"
    || valor === "typescript"
    || valor === "javascript"
    || valor === "python"
    || valor === "dart"
    || valor === "lua"
    || valor === "dotnet"
    || valor === "java"
    || valor === "go"
    || valor === "rust"
    || valor === "cpp"
    || valor === "php"
  ) {
    return valor;
  }
  return undefined;
}

export function normalizarModoAdocao(valor?: string): ModoAdocao {
  return valor === "incremental" ? valor : "incremental";
}

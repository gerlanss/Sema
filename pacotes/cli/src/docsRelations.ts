// SEMA-GOVERNED: sema.produto.governanca_ia.documentacao
// Descrição: resolve contrato exato, vínculos e dependências declaradas; palavras são apenas recomendações.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { tokenizar, parsear, listarCandidatosUseRelativo, type ModuloAst } from "@sema/nucleo";
import { validarDestinosEscritaWorkspace } from "./workspaceWrite.js";
import { caminhoExiste, caminhoEstaDentro, listarArquivosRecursivo, normalizarRelativo, normalizarTexto, termosRelacionamentoContratos, type DocumentoPlanejado } from "./docs.part01.js";

export async function resolverRelacoesDocumentais(base: string, intencao: string, alvos: string[], registrar: (doc: DocumentoPlanejado) => void): Promise<void> {
  const relativo = (p: string) => {
    const absoluto = path.resolve(base, p);
    if (!caminhoEstaDentro(base, absoluto)) throw new Error("Referência documental fora do workspace.");
    return normalizarRelativo(path.relative(base, absoluto));
  };
  const explicitos = alvos.map(relativo);
  const pasta = path.join(base, "contratos");
  const caminhos = await caminhoExiste(pasta) ? (await listarArquivosRecursivo(pasta, Number.POSITIVE_INFINITY)).filter((p) => p.endsWith(".sema")).map(relativo) : [];
  const todos = [...new Set([...caminhos, ...explicitos.filter((p) => p.endsWith(".sema"))])];
  await validarDestinosEscritaWorkspace(base, todos);
  const catalogo = new Map<string, ModuloAst>();
  for (const p of todos) {
    if (!await caminhoExiste(path.join(base, p))) continue;
    const lexer = tokenizar(await readFile(path.join(base, p), "utf8"), p);
    const parser = parsear(lexer.tokens);
    if (parser.modulo && lexer.diagnosticos.length === 0 && parser.diagnosticos.length === 0) catalogo.set(p, parser.modulo);
  }
  const fila: Array<{ arquivo: string; motivo: string }> = explicitos.filter((p) => p.endsWith(".sema"))
    .map((arquivo) => ({ arquivo, motivo: "Contrato informado explicitamente em --arquivo" }));
  for (const [arquivo, modulo] of catalogo) {
    const donos = [modulo, ...modulo.tasks, ...modulo.routes, ...modulo.flows];
    for (const dono of donos) {
      for (const campo of dono.vinculos?.campos ?? []) {
        if (campo.nome !== "arquivo") continue;
        const vinculo = relativo(campo.valor.replace(/^["']|["']$/g, ""));
        if (explicitos.includes(vinculo)) fila.push({ arquivo, motivo: `Vínculo declarado em ${modulo.nome}: ${vinculo}` });
      }
    }
  }
  const vistos = new Set<string>();
  for (let i = 0; i < fila.length; i++) {
    const item = fila[i]!;
    if (vistos.has(item.arquivo)) continue;
    vistos.add(item.arquivo);
    registrar({ relativo: item.arquivo, tipo: "contrato", motivo: item.motivo, permitirCriacao: false });
    const modulo = catalogo.get(item.arquivo);
    if (!modulo) {
      if (await caminhoExiste(path.join(base, item.arquivo))) throw new Error(`Contrato inválido: ${item.arquivo}. Rode sema validar.`);
      continue; // O resolvedor público transforma o contrato ausente em bloqueio.
    }
    for (const use of modulo.uses.filter((u) => u.origem === "sema")) {
      let encontrados: Array<[string, ModuloAst]> = [];
      for (const nome of [use.caminho, ...listarCandidatosUseRelativo(modulo.nome, use.caminho)]) {
        encontrados = [...catalogo].filter(([, m]) => m.nome === nome);
        if (encontrados.length) break;
      }
      if (encontrados.length !== 1) throw new Error(`Dependência use ${use.caminho} de ${item.arquivo} ausente ou ambígua. Rode sema validar.`);
      fila.push({ arquivo: encontrados[0]![0], motivo: `Dependência use ${use.caminho} declarada em ${item.arquivo}` });
    }
    for (const campo of modulo.docs?.campos ?? []) {
      if (campo.nome !== "arquivo") continue;
      const doc = relativo(campo.valor.replace(/^["']|["']$/g, ""));
      const motivo = `Referência docs.arquivo declarada em ${item.arquivo}`;
      registrar({ relativo: doc, tipo: doc.endsWith(".sema") ? "contrato" : "documentacao", motivo, permitirCriacao: false, obrigatoriedade: "recomendada" });
    }
  }
  // Arquivo explícito fixa o escopo; não acrescentar contratos por palavras genéricas.
  if (explicitos.length > 0) return;
  const termos = termosRelacionamentoContratos(intencao, []);
  const sugestoes = [...catalogo].filter(([arquivo]) => termos.some((t) => normalizarTexto(path.basename(arquivo, ".sema")).includes(t))).slice(0, 8);
  for (const [arquivo] of sugestoes) registrar({ relativo: arquivo, tipo: "contrato", motivo: "Sugestão por intenção; confirme o contrato usando --arquivo", permitirCriacao: false, obrigatoriedade: "recomendada" });
}

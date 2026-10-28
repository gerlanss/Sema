// SEMA-GOVERNED: sema.produto.cli_init_templates
// Descrição: separa configuração do projeto de demonstrações, mantendo exemplos fora dos contratos ativos.
import path from "node:path";
import type { ArquivosTemplateIniciar, TemplateIniciar } from "./initTemplatesBase.js";

export function separarDemonstracoesTemplate(template: TemplateIniciar, arquivos: ArquivosTemplateIniciar): ArquivosTemplateIniciar {
  const config = arquivos.find(item => item.caminhoRelativo === "sema.config.json");
  if (!config) throw new Error(`Template ${template} sem configuração de projeto.`);
  const projeto = [config, { caminhoRelativo: "contratos/.gitkeep", conteudo: "" }];
  const configuracao = JSON.parse(config.conteudo) as { diretoriosCodigo?: string[] };
  for (const diretorio of configuracao.diretoriosCodigo ?? []) {
    const relativo = path.posix.normalize(diretorio.replace(/\\/g, "/"));
    if (path.posix.isAbsolute(relativo) || relativo === ".." || relativo.startsWith("../")) {
      throw new Error(`Diretório de código fora do template: ${diretorio}`);
    }
    projeto.push({ caminhoRelativo: `${relativo}/.gitkeep`, conteudo: "" });
  }
  for (const arquivo of arquivos) {
    if (arquivo.caminhoRelativo.endsWith("/.gitkeep") && !projeto.some(item => item.caminhoRelativo === arquivo.caminhoRelativo)) projeto.push(arquivo);
  }
  const demonstracoes = arquivos.filter(item => item.caminhoRelativo !== "sema.config.json" && !item.caminhoRelativo.endsWith("/.gitkeep"));
  if (!demonstracoes.length) return projeto;
  const prefixo = `exemplos/templates/${template}/`;
  return [...projeto, config, ...demonstracoes].map((item, indice) => indice < projeto.length ? item : {
    caminhoRelativo: prefixo + item.caminhoRelativo,
    conteudo: item.conteudo,
  });
}

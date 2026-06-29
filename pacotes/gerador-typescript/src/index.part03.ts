// SEMA-GOVERNED: sema.geradores_codigo_governado
// Descricao: modulo particionado; consulte contratos/sema/geradores_codigo_governado.sema antes de editar.

import path from "node:path";
import type { ExpressaoSemantica, IrBlocoDeclarativo, IrCampo, IrModulo, IrTask } from "@sema/nucleo";
import {
  descreverEstruturaModulo,
  extrairTiposNomeados,
  mapearTipoParaTypeScript,
  normalizarNomeModulo,
  normalizarNomeParaSimbolo,
  type ArquivoGerado,
  type FrameworkGeracao,
} from "@sema/padroes";

import { gerarNestJsController, gerarNestJsDtos, gerarNestJsService, gerarNestJsSpec, gerarTypeScriptBase } from "./index.part02.js";
import { OpcoesGeracaoTypeScript } from "./index.part01.js";

export function gerarTypeScriptNestJs(modulo: IrModulo): ArquivoGerado[] {
  const base = gerarTypeScriptBase(modulo);
  const contrato = base.find((arquivo) => arquivo.caminhoRelativo.endsWith(".ts") && !arquivo.caminhoRelativo.endsWith(".test.ts"));
  const testeContrato = base.find((arquivo) => arquivo.caminhoRelativo.endsWith(".test.ts"));
  const estrutura = descreverEstruturaModulo(modulo.nome);
  const contexto = estrutura.contextoRelativo;
  const contratoPath = `${contexto ? `${contexto}/` : ""}${estrutura.nomeArquivo}.contract.ts`;
  const dtoPath = `${contexto ? `${contexto}/` : ""}dto/${estrutura.nomeArquivo}.dto.ts`;
  const servicePath = `${contexto ? `${contexto}/` : ""}${estrutura.nomeArquivo}.service.ts`;
  const controllerPath = `${contexto ? `${contexto}/` : ""}${estrutura.nomeArquivo}.controller.ts`;
  const caminhoImportDto = `./dto/${estrutura.nomeArquivo}.dto`;
  const caminhoImportContrato = `./${estrutura.nomeArquivo}.contract`;
  const caminhoImportService = `./${estrutura.nomeArquivo}.service`;
  const caminhoContratoTeste = path.posix.join("test", `${contexto ? `${contexto}/` : ""}${estrutura.nomeArquivo}.contract.test.ts`);
  const caminhoControllerSpec = path.posix.join("test", `${contexto ? `${contexto}/` : ""}${estrutura.nomeArquivo}.controller.spec.ts`);
  const relativoContratoDoTeste = path.posix.relative(path.posix.dirname(caminhoContratoTeste), path.posix.join("src", contratoPath).replace(/\.ts$/, ""));
  const relativoServiceDoSpec = path.posix.relative(path.posix.dirname(caminhoControllerSpec), path.posix.join("src", servicePath).replace(/\.ts$/, ""));
  const relativoControllerDoSpec = path.posix.relative(path.posix.dirname(caminhoControllerSpec), path.posix.join("src", controllerPath).replace(/\.ts$/, ""));

  const arquivos: ArquivoGerado[] = [
    {
      caminhoRelativo: path.posix.join("src", contratoPath),
      conteudo: contrato?.conteudo ?? "// Nenhum contrato base gerado.\n",
    },
    {
      caminhoRelativo: path.posix.join("src", dtoPath),
      conteudo: gerarNestJsDtos(modulo, `../${path.posix.basename(contratoPath, ".ts")}`),
    },
    {
      caminhoRelativo: path.posix.join("src", servicePath),
      conteudo: gerarNestJsService(modulo, caminhoImportContrato),
    },
    {
      caminhoRelativo: path.posix.join("src", controllerPath),
      conteudo: gerarNestJsController(modulo, caminhoImportDto, caminhoImportService),
    },
    {
      caminhoRelativo: caminhoContratoTeste,
      conteudo: (testeContrato?.conteudo ?? "")
        .replace(`./${estrutura.nomeBase}.ts`, relativoContratoDoTeste)
        .replace(`./${estrutura.nomeArquivo}.ts`, relativoContratoDoTeste),
    },
    {
      caminhoRelativo: caminhoControllerSpec,
      conteudo: gerarNestJsSpec(modulo, relativoServiceDoSpec, relativoControllerDoSpec),
    },
  ];

  return arquivos;
}

export function gerarTypeScript(modulo: IrModulo, opcoes: OpcoesGeracaoTypeScript = {}): ArquivoGerado[] {
  if (opcoes.framework === "nestjs") {
    return gerarTypeScriptNestJs(modulo);
  }
  return gerarTypeScriptBase(modulo);
}

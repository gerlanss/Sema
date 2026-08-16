// SEMA-GOVERNED: sema.produto.governanca_ia.drift
// Descricao: prova adaptadores opcionais e deduplicacao canonica de raizes sobrepostas nos indexadores.

import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type {
  AdaptadorLeituraCompartilhadaDrift,
  EventoLeituraCompartilhadaDrift,
} from "../../pacotes/cli/src/drift.part04.js";
import { indexarTypeScript } from "../../pacotes/cli/src/drift.part06.js";
import {
  indexarCpp,
  indexarDart,
  indexarDotnet,
  indexarGo,
  indexarJava,
  indexarLua,
  indexarPersistenciaDeclarativa,
  indexarPhp,
  indexarPython,
  indexarRust,
} from "../../pacotes/cli/src/drift.part07.js";
import { indexarPersistenciaDetalhada } from "../../pacotes/cli/src/drift.part08.js";

test("indexador cria um AST e executa uma extracao para app e app/sub sobrepostos", async () => {
  const base = path.join(os.tmpdir(), "sema-drift-raizes-sobrepostas");
  const app = path.join(base, "app");
  const sub = path.join(app, "sub");
  const arquivo = path.join(sub, "modulo.ts");
  const raizesListadas: string[] = [];
  const leituras: string[] = [];
  const eventos: Array<{ tipo: EventoLeituraCompartilhadaDrift; arquivo?: string }> = [];
  const adaptador: AdaptadorLeituraCompartilhadaDrift = {
    listarPorRaiz: (raiz) => {
      raizesListadas.push(raiz);
      return [arquivo, path.join(sub, ".", "modulo.ts")];
    },
    lerTexto: async (caminho) => {
      leituras.push(caminho);
      return "export function executar() { return true; }\n";
    },
    emitir: (tipo, caminho) => eventos.push({ tipo, arquivo: caminho }),
  };

  const resultado = await indexarTypeScript([sub, app], adaptador);

  assert.deepEqual(raizesListadas.map((raiz) => path.resolve(raiz)), [path.resolve(app)]);
  assert.deepEqual(leituras.map((caminho) => path.resolve(caminho)), [path.resolve(arquivo)]);
  assert.equal(eventos.filter(({ tipo }) => tipo === "extractor.run").length, 1);
  assert.equal(eventos.filter(({ tipo }) => tipo === "ast.create").length, 1);
  assert.equal(
    resultado.simbolos.some(({ caminho }) => caminho === "sub.modulo.executar"),
    true,
    "a raiz externa deve continuar definindo o caminho semantico do simbolo",
  );
  assert.equal(
    resultado.simbolos.some(({ caminho }) => caminho === "modulo.executar"),
    true,
    "o alias da raiz interna deve sobreviver à deduplicação física",
  );
});

test("raiz unica nao inventa aliases para diretorios internos nao configurados", async () => {
  const base = path.join(os.tmpdir(), "sema-drift-raiz-unica");
  const app = path.join(base, "app");
  const arquivo = path.join(app, "dominio", "sub", "modulo.ts");
  const resultado = await indexarTypeScript([app], {
    listarPorRaiz: () => [arquivo],
    lerTexto: async () => "export function executar() { return true; }\n",
  });
  const caminhos = new Set(resultado.simbolos.map((simbolo) => simbolo.caminho));

  assert.equal(caminhos.has("dominio.sub.modulo.executar"), true);
  assert.equal(caminhos.has("app.dominio.sub.modulo.executar"), true);
  assert.equal(caminhos.has("sub.modulo.executar"), false);
  assert.equal(caminhos.has("modulo.executar"), false);
});

test("rotas em strings de template nao fabricam superficies fora do catalogo", async () => {
  const base = path.join(os.tmpdir(), "sema-drift-rotas-template");
  const arquivoTemplate = path.join(base, "initTemplatesWeb.ts");
  const arquivoRotas = path.join(base, "src", "router.tsx");
  const arquivoPagina = path.join(base, "src", "pages", "ranking.tsx");
  const conteudos = new Map([
    [
      arquivoTemplate,
      "export const template = `import { Route } from \"react-router-dom\"; <Route path=\"/fantasma\" element={<Fantasma />} />`;\n",
    ],
    [
      arquivoRotas,
      "import { Ranking } from \"./pages/ranking.tsx\"; export const routes = createBrowserRouter([{ path: \"/ranking\", Component: Ranking }]);\n",
    ],
    [arquivoPagina, "export function Ranking() { return null; }\n"],
  ]);
  const resultado = await indexarTypeScript([base], {
    listarPorRaiz: () => [...conteudos.keys()],
    lerTexto: async (arquivo) => conteudos.get(arquivo) ?? "",
  });

  assert.equal(resultado.rotas.some(({ caminho }) => caminho === "/fantasma"), false);
  assert.equal(resultado.consumerSurfaces.some(({ rota }) => rota === "/fantasma"), false);
  assert.equal(
    resultado.consumerSurfaces.some(({ rota, arquivo }) => (
      rota === "/ranking" && path.resolve(arquivo) === path.resolve(arquivoPagina)
    )),
    true,
  );
});

test("cada indexador usa o adaptador uma vez mesmo com raizes sobrepostas", async (t) => {
  const base = path.join(os.tmpdir(), "sema-drift-indexadores-sobrepostos");
  const app = path.join(base, "app");
  const sub = path.join(app, "sub");
  const casos: Array<{
    nome: string;
    extensao: string;
    conteudo: string;
    executar: (raizes: string[], adaptador: AdaptadorLeituraCompartilhadaDrift) => Promise<unknown>;
  }> = [
    { nome: "python", extensao: ".py", conteudo: "def executar():\n    return True\n", executar: indexarPython },
    { nome: "dart", extensao: ".dart", conteudo: "void executar() {}\n", executar: indexarDart },
    { nome: "dotnet", extensao: ".cs", conteudo: "public class Servico { public void Executar() {} }\n", executar: indexarDotnet },
    { nome: "java", extensao: ".java", conteudo: "public class Servico { public void executar() {} }\n", executar: indexarJava },
    { nome: "go", extensao: ".go", conteudo: "package app\nfunc Executar() {}\n", executar: indexarGo },
    { nome: "rust", extensao: ".rs", conteudo: "pub fn executar() {}\n", executar: indexarRust },
    { nome: "cpp", extensao: ".cpp", conteudo: "void executar() {}\n", executar: indexarCpp },
    { nome: "php", extensao: ".php", conteudo: "<?php function executar() {}\n", executar: indexarPhp },
    { nome: "lua", extensao: ".lua", conteudo: "function executar() end\n", executar: indexarLua },
    {
      nome: "persistencia-declarativa",
      extensao: ".sql",
      conteudo: "CREATE TABLE itens (id INTEGER);\n",
      executar: indexarPersistenciaDeclarativa,
    },
    {
      nome: "persistencia-detalhada",
      extensao: ".sql",
      conteudo: "CREATE TABLE itens (id INTEGER);\n",
      executar: indexarPersistenciaDetalhada,
    },
  ];

  for (const caso of casos) {
    await t.test(caso.nome, async () => {
      const arquivo = path.join(sub, `modulo${caso.extensao}`);
      let leituras = 0;
      const eventos: EventoLeituraCompartilhadaDrift[] = [];
      const raizesListadas: string[] = [];
      const adaptador: AdaptadorLeituraCompartilhadaDrift = {
        listarPorRaiz: (raiz) => {
          raizesListadas.push(raiz);
          return [arquivo, path.join(sub, ".", `modulo${caso.extensao}`)];
        },
        lerTexto: async () => {
          leituras += 1;
          return caso.conteudo;
        },
        emitir: (tipo) => eventos.push(tipo),
      };

      await caso.executar([sub, app], adaptador);

      assert.deepEqual(raizesListadas.map((raiz) => path.resolve(raiz)), [path.resolve(app)]);
      assert.equal(leituras, 1);
      assert.equal(eventos.filter((tipo) => tipo === "extractor.run").length, 1);
    });
  }
});

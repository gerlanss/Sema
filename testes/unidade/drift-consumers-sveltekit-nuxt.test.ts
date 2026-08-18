// SEMA-GOVERNED: sema.produto.governanca_ia.drift
// Descricao: prova inferencia de superficies consumer SvelteKit e Nuxt.

import test from "node:test";
import assert from "node:assert/strict";
import {
  arquivoEhSuperficieSvelteKitConsumer,
  arquivoEhSuperficieNuxtConsumer,
  inferirRotaSvelteKitConsumer,
  inferirRotaNuxtConsumer,
} from "../../pacotes/cli/src/drift.part05.js";

test("sveltekit infere rotas de arquivo com grupos e parametros", () => {
  const pagina = inferirRotaSvelteKitConsumer("src/routes/blog/[slug]/+page.svelte");
  assert.deepEqual(
    { rota: pagina?.rota, tipo: pagina?.tipoArquivo },
    { rota: "/blog/{slug}", tipo: "page" },
  );

  const layout = inferirRotaSvelteKitConsumer("src/routes/(painel)/config/+layout.svelte");
  assert.equal(layout?.rota, "/config");
  assert.equal(layout?.tipoArquivo, "layout");

  const servidor = inferirRotaSvelteKitConsumer("src/routes/api/health/+server.ts");
  assert.deepEqual(
    { rota: servidor?.rota, tipo: servidor?.tipoArquivo },
    { rota: "/api/health", tipo: "server" },
  );

  const raiz = inferirRotaSvelteKitConsumer("src/routes/+page.svelte");
  assert.equal(raiz?.rota, "/");
});

test("sveltekit rejeita arquivos fora de routes", () => {
  assert.equal(arquivoEhSuperficieSvelteKitConsumer("src/lib/componente/Button.svelte"), false);
  assert.equal(inferirRotaSvelteKitConsumer("src/lib/componente/Button.svelte"), undefined);
});

test("nuxt infere paginas vue e endpoints de server api", () => {
  const pagina = inferirRotaNuxtConsumer("pages/usuario/[id].vue");
  assert.deepEqual(
    { rota: pagina?.rota, tipo: pagina?.tipoArquivo },
    { rota: "/usuario/{id}", tipo: "page" },
  );

  const indice = inferirRotaNuxtConsumer("pages/index.vue");
  assert.equal(indice?.rota, "/");

  const appPages = inferirRotaNuxtConsumer("app/pages/painel/ajustes.vue");
  assert.equal(appPages?.rota, "/painel/ajustes");

  const endpoint = inferirRotaNuxtConsumer("server/api/monitores/[id].get.ts");
  assert.deepEqual(
    { rota: endpoint?.rota, tipo: endpoint?.tipoArquivo },
    { rota: "/api/monitores/{id}", tipo: "GET" },
  );

  const criacao = inferirRotaNuxtConsumer("server/api/monitores/index.post.ts");
  assert.deepEqual(
    { rota: criacao?.rota, tipo: criacao?.tipoArquivo },
    { rota: "/api/monitores", tipo: "POST" },
  );
});

test("nuxt rejeita componentes soltos", () => {
  assert.equal(arquivoEhSuperficieNuxtConsumer("components/Botao.vue"), false);
  assert.equal(inferirRotaNuxtConsumer("components/Botao.vue"), undefined);
});

test("normalizarFonteLegado aceita os novos consumers", async () => {
  const { normalizarFonteLegado } = await import("../../pacotes/cli/src/projetoConfig.js");
  assert.equal(normalizarFonteLegado("sveltekit-consumer"), "sveltekit-consumer");
  assert.equal(normalizarFonteLegado("nuxt-consumer"), "nuxt-consumer");
  assert.equal(normalizarFonteLegado("remix"), undefined);
});

// SEMA-GOVERNED: sema.governanca_ia_qualidade_contrato
// Descricao: testes da checagem observavel de i18n por idioma em artefatos reais.

import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { validarProfileSemantico } from "../../pacotes/cli/src/profileCommand.js";

async function criarContratoSoftwareI18n(declaracaoI18n: string): Promise<{ dir: string; contrato: string }> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "sema-profile-i18n-"));
  const contrato = path.join(dir, "software_i18n.sema");
  await writeFile(
    contrato,
    `module teste.software_i18n {
  docs {
    resumo: "Contrato primeiro: criar, editar ou remover contrato antes de qualquer acao. Codigo vivo com implementacao rastreada, drift executado, impacto em mapa, vinculos por impl, arquivo e simbolo, validar, verificar, testes e checks. ${declaracaoI18n}"
  }

  task validar_ui {
    input {
      contrato: Texto required
      codigo_vivo: Texto required
      drift: Texto required
      impacto: Texto required
      vinculos: Texto required
      checks: Texto required
      texto_visivel: Texto required
      artefato: Texto required
    }
    output {
      aprovado: Booleano
    }
    rules {
      contrato deve_ser antes_de_qualquer_acao
      codigo_vivo deve_ser implementacao_rastreada
      drift deve_ser executado
      impacto deve_ser mapa_calculado
      vinculos deve_ser impl_por_arquivo_e_simbolo
      checks deve_ser validar_verificar_testes
      texto_visivel deve_ser i18n_observavel_por_idioma
    }
    guarantees {
      aprovado existe
    }
    tests {
      caso "texto visivel com acento" {
        given {
          contrato: "contrato primeiro"
          codigo_vivo: "implementacao"
          drift: "executado"
          impacto: "mapa"
          vinculos: "impl arquivo simbolo"
          checks: "validar verificar testes"
          texto_visivel: "i18n_observavel"
          artefato: "Descrição"
        }

        expect {
          sucesso: verdadeiro
        }
      }
    }
  }
}
`,
    "utf8",
  );
  return { dir, contrato };
}

test("profile software bloqueia texto visivel PT-BR sem acento quando contrato declara i18n", async () => {
  const { dir, contrato } = await criarContratoSoftwareI18n("i18n_ptbr exige texto visivel com acentos.");
  try {
    const resultado = await validarProfileSemantico(contrato, "software", {
      maturidade: "production",
      artefatoTexto: [
        "<label>Descricao</label>",
        "<h2>0 lancamentos</h2>",
        '<input placeholder="Ex.: almoco rapido">',
        'const erro = "Valor invalido. Use numero positivo.";'
      ].join("\n"),
    });

    assert.equal(resultado.aprovado, false);
    assert.equal(resultado.bloqueado, true);
    assert.equal(resultado.decisaoAgente, "parar");
    assert.equal(resultado.scoreArtefato !== null && resultado.scoreArtefato < 100, true);
    assert.equal(resultado.runtimeGate.podeExecutar, false);
    assert.equal(
      resultado.achadosArtefato.some((achado) =>
        achado.id === "software_i18n_diacritico_ausente" &&
        achado.regra === "i18n_pt-br_diacriticos_observaveis" &&
        achado.trecho?.includes("Descricao")
      ),
      true,
    );
    assert.equal(
      resultado.achadosArtefato.some((achado) =>
        achado.id === "software_i18n_diacritico_ausente" &&
        achado.trecho?.includes("lancamentos")
      ),
      true,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("profile software bloqueia texto visivel em espanhol sem acento quando contrato declara i18n_es", async () => {
  const { dir, contrato } = await criarContratoSoftwareI18n("i18n_es exige texto visible con acentos.");
  try {
    const resultado = await validarProfileSemantico(contrato, "software", {
      maturidade: "production",
      artefatoTexto: [
        "<label>Descripcion</label>",
        '<input placeholder="Atencion rapida">',
      ].join("\n"),
    });

    assert.equal(resultado.aprovado, false);
    assert.equal(
      resultado.achadosArtefato.some((achado) =>
        achado.id === "software_i18n_diacritico_ausente" &&
        achado.sugestao?.includes("Descripción")
      ),
      true,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("profile software bloqueia contrato i18n sem idioma declarado", async () => {
  const { dir, contrato } = await criarContratoSoftwareI18n("i18n exige texto visivel com acentos.");
  try {
    const resultado = await validarProfileSemantico(contrato, "software", {
      maturidade: "production",
      artefatoTexto: "<label>Descrição</label>",
    });

    assert.equal(resultado.aprovado, false);
    assert.equal(
      resultado.achadosArtefato.some((achado) => achado.id === "software_i18n_idioma_nao_declarado"),
      true,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("profile software bloqueia fechamento com drift falso e overflow mobile", async () => {
  const { dir, contrato } = await criarContratoSoftwareI18n("i18n_ptbr exige texto visivel com acentos. interface responsiva exige prova mobile.");
  try {
    const resultado = await validarProfileSemantico(contrato, "software", {
      maturidade: "production",
      artefatoTexto: [
        "sema drift contratos/despesas.sema --json retornou sucesso:false",
        "vinculos_quebrados: [./index.html]",
        "rotas_divergentes: [GET /index.html]",
        "Viewport mobile 390px: scrollWidth 610 clientWidth 390",
        "<h2>Lançamentos</h2>",
        "<label>Descrição</label>",
      ].join("\n"),
    });

    assert.equal(resultado.aprovado, false);
    assert.equal(
      resultado.achadosArtefato.some((achado) => achado.id === "software_drift_fechamento_falso"),
      true,
    );
    assert.equal(
      resultado.achadosArtefato.some((achado) => achado.id === "software_ui_overflow_horizontal_mobile"),
      true,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("profile software aceita artefato com acentos quando contrato declara idioma i18n", async () => {
  const { dir, contrato } = await criarContratoSoftwareI18n("i18n_ptbr exige texto visivel com acentos.");
  try {
    const resultado = await validarProfileSemantico(contrato, "software", {
      maturidade: "production",
      artefatoTexto: [
        "<label>Descrição</label>",
        '<input placeholder="Ex.: almoço rápido">',
        'const erro = "Valor inválido. Use número positivo.";'
      ].join("\n"),
    });

    assert.equal(
      resultado.achadosArtefato.some((achado) => achado.id === "software_i18n_ptbr_acento_ausente"),
      false,
    );
    assert.equal(
      resultado.achadosArtefato.some((achado) => achado.id === "software_i18n_diacritico_ausente"),
      false,
    );
    assert.equal(resultado.aprovado, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

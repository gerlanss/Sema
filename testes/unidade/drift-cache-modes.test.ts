// SEMA-GOVERNED: sema.produto.governanca_ia.drift.cache.modos
// Descrição: prova parsing puro, compatibilidade temporária e semântica de execução do drift.

import assert from "node:assert/strict";
import test from "node:test";
import {
  ErroModoCacheDrift,
  parsearModoCacheDrift,
  resolverModoCacheComandoDrift,
  resolverModoCacheConsultaDrift,
  type CodigoErroModoCacheDrift,
  type FlagModoCacheDrift,
  type ModoCacheDrift,
} from "../../pacotes/cli/src/driftCacheModes.js";

function exigirErro(codigo: CodigoErroModoCacheDrift, acao: () => unknown): void {
  assert.throws(acao, (erro: unknown) => {
    assert.ok(erro instanceof ErroModoCacheDrift);
    assert.equal(erro.codigo, codigo);
    return true;
  });
}

test("parser sem flag nao escolhe modo implicitamente", () => {
  assert.deepEqual(parsearModoCacheDrift(["alvo.sema", "--json"]), {
    modo: null,
    flag: null,
    avisos: [],
  });
});

for (const flag of ["--cache", "--drift"] as const satisfies readonly FlagModoCacheDrift[]) {
  for (const modo of ["none", "cache", "fresh"] as const satisfies readonly ModoCacheDrift[]) {
    test(`${flag} aceita o modo canonico ${modo}`, () => {
      assert.deepEqual(parsearModoCacheDrift([flag, modo]), {
        modo,
        flag,
        avisos: [],
      });
      assert.deepEqual(parsearModoCacheDrift([`${flag}=${modo}`]), {
        modo,
        flag,
        avisos: [],
      });
    });
  }
}

for (const flag of ["--cache", "--drift"] as const satisfies readonly FlagModoCacheDrift[]) {
  for (const caso of [
    { alias: "off", modo: "none" },
    { alias: "auto", modo: "cache" },
    { alias: "refresh", modo: "fresh" },
  ] as const) {
    test(`${flag} normaliza o alias temporário ${caso.alias} para ${caso.modo}`, () => {
      const resultado = parsearModoCacheDrift([flag, caso.alias]);
      assert.equal(resultado.modo, caso.modo);
      assert.equal(resultado.flag, flag);
      assert.deepEqual(resultado.avisos, [{
        codigo: "alias_modo_cache_drift_depreciado",
        flag,
        valorRecebido: caso.alias,
        valorNormalizado: caso.modo,
        vigencia: "uma_versao",
        mensagem: `${caso.alias} é um alias temporário; use ${caso.modo}.`,
      }]);
    });
  }
}

test("parser rejeita repeticao da mesma flag mesmo com valores iguais", () => {
  exigirErro(
    "flag_duplicada",
    () => parsearModoCacheDrift(["--drift", "cache", "--drift=cache"]),
  );
  exigirErro(
    "flag_duplicada",
    () => parsearModoCacheDrift(["--cache", "fresh", "--cache", "none"]),
  );
});

test("parser rejeita --cache e --drift juntos mesmo quando convergem", () => {
  exigirErro(
    "flags_conflitantes",
    () => parsearModoCacheDrift(["--cache", "auto", "--drift", "cache"]),
  );
});

test("parser distingue valor ausente de valor invalido", () => {
  exigirErro("valor_ausente", () => parsearModoCacheDrift(["--cache"]));
  exigirErro("valor_ausente", () => parsearModoCacheDrift(["--drift", "--json"]));
  exigirErro("valor_ausente", () => parsearModoCacheDrift(["--cache="]));
  exigirErro("valor_invalido", () => parsearModoCacheDrift(["--drift", "automatico"]));

  assert.throws(
    () => parsearModoCacheDrift(["--cache", "automatico"]),
    (erro: unknown) => {
      assert.ok(erro instanceof ErroModoCacheDrift);
      assert.equal(erro.codigo, "valor_invalido");
      assert.equal(erro.flag, "--cache");
      assert.equal(erro.valor, "automatico");
      return true;
    },
  );
});

test("resolver do comando drift usa fresh por padrao e sempre executa", () => {
  assert.deepEqual(resolverModoCacheComandoDrift([]), {
    modo: "fresh",
    executar: true,
    avisos: [],
  });
  assert.deepEqual(resolverModoCacheComandoDrift(["--cache", "none"]), {
    modo: "none",
    executar: true,
    avisos: [],
  });
  assert.equal(resolverModoCacheComandoDrift(["--cache", "cache"]).executar, true);
  assert.equal(resolverModoCacheComandoDrift(["--cache", "fresh"]).executar, true);
});

test("resolvers exigem a flag canonica de cada superficie", () => {
  exigirErro(
    "flag_nao_permitida_no_comando",
    () => resolverModoCacheComandoDrift(["--drift", "cache"]),
  );
  exigirErro(
    "flag_nao_permitida_no_comando",
    () => resolverModoCacheConsultaDrift(["--cache", "cache"], "resumo"),
  );
});

test("resolver do comando drift preserva aviso de alias", () => {
  const resolucao = resolverModoCacheComandoDrift(["--cache", "refresh"]);
  assert.equal(resolucao.modo, "fresh");
  assert.equal(resolucao.executar, true);
  assert.equal(resolucao.avisos[0]?.valorRecebido, "refresh");
});

test("--com-drift e rejeitado fora das consultas de analise", () => {
  exigirErro("com_drift_nao_permitido", () => resolverModoCacheComandoDrift(["--com-drift"]));
  exigirErro(
    "com_drift_duplicado",
    () => resolverModoCacheComandoDrift(["--com-drift", "--com-drift"]),
  );
});

for (const comando of ["resumo", "inspecionar"] as const) {
  test(`${comando} usa none por padrao e pula a analise`, () => {
    assert.deepEqual(resolverModoCacheConsultaDrift([], comando), {
      modo: "none",
      executar: false,
      avisos: [],
    });
  });

  test(`${comando} mapeia --com-drift para fresh`, () => {
    assert.deepEqual(resolverModoCacheConsultaDrift(["--com-drift"], comando), {
      modo: "fresh",
      executar: true,
      avisos: [],
    });
  });
}

test("consultas executam cache e fresh, mas none pula a analise", () => {
  assert.equal(resolverModoCacheConsultaDrift(["--drift", "cache"], "resumo").executar, true);
  assert.equal(resolverModoCacheConsultaDrift(["--drift", "fresh"], "resumo").executar, true);
  assert.equal(resolverModoCacheConsultaDrift(["--drift", "none"], "resumo").executar, false);
});

test("--com-drift conflita com um modo explicito de consulta", () => {
  exigirErro(
    "com_drift_conflitante",
    () => resolverModoCacheConsultaDrift(["--com-drift", "--drift", "cache"], "resumo"),
  );
  exigirErro(
    "flag_nao_permitida_no_comando",
    () => resolverModoCacheConsultaDrift(["--cache", "fresh", "--com-drift"], "inspecionar"),
  );
});

test("resolver de consulta falha fechado fora de resumo e inspecionar", () => {
  exigirErro(
    "consulta_nao_suportada",
    () => resolverModoCacheConsultaDrift([], "impacto" as "resumo"),
  );
});

test("API nao altera os argumentos recebidos", () => {
  const args = Object.freeze(["alvo.sema", "--drift", "cache", "--json"]);
  const copia = [...args];
  assert.equal(resolverModoCacheConsultaDrift(args, "resumo").modo, "cache");
  assert.deepEqual(args, copia);
});

// SEMA-GOVERNED: sema.software
// Descricao: nucleo semantico particionado; consulte contratos/sema/software.sema antes de editar.

import { criarDiagnostico, type Diagnostico } from "../diagnosticos/index.js";
import type {
  BlocoCasoTesteAst,
  BlocoGenericoAst,
  CampoAst,
  EntityAst,
  EnumAst,
  FlowAst,
  ModuloAst,
  RouteAst,
  StateAst,
  TaskAst,
  TypeAst,
} from "../ast/tipos.js";
import {
  CAMPOS_DATABASE_SUPORTADOS,
  CAMPOS_RECURSO_PERSISTENCIA_SUPORTADOS,
  classificarCompatibilidadePersistencia,
  nomeTipoRecursoPersistencia,
  normalizarConsistenciaPersistencia,
  normalizarDurabilidadePersistencia,
  normalizarEngineBanco,
  normalizarModeloConsultaPersistencia,
  normalizarModeloTransacaoPersistencia,
  parsearBooleanoPersistencia,
  recursoPersistenciaPodeSerPortavel,
} from "../persistencia/contratos.js";
import {
  ehCategoriaEfeitoSemantico,
  ehCriticidadeEfeitoSemantico,
  extrairReferenciasDaExpressao,
  parsearEfeitoSemantico,
  parsearEtapaFlow,
  parsearExpressaoSemantica,
  parsearTransicaoEstado,
} from "./estruturas.js";
import {
  CLASSIFICACOES_DADO_SUPORTADAS,
  MODOS_AUTH_SUPORTADOS,
  MOTIVOS_AUDIT_SUPORTADOS,
  ORIGENS_AUTH_SUPORTADAS,
  PRINCIPAIS_AUTH_SUPORTADOS,
  REDACOES_LOG_SUPORTADAS,
  TENANTS_AUTHZ_SUPORTADOS,
  contratoDadosTemSegredoOuCredencial,
  contratoDadosTemSensivel,
  extrairContratoAudit,
  extrairContratoAuth,
  extrairContratoAuthz,
  extrairContratoDados,
  extrairContratoForbidden,
  extrairContratoSegredos,
  efeitoEhPrivilegiado,
  efeitoRequerSegredo,
  forbiddenContemRegra,
} from "./seguranca.js";

import { CAMPOS_AUDIT_SUPORTADOS, CAMPOS_AUTHZ_SUPORTADOS, CAMPOS_AUTH_SUPORTADOS, CAMPOS_DADOS_SUPORTADOS, CAMPOS_SEGREDO_SUPORTADOS, localizarBloco, localizarCampo, valorCampoCompleto } from "./analisador.part01.js";
import { PerfilSegurancaDeclarado } from "./analisador.part02.js";

export function validarAuthBloco(bloco: BlocoGenericoAst | undefined, diagnosticos: Diagnostico[], contexto: string): void {
  if (!bloco) {
    return;
  }

  for (const campo of bloco.campos) {
    if (!CAMPOS_AUTH_SUPORTADOS.has(campo.nome)) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM074",
          `Campo de auth "${campo.nome}" nao e suportado em ${contexto}.`,
          "erro",
          campo.intervalo,
          "Use apenas modo, estrategia, principal ou origem em auth.",
        ),
      );
    }
  }

  const auth = extrairContratoAuth(bloco);
  if (auth.modo && !MODOS_AUTH_SUPORTADOS.has(auth.modo as (typeof MODOS_AUTH_SUPORTADOS extends Set<infer T> ? T : never))) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM075",
        `Auth em ${contexto} declarou modo invalido: "${auth.modo}".`,
        "erro",
        bloco.intervalo,
        "Use obrigatorio, opcional, anonimo, interno ou m2m.",
      ),
    );
  }
  if (auth.principal && !PRINCIPAIS_AUTH_SUPORTADOS.has(auth.principal as (typeof PRINCIPAIS_AUTH_SUPORTADOS extends Set<infer T> ? T : never))) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM076",
        `Auth em ${contexto} declarou principal invalido: "${auth.principal}".`,
        "erro",
        bloco.intervalo,
        "Use usuario, servico, sistema ou anonimo.",
      ),
    );
  }
  if (auth.origem && !ORIGENS_AUTH_SUPORTADAS.has(auth.origem as (typeof ORIGENS_AUTH_SUPORTADAS extends Set<infer T> ? T : never))) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM077",
        `Auth em ${contexto} declarou origem invalida: "${auth.origem}".`,
        "erro",
        bloco.intervalo,
        "Use publica, interna, worker, webhook, fila ou cron.",
      ),
    );
  }
}

export function validarAuthzBloco(bloco: BlocoGenericoAst | undefined, diagnosticos: Diagnostico[], contexto: string): void {
  if (!bloco) {
    return;
  }

  for (const campo of bloco.campos) {
    if (!CAMPOS_AUTHZ_SUPORTADOS.has(campo.nome)) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM078",
          `Campo de authz "${campo.nome}" nao e suportado em ${contexto}.`,
          "erro",
          campo.intervalo,
          "Use papel, papeis, escopo, escopos, politica ou tenant em authz.",
        ),
      );
    }
  }

  const authz = extrairContratoAuthz(bloco);
  if (authz.tenant && !TENANTS_AUTHZ_SUPORTADOS.has(authz.tenant as (typeof TENANTS_AUTHZ_SUPORTADOS extends Set<infer T> ? T : never))) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM079",
        `Authz em ${contexto} declarou tenant invalido: "${authz.tenant}".`,
        "erro",
        bloco.intervalo,
        "Use obrigatorio, opcional ou isolado.",
      ),
    );
  }
  if (authz.papeis.length === 0 && authz.escopos.length === 0 && !authz.politica) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM080",
        `Authz em ${contexto} precisa declarar papeis, escopos ou politica.`,
        "erro",
        bloco.intervalo,
        "Explicite ao menos um papel, escopo ou politica para a autorizacao nao virar enfeite.",
      ),
    );
  }
}

export function validarDadosBloco(bloco: BlocoGenericoAst | undefined, diagnosticos: Diagnostico[], contexto: string): void {
  if (!bloco) {
    return;
  }

  for (const campo of bloco.campos) {
    const valor = valorCampoCompleto(campo);
    if (CAMPOS_DADOS_SUPORTADOS.has(campo.nome)) {
      continue;
    }
    if (valor && !CLASSIFICACOES_DADO_SUPORTADAS.has(valor as (typeof CLASSIFICACOES_DADO_SUPORTADAS extends Set<infer T> ? T : never))) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM081",
          `Dados em ${contexto} declarou classificacao invalida para "${campo.nome}": "${valor}".`,
          "erro",
          campo.intervalo,
          "Use publico, interno, pii, financeiro, credencial ou segredo.",
        ),
      );
    }
  }

  const dados = extrairContratoDados(bloco);
  if (dados.classificacaoPadrao && !CLASSIFICACOES_DADO_SUPORTADAS.has(dados.classificacaoPadrao as (typeof CLASSIFICACOES_DADO_SUPORTADAS extends Set<infer T> ? T : never))) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM081",
        `Dados em ${contexto} declarou classificacao_padrao invalida: "${dados.classificacaoPadrao}".`,
        "erro",
        bloco.intervalo,
        "Use publico, interno, pii, financeiro, credencial ou segredo.",
      ),
    );
  }
  if (dados.redacaoLog && !REDACOES_LOG_SUPORTADAS.has(dados.redacaoLog as (typeof REDACOES_LOG_SUPORTADAS extends Set<infer T> ? T : never))) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM082",
        `Dados em ${contexto} declarou redacao_log invalida: "${dados.redacaoLog}".`,
        "erro",
        bloco.intervalo,
        "Use livre, parcial, obrigatoria ou proibida.",
      ),
    );
  }

  for (const subbloco of bloco.blocos) {
    if (subbloco.tipo !== "bloco_generico") {
      continue;
    }
    const nomeSubbloco = subbloco.nome ?? subbloco.palavraChave;
    if (nomeSubbloco !== "input" && nomeSubbloco !== "output") {
      diagnosticos.push(
        criarDiagnostico(
          "SEM083",
          `Dados em ${contexto} nao suporta o subbloco "${nomeSubbloco}".`,
          "erro",
          subbloco.intervalo,
          "Use apenas campos diretos ou subblocos input/output para classificar dados.",
        ),
      );
      continue;
    }

    for (const campo of subbloco.campos) {
      const classificacao = valorCampoCompleto(campo);
      if (classificacao && !CLASSIFICACOES_DADO_SUPORTADAS.has(classificacao as (typeof CLASSIFICACOES_DADO_SUPORTADAS extends Set<infer T> ? T : never))) {
        diagnosticos.push(
          criarDiagnostico(
            "SEM081",
            `Dados em ${contexto} declarou classificacao invalida para "${nomeSubbloco}.${campo.nome}": "${classificacao}".`,
            "erro",
            campo.intervalo,
            "Use publico, interno, pii, financeiro, credencial ou segredo.",
          ),
        );
      }
    }
  }
}

export function validarAuditBloco(bloco: BlocoGenericoAst | undefined, diagnosticos: Diagnostico[], contexto: string): void {
  if (!bloco) {
    return;
  }

  for (const campo of bloco.campos) {
    if (!CAMPOS_AUDIT_SUPORTADOS.has(campo.nome)) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM084",
          `Campo de audit "${campo.nome}" nao e suportado em ${contexto}.`,
          "erro",
          campo.intervalo,
          "Use evento, ator, correlacao, retencao ou motivo em audit.",
        ),
      );
    }
  }

  const audit = extrairContratoAudit(bloco);
  if (!audit.evento) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM085",
        `Audit em ${contexto} precisa declarar evento.`,
        "erro",
        bloco.intervalo,
        "Explique qual evento auditavel sera registrado para a operacao.",
      ),
    );
  }
  if (audit.motivo && !MOTIVOS_AUDIT_SUPORTADOS.has(audit.motivo as (typeof MOTIVOS_AUDIT_SUPORTADOS extends Set<infer T> ? T : never))) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM086",
        `Audit em ${contexto} declarou motivo invalido: "${audit.motivo}".`,
        "erro",
        bloco.intervalo,
        "Use obrigatorio, opcional ou dispensado.",
      ),
    );
  }
}

export function validarSegredosBloco(bloco: BlocoGenericoAst | undefined, diagnosticos: Diagnostico[], contexto: string): void {
  if (!bloco) {
    return;
  }

  const segredos = extrairContratoSegredos(bloco);
  if (segredos.itens.length === 0) {
    diagnosticos.push(
      criarDiagnostico(
        "SEM087",
        `Segredos em ${contexto} precisa declarar ao menos um segredo nomeado.`,
        "erro",
        bloco.intervalo,
        "Use segredos { nome_do_segredo { origem: vault escopo: runtime ... } }.",
      ),
    );
    return;
  }

  for (const item of bloco.blocos) {
    if (item.tipo !== "bloco_generico") {
      continue;
    }

    for (const campo of item.campos) {
      if (!CAMPOS_SEGREDO_SUPORTADOS.has(campo.nome)) {
        diagnosticos.push(
          criarDiagnostico(
            "SEM087",
            `Segredo "${item.nome ?? item.palavraChave}" em ${contexto} usa o campo "${campo.nome}", que nao e suportado.`,
            "erro",
            campo.intervalo,
            "Use origem, escopo, acesso, rotacao, nao_logar, nao_retornar ou mascarar.",
          ),
        );
      }
    }

    const nomeSegredo = item.nome ?? item.palavraChave;
    const origem = valorCampoCompleto(localizarCampo(item, "origem"));
    if (!origem) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM088",
          `Segredo "${nomeSegredo}" em ${contexto} precisa declarar origem.`,
          "erro",
          item.intervalo,
          "Explicite a origem do segredo, como vault, env, secret_manager ou runtime.",
        ),
      );
    }

    for (const nomeBooleano of ["nao_logar", "nao_retornar", "mascarar"]) {
      const campo = localizarCampo(item, nomeBooleano);
      const valor = valorCampoCompleto(campo);
      if (campo && valor !== "verdadeiro" && valor !== "true" && valor !== "falso" && valor !== "false") {
        diagnosticos.push(
          criarDiagnostico(
            "SEM089",
            `Segredo "${nomeSegredo}" em ${contexto} declarou "${nomeBooleano}" com valor invalido: "${valor}".`,
            "erro",
            campo.intervalo,
            "Use verdadeiro/falso para campos booleanos de segredos.",
          ),
        );
      }
    }
  }
}

export function validarForbiddenBloco(
  bloco: BlocoGenericoAst | undefined,
  efeitos: BlocoGenericoAst["linhas"],
  diagnosticos: Diagnostico[],
  contexto: string,
): ReturnType<typeof extrairContratoForbidden> {
  const forbidden = extrairContratoForbidden(bloco);
  if (!bloco) {
    return forbidden;
  }

  for (const regra of forbidden.regras) {
    if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/u.test(regra)) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM090",
          `Forbidden em ${contexto} declarou regra invalida: "${regra}".`,
          "erro",
          bloco.intervalo,
          "Use regras simples como network.egress, shell.exec, retorno.credencial ou log.segredo.",
        ),
      );
    }
  }

  for (const linha of efeitos) {
    const efeito = parsearEfeitoSemantico(linha.conteudo);
    if (efeito && forbiddenContemRegra(forbidden, efeito.categoria)) {
      diagnosticos.push(
        criarDiagnostico(
          "SEM091",
          `Forbidden em ${contexto} proibe "${efeito.categoria}", mas effects ainda declara esse efeito.`,
          "erro",
          linha.intervalo,
          "Remova o efeito proibido ou ajuste o bloco forbidden para refletir a operacao permitida de verdade.",
        ),
      );
    }
  }

  return forbidden;
}

export function coletarPerfilSegurancaDeclarado(
  corpo: BlocoGenericoAst,
  effects: BlocoGenericoAst | undefined,
  diagnosticos: Diagnostico[] | undefined,
  contexto: string,
): PerfilSegurancaDeclarado {
  const authBloco = localizarBloco(corpo, "auth");
  const authzBloco = localizarBloco(corpo, "authz");
  const dadosBloco = localizarBloco(corpo, "dados");
  const auditBloco = localizarBloco(corpo, "audit");
  const segredosBloco = localizarBloco(corpo, "segredos");
  const forbiddenBloco = localizarBloco(corpo, "forbidden");

  if (diagnosticos) {
    validarAuthBloco(authBloco, diagnosticos, contexto);
    validarAuthzBloco(authzBloco, diagnosticos, contexto);
    validarDadosBloco(dadosBloco, diagnosticos, contexto);
    validarAuditBloco(auditBloco, diagnosticos, contexto);
    validarSegredosBloco(segredosBloco, diagnosticos, contexto);
  }
  const forbidden = diagnosticos
    ? validarForbiddenBloco(forbiddenBloco, effects?.linhas ?? [], diagnosticos, contexto)
    : extrairContratoForbidden(forbiddenBloco);

  const auth = extrairContratoAuth(authBloco);
  const authz = extrairContratoAuthz(authzBloco);
  const dados = extrairContratoDados(dadosBloco);
  const audit = extrairContratoAudit(auditBloco);
  const segredos = extrairContratoSegredos(segredosBloco);
  const efeitosEstruturados = (effects?.linhas ?? [])
    .map((linha) => parsearEfeitoSemantico(linha.conteudo))
    .filter((efeito): efeito is NonNullable<typeof efeito> => Boolean(efeito));

  return {
    auth,
    authz,
    dados,
    audit,
    segredos,
    forbidden,
    efeitoPrivilegiado: efeitosEstruturados.some((efeito) => efeitoEhPrivilegiado(efeito)),
    dadosSensiveis: contratoDadosTemSensivel(dados),
    exigeSegredos: efeitosEstruturados.some((efeito) => efeitoRequerSegredo(efeito)) || contratoDadosTemSegredoOuCredencial(dados),
  };
}

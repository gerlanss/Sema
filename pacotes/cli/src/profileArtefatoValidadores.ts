// SEMA-GOVERNED
// M?dulo: sema.produto.orcamento_semantico
// Contrato: contratos/sema/orcamento_semantico.sema
// Descri??o: validadores de artefato por profile sem?ntico.

import type { AchadoProfile, MaturidadeProfile, PerfilSemantico, PresetProfile, SeveridadeProfile } from "./profileAuthorTipos.js";
import { contemArtefatoProfile, contratoProibeTermoProfile, criarAchadoArtefatoProfile, trechoRegexProfile } from "./profileRegras.js";
import {
  artefatoParecePagamentoWebhookProfile,
  artefatoPareceWebhookProfile,
  artefatoPareceMultiTenantProfile,
  avaliarPresencaPositivaArtefato,
  localizarIdempotenciaGlobalExternalEventProfile,
  presencaAutenticacaoWebhookProfile,
  presencaIdempotenciaWorkspaceScopedProfile,
  presencaWorkspaceWebhookProfile,
  validarTermosObrigatoriosArtefato,
} from "./profileArtefatoBase.js";
import { avaliarI18nVisivelArtefato } from "./profileI18nVisivel.js";

function detectarOverflowHorizontalMobile(artefato: string): { trecho: string; scrollWidth?: number; clientWidth?: number } | null {
  const comparacaoExplicita = /(?:document\.documentElement\.)?scrollWidth\s*>\s*(?:document\.documentElement\.)?clientWidth/i.exec(artefato);
  if (comparacaoExplicita) {
    return { trecho: comparacaoExplicita[0] };
  }

  const pares = [
    {
      regex: /scrollWidth[\s:=><a-zA-Z().-]{0,40}(\d+(?:\.\d+)?)[\s\S]{0,140}?clientWidth[\s:=><a-zA-Z().-]{0,40}(\d+(?:\.\d+)?)/i,
      scrollIndex: 1,
      clientIndex: 2,
    },
    {
      regex: /clientWidth[\s:=><a-zA-Z().-]{0,40}(\d+(?:\.\d+)?)[\s\S]{0,140}?scrollWidth[\s:=><a-zA-Z().-]{0,40}(\d+(?:\.\d+)?)/i,
      scrollIndex: 2,
      clientIndex: 1,
    },
  ];

  for (const par of pares) {
    const match = par.regex.exec(artefato);
    if (!match) continue;
    const scrollWidth = Number(match[par.scrollIndex]);
    const clientWidth = Number(match[par.clientIndex]);
    if (Number.isFinite(scrollWidth) && Number.isFinite(clientWidth) && scrollWidth > clientWidth) {
      return {
        trecho: match[0].replace(/\s+/g, " ").trim(),
        scrollWidth,
        clientWidth,
      };
    }
  }

  return null;
}

export function avaliarArtefatoSoftwareProfile(
  contrato: string,
  artefato: string,
  maturidade: MaturidadeProfile,
  preset: PresetProfile | null,
): AchadoProfile[] {
  const regras = [
    { id: "software_eval_proibido", termo: "eval", regex: /\beval\s*\(/i, descricao: "codigo usa eval, risco basico de execucao dinamica", sugestao: "troque por parser explicito, tabela de operacoes ou validacao estruturada." },
    { id: "software_function_proibido", termo: "Function", regex: /\bnew\s+Function\b|\bFunction\s*\(/i, descricao: "codigo usa Function dinamico, risco basico de execucao dinamica", sugestao: "remova geracao dinamica de codigo e modele comandos permitidos." },
    { id: "software_innerhtml_inseguro", termo: "innerHTML", regex: /\.innerHTML\s*=|\bdangerouslySetInnerHTML\b/i, descricao: "codigo escreve HTML diretamente em superficie insegura", sugestao: "use textContent, template seguro ou sanitizacao comprovada." },
    { id: "software_sql_concatenado", termo: "SQL", regex: /\b(SELECT|INSERT|UPDATE|DELETE)\b[\s\S]{0,220}(\+|\$\{)/i, descricao: "codigo aparenta concatenar SQL dinamico", sugestao: "use query parametrizada ou builder seguro." },
    { id: "software_segredo_hardcoded", termo: "secret", regex: /\b(api[_-]?key|secret|token|password|senha|credential)\b\s*[:=]\s*["'`][^"'`\s]{8,}["'`]/i, descricao: "codigo aparenta carregar segredo fixo no artefato", sugestao: "mova segredo para variavel de ambiente/cofre e use redacao em exemplos." },
    { id: "software_tls_desativado", termo: "TLS", regex: /rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*["']?0/i, descricao: "codigo aparenta desativar validacao TLS/certificado", sugestao: "corrija cadeia de certificado ou use ambiente de teste isolado sem desligar TLS em producao." },
    { id: "software_shell_input_dinamico", termo: "shell", regex: /\b(exec|execSync|spawn|spawnSync)\s*\([\s\S]{0,160}(req\.|request\.|params|query|body|input|usuario|userInput)/i, descricao: "codigo aparenta executar shell com entrada dinamica", sugestao: "modele allowlist de comandos/argumentos e evite interpolar entrada do usuario." },
  ];
  const achados = regras.flatMap((regra) => {
    const achou = contemArtefatoProfile(artefato, regra.regex);
    if (!achou) return [];
    const politicaEstrita = contratoProibeTermoProfile(contrato, regra.termo) || maturidade === "critical" || preset === "security";
    const severidade: SeveridadeProfile = maturidade === "critical"
      ? "critical"
      : politicaEstrita
        ? "blocking"
        : "warning";
    return [criarAchadoArtefatoProfile(
      regra.id,
      regra.descricao,
      false,
      severidade,
      trechoRegexProfile(artefato, regra.regex),
      regra.sugestao,
    )];
  });

  const pareceWebhook = artefatoPareceWebhookProfile(artefato, preset);
  const pareceWebhookPagamento = artefatoParecePagamentoWebhookProfile(artefato);
  const pareceMultiTenant = artefatoPareceMultiTenantProfile(contrato, artefato);
  if (pareceWebhook && (pareceMultiTenant || pareceWebhookPagamento)) {
    const auth = presencaAutenticacaoWebhookProfile(artefato);
    if (!auth.atendido) {
      achados.push(criarAchadoArtefatoProfile(
        "software_webhook_sem_autenticacao",
        "webhook sensivel nao demonstra autenticacao, assinatura ou segredo",
        false,
        maturidade === "critical" ? "critical" : "blocking",
        auth.trecho ?? trechoRegexProfile(artefato, /webhook|externalEventId|invoiceId|paymentEvent|pagamento/i),
        "exija Authorization, assinatura HMAC ou segredo de webhook antes de aplicar efeito sensivel.",
        auth.motivo,
        {
          linha: auth.linha,
          coluna: auth.coluna,
          inicio: auth.inicio,
          fim: auth.fim,
          risco: "webhook_sensivel_sem_auth",
        },
      ));
    }

    const workspace = presencaWorkspaceWebhookProfile(artefato);
    if (!workspace.atendido) {
      achados.push(criarAchadoArtefatoProfile(
        "software_webhook_sem_workspace",
        "webhook multi-workspace nao demonstra fronteira de workspace/tenant",
        false,
        maturidade === "critical" ? "critical" : "blocking",
        workspace.trecho ?? trechoRegexProfile(artefato, /invoiceId|externalEventId|webhook|paymentEvent/i),
        "resolva workspace por header/slug/tenant autenticado e valide a invoice dentro desse escopo.",
        workspace.motivo,
        {
          linha: workspace.linha,
          coluna: workspace.coluna,
          inicio: workspace.inicio,
          fim: workspace.fim,
          risco: "isolamento_multi_workspace_ausente",
        },
      ));
    }
  }

  const externalEventGlobal = localizarIdempotenciaGlobalExternalEventProfile(artefato);
  const externalEventPresente = /\bexternalEventId\b/i.test(artefato);
  const idempotenciaScoped = presencaIdempotenciaWorkspaceScopedProfile(artefato);
  if (externalEventGlobal || (pareceMultiTenant && pareceWebhook && externalEventPresente && !idempotenciaScoped.atendido)) {
    achados.push(criarAchadoArtefatoProfile(
      "software_external_event_idempotencia_global",
      "externalEventId parece unico globalmente em contexto multi-workspace",
      false,
      maturidade === "critical" ? "critical" : "blocking",
      externalEventGlobal?.trecho ?? idempotenciaScoped.trecho ?? trechoRegexProfile(artefato, /\bexternalEventId\b/i),
      "use chave composta por workspaceId/tenantId + externalEventId para idempotencia por workspace.",
      idempotenciaScoped.motivo,
      {
        linha: externalEventGlobal?.linha ?? idempotenciaScoped.linha,
        coluna: externalEventGlobal?.coluna ?? idempotenciaScoped.coluna,
        inicio: externalEventGlobal?.inicio ?? idempotenciaScoped.inicio,
        fim: externalEventGlobal?.fim ?? idempotenciaScoped.fim,
        risco: "idempotencia_global_multi_tenant",
      },
    ));
  }

  const prismaManualSql = /schema\.prisma|\bPrisma\b|model\s+\w+\s*\{/i.test(artefato) &&
    /CREATE\s+TABLE|setup-db\.ts|schema SQL manual|sql manual|duplica(?:r|do)? manualmente/i.test(artefato);
  if (prismaManualSql) {
    const severidade: SeveridadeProfile = maturidade === "draft" || maturidade === "prototype" ? "warning" : "blocking";
    achados.push(criarAchadoArtefatoProfile(
      "software_schema_prisma_duplicado",
      "artefato aparenta duplicar schema Prisma em SQL manual",
      false,
      maturidade === "critical" ? "critical" : severidade,
      trechoRegexProfile(artefato, /CREATE\s+TABLE|setup-db\.ts|schema SQL manual|sql manual|duplica(?:r|do)? manualmente/i),
      "derive o banco de migrations Prisma ou gere o bootstrap a partir do schema, evitando duas fontes de verdade.",
      undefined,
      { risco: "drift_schema_persistencia" },
    ));
  }

  const eslintNextSemIgnore = /eslint\.config|npm run lint|lint/i.test(artefato) &&
    /\.next/i.test(artefato) &&
    !/ignores?\s*[:=][\s\S]{0,180}\.next|\.next\/\*\*|ignora\s+\.next/i.test(artefato);
  if (eslintNextSemIgnore) {
    achados.push(criarAchadoArtefatoProfile(
      "software_lint_next_sem_ignore",
      "lint de Next.js parece varrer .next sem ignore explicito",
      false,
      "warning",
      trechoRegexProfile(artefato, /\.next/i),
      "adicione ignore para .next no flat config ou ajuste o script de lint.",
      undefined,
      { risco: "ruido_operacional_de_build" },
    ));
  }

  const driftFalho = /\bdrift\b|vinculos_quebrados|rotas_divergentes/i.test(artefato) &&
    /"?sucesso"?\s*:\s*false|sucesso:false|vinculos_quebrados[\s\S]{0,160}(?:nao_encontrado|\.\/|status|arquivo)|rotas_divergentes[\s\S]{0,160}(?:GET|POST|PUT|PATCH|DELETE|divergente|\/)/i.test(artefato);
  if (driftFalho) {
    achados.push(criarAchadoArtefatoProfile(
      "software_drift_fechamento_falso",
      "evidencia de fechamento contem drift falho, vinculo quebrado ou rota divergente",
      false,
      "blocking",
      trechoRegexProfile(artefato, /"?sucesso"?\s*:\s*false|sucesso:false|vinculos_quebrados[\s\S]{0,160}(?:nao_encontrado|\.\/|status|arquivo)|rotas_divergentes[\s\S]{0,160}(?:GET|POST|PUT|PATCH|DELETE|divergente|\/)/i),
      "corrija os vinculos/rotas/impls, rode sema drift novamente e so conclua com sucesso:true.",
      undefined,
      { risco: "fechamento_com_drift_falho" },
    ));
  }

  const overflowMobile = detectarOverflowHorizontalMobile(artefato);
  if (overflowMobile && /ui|html|css|mobile|viewport|responsiv|interface|dashboard|formul/i.test(`${contrato}\n${artefato}`)) {
    achados.push(criarAchadoArtefatoProfile(
      "software_ui_overflow_horizontal_mobile",
      "evidencia visual indica overflow horizontal em viewport mobile",
      false,
      maturidade === "critical" ? "critical" : "blocking",
      overflowMobile.trecho,
      "ajuste CSS/layout e valide novamente em mobile; scrollWidth precisa ser menor ou igual a clientWidth.",
      undefined,
      { risco: "responsividade_mobile_nao_observada" },
    ));
  }

  achados.push(...avaliarI18nVisivelArtefato(contrato, artefato, maturidade));

  return achados;
}

export function avaliarArtefatoWorkflowProfile(contrato: string, artefato: string, preset: PresetProfile | null): AchadoProfile[] {
  const achados = validarTermosObrigatoriosArtefato(artefato, [
    { id: "workflow_idempotencia_artefato", descricao: "workflow real declara idempotencia", regex: /idempot/i, sugestao: "adicione chave idempotente por evento/webhook ou etapa." },
    { id: "workflow_retry_artefato", descricao: "workflow real declara retry/retentativa", regex: /retry|retent/i, sugestao: "declare politica de retentativa, limites e erro final." },
    { id: "workflow_compensacao_artefato", descricao: "workflow real declara compensacao/fallback", regex: /compens|fallback|revers/i, sugestao: "declare compensacao para efeitos ja aplicados." },
  ]);
  const contratoExigePagamentoAntes = /validar pagamento[\s\S]{0,120}antes[\s\S]{0,120}criar pedido/i.test(contrato);
  const criaPedido = artefato.search(/criar pedido/i);
  const validaPagamento = artefato.search(/validar pagamento/i);
  if (contratoExigePagamentoAntes && criaPedido >= 0 && validaPagamento >= 0 && criaPedido < validaPagamento) {
    achados.push(criarAchadoArtefatoProfile(
      "workflow_ordem_pagamento_invertida",
      "workflow cria pedido antes de validar pagamento, contrariando ordem contratada",
      false,
      "critical",
      trechoRegexProfile(artefato, /criar pedido[\s\S]{0,160}validar pagamento/i),
      "reordene a etapa de validacao antes da criacao persistente ou declare reserva reversivel.",
    ));
  }
  if (preset === "webhook" && !avaliarPresencaPositivaArtefato(artefato, /webhook/i).atendido) {
    achados.push(criarAchadoArtefatoProfile("workflow_preset_webhook_sem_superficie", "preset webhook exige superficie webhook no artefato", false, "blocking", undefined, "nomeie endpoint/evento, payload e idempotencia."));
  }
  const pareceWebhook = artefatoPareceWebhookProfile(artefato, preset);
  if (pareceWebhook) {
    const auth = presencaAutenticacaoWebhookProfile(artefato);
    if (!auth.atendido) {
      achados.push(criarAchadoArtefatoProfile(
        "workflow_webhook_sem_autenticacao",
        "webhook real nao declara autenticacao, assinatura ou segredo",
        false,
        "blocking",
        auth.trecho ?? trechoRegexProfile(artefato, /webhook|externalEventId|invoiceId|pagamento/i),
        "declare secret, assinatura, token ou Authorization para o endpoint.",
        auth.motivo,
        {
          linha: auth.linha,
          coluna: auth.coluna,
          inicio: auth.inicio,
          fim: auth.fim,
          risco: "webhook_sem_auth",
        },
      ));
    }

    const exigeWorkspace = artefatoPareceMultiTenantProfile(contrato, artefato) || artefatoParecePagamentoWebhookProfile(artefato);
    if (exigeWorkspace) {
      const workspace = presencaWorkspaceWebhookProfile(artefato);
      if (!workspace.atendido) {
        achados.push(criarAchadoArtefatoProfile(
          "workflow_webhook_sem_workspace",
          "webhook multi-tenant nao declara workspace/tenant de fronteira",
          false,
          "blocking",
          workspace.trecho ?? trechoRegexProfile(artefato, /webhook|invoiceId|externalEventId|pagamento/i),
          "inclua workspaceSlug/workspaceId/tenant autenticado e valide efeitos dentro desse escopo.",
          workspace.motivo,
          {
            linha: workspace.linha,
            coluna: workspace.coluna,
            inicio: workspace.inicio,
            fim: workspace.fim,
            risco: "isolamento_multi_workspace_ausente",
          },
        ));
      }
    }

    const externalEventGlobal = localizarIdempotenciaGlobalExternalEventProfile(artefato);
    const externalEventPresente = /\bexternalEventId\b/i.test(artefato);
    const idempotenciaScoped = presencaIdempotenciaWorkspaceScopedProfile(artefato);
    if (externalEventGlobal || (externalEventPresente && !idempotenciaScoped.atendido && (artefatoPareceMultiTenantProfile(contrato, artefato) || artefatoParecePagamentoWebhookProfile(artefato)))) {
      achados.push(criarAchadoArtefatoProfile(
        "workflow_webhook_idempotencia_global",
        "webhook usa externalEventId sem escopo de workspace/tenant",
        false,
        "blocking",
        externalEventGlobal?.trecho ?? idempotenciaScoped.trecho ?? trechoRegexProfile(artefato, /\bexternalEventId\b/i),
        "modele idempotencia por workspaceId/tenantId + externalEventId.",
        idempotenciaScoped.motivo,
        {
          linha: externalEventGlobal?.linha ?? idempotenciaScoped.linha,
          coluna: externalEventGlobal?.coluna ?? idempotenciaScoped.coluna,
          inicio: externalEventGlobal?.inicio ?? idempotenciaScoped.inicio,
          fim: externalEventGlobal?.fim ?? idempotenciaScoped.fim,
          risco: "idempotencia_global_multi_tenant",
        },
      ));
    }

    if (/invoiceId/i.test(artefato) && (!auth.atendido || !presencaWorkspaceWebhookProfile(artefato).atendido)) {
      achados.push(criarAchadoArtefatoProfile(
        "workflow_webhook_apenas_invoice_id",
        "webhook de pagamento parece aplicar efeito sensivel a partir de invoiceId sem fronteira suficiente",
        false,
        "critical",
        trechoRegexProfile(artefato, /invoiceId[\s\S]{0,160}(?:paidAt|amount|pago|pagamento|paid)|(?:paidAt|amount|pago|pagamento|paid)[\s\S]{0,160}invoiceId/i),
        "resolva workspace/autenticacao antes de buscar a invoice e rejeite invoice fora do escopo.",
        undefined,
        { risco: "efeito_sensivel_cross_tenant" },
      ));
    }
  }
  return achados;
}

export function avaliarArtefatoOpsProfile(artefato: string, preset: PresetProfile | null): AchadoProfile[] {
  const checks = [
    { id: "ops_runbook_artefato", descricao: "plano operacional contem runbook", regex: /runbook|passo a passo|procedimento/i, sugestao: "adicione runbook executavel com passos, dono e criterio de parada." },
    { id: "ops_rollback_artefato", descricao: "plano operacional contem rollback", regex: /rollback|reverter|revers/i, sugestao: "adicione comando/criterio de rollback." },
    { id: "ops_healthcheck_artefato", descricao: "plano operacional contem healthcheck", regex: /healthcheck|healthz|smoke|verificacao live|verificaÃ§Ã£o live/i, sugestao: "declare endpoint, comando ou metrica que prova recuperacao." },
    { id: "ops_responsavel_artefato", descricao: "plano operacional declara responsavel/oncall", regex: /responsavel|responsÃ¡vel|owner|oncall|dono/i, sugestao: "declare responsavel operacional, oncall ou dono da mudanca." },
    { id: "ops_comunicacao_artefato", descricao: "plano operacional contem comunicacao", regex: /comunic|avisar|status page|cliente/i, severidade: "warning" as SeveridadeProfile, sugestao: "adicione quando e quem comunicar." },
  ];
  const achados = validarTermosObrigatoriosArtefato(artefato, checks);
  if ((preset === "migration" || preset === "critical") && !avaliarPresencaPositivaArtefato(artefato, /backup|snapshot|revers/i).atendido) {
    achados.push(criarAchadoArtefatoProfile("ops_migration_sem_reversibilidade", "migration/critical exige reversibilidade comprovada", false, "critical", undefined, "declare backup, snapshot, down migration ou estrategia manual testada."));
  }
  if (preset === "rollback" && !avaliarPresencaPositivaArtefato(artefato, /criterio|critÃ©rio|gatilho|recuper/i).atendido) {
    achados.push(criarAchadoArtefatoProfile("ops_rollback_sem_criterio_recuperacao", "rollback exige criterio objetivo de recuperacao", false, "blocking", undefined, "declare gatilho de rollback e criterio verificavel de recuperacao."));
  }
  return achados;
}

export function avaliarArtefatoLegalProfile(artefato: string, preset: PresetProfile | null): AchadoProfile[] {
  const achados: AchadoProfile[] = [];
  const pareceFinal = /parecer final|opiniao definitiva|opiniÃ£o definitiva|conclusao juridica definitiva|conclusÃ£o jurÃ­dica definitiva/i.test(artefato);
  const temRevisaoHumana = avaliarPresencaPositivaArtefato(artefato, /revisao humana|revisÃ£o humana|advogado|minuta|rascunho|preliminar/i).atendido;
  const temAvisoNaoParecer = /nao e parecer|nÃ£o Ã© parecer/i.test(artefato);
  const temFreioHumano = temRevisaoHumana || temAvisoNaoParecer;
  if (pareceFinal && !temFreioHumano) {
    achados.push(criarAchadoArtefatoProfile(
      "legal_parecer_final_sem_revisao",
      "documento legal parece parecer final sem revisao humana obrigatoria",
      false,
      "critical",
      trechoRegexProfile(artefato, /parecer final|opiniao definitiva|opiniÃ£o definitiva/i),
      "marque como minuta/preliminar e exija revisao humana por profissional habilitado.",
    ));
  }
  if (preset === "lgpd") {
    achados.push(...validarTermosObrigatoriosArtefato(artefato, [
      { id: "legal_lgpd_base_finalidade", descricao: "artefato LGPD declara base legal e finalidade", regex: /base legal[\s\S]{0,160}finalidade|finalidade[\s\S]{0,160}base legal/i, severidade: "critical", sugestao: "inclua matriz dado -> finalidade -> base legal." },
      { id: "legal_lgpd_retencao_direitos", descricao: "artefato LGPD declara retencao e direitos do titular", regex: /retencao|retenÃ§Ã£o/i, severidade: "blocking", sugestao: "inclua retencao, descarte e direitos do titular." },
    ]));
  }
  if (preset === "privacidade") {
    achados.push(...validarTermosObrigatoriosArtefato(artefato, [
      { id: "legal_privacidade_dados_finalidade", descricao: "politica de privacidade declara dados tratados e finalidade", regex: /dados?[\s\S]{0,120}finalidade|finalidade[\s\S]{0,120}dados?/i, severidade: "critical", sugestao: "inclua dados coletados/tratados e finalidade de cada uso." },
      { id: "legal_privacidade_base_legal", descricao: "politica de privacidade declara base legal", regex: /base legal|consentimento|legitimo interesse|legÃ­timo interesse|execucao de contrato|execuÃ§Ã£o de contrato/i, severidade: "critical", sugestao: "declare base legal por finalidade." },
      { id: "legal_privacidade_retencao", descricao: "politica de privacidade declara retencao/descarte", regex: /retencao|retenÃ§Ã£o|descarte|prazo de guarda/i, severidade: "blocking", sugestao: "declare prazo de retencao e descarte." },
      { id: "legal_privacidade_direitos_contato", descricao: "politica de privacidade declara direitos do titular e contato/DPO", regex: /direitos? do titular[\s\S]{0,160}(contato|dpo|encarregado)|(?:contato|dpo|encarregado)[\s\S]{0,160}direitos? do titular/i, severidade: "blocking", sugestao: "declare direitos do titular e canal de contato/encarregado." },
    ]));
  }
  return achados;
}

export function avaliarArtefatoResearchProfile(artefato: string, preset: PresetProfile | null): AchadoProfile[] {
  const achados = validarTermosObrigatoriosArtefato(artefato, [
    { id: "research_fontes_artefato", descricao: "resposta final cita fontes ou referencias", regex: /https?:\/\/|\[[0-9]+\]|fonte|referencia|referÃªncia/i, sugestao: "inclua fontes citaveis e separe evidencia de opiniao." },
    { id: "research_incerteza_artefato", descricao: "resposta final declara incerteza ou limite", regex: /incerteza|limite|baixa confianca|baixa confianÃ§a|lacuna/i, sugestao: "declare limites, incertezas e o que nao foi verificado." },
    { id: "research_fato_inferencia_artefato", descricao: "resposta separa fato de inferencia", regex: /fato|inferencia|inferÃªncia/i, sugestao: "rotule conclusoes como fato, inferencia ou recomendacao." },
  ]);
  if (preset === "critica" && !avaliarPresencaPositivaArtefato(artefato, /contra.?evidencia|contra.?evidÃªncia|evidencia contra|evidÃªncia contra|refut/i).atendido) {
    achados.push(criarAchadoArtefatoProfile("research_sem_contraditorio", "pesquisa critica nao tentou derrubar a conclusao", false, "blocking", undefined, "adicione secao de evidencias contra a recomendacao principal."));
  }
  return achados;
}

export function avaliarArtefatoRedacaoProfile(artefato: string, preset: PresetProfile | null): AchadoProfile[] {
  const achados = validarTermosObrigatoriosArtefato(artefato, [
    { id: "redacao_tema_pauta_artefato", descricao: "artefato de redacao declara tema, pauta ou titulo editorial", regex: /tema|pauta|titulo|tÃ­tulo|h1|headline/i, sugestao: "declare tema/pauta e titulo antes do texto final." },
    { id: "redacao_seo_artefato", descricao: "artefato de redacao declara SEO, palavra-chave ou intencao de busca", regex: /seo|palavra[-_ ]chave|keyword|intencao de busca|intenÃ§Ã£o de busca|meta description|titulo seo/i, sugestao: "inclua palavra-chave principal, intencao de busca e metadados SEO quando aplicavel." },
    { id: "redacao_publico_objetivo_artefato", descricao: "artefato de redacao declara publico e objetivo", regex: /publico|pÃºblico|objetivo|persona|leitor/i, sugestao: "declare quem vai ler e qual acao/resultado o texto busca." },
  ]);

  if ((preset === "materia" || preset === "reescrita") && !avaliarPresencaPositivaArtefato(artefato, /midia|mÃ­dia|imagem|embed|src|alt|caption|preserv/i).atendido) {
    achados.push(criarAchadoArtefatoProfile(
      "redacao_midia_nao_declarada",
      "reescrita ou materia nao declara preservacao de midia original",
      false,
      "blocking",
      trechoRegexProfile(artefato, /materia|matÃ©ria|reescrit/i),
      "inclua mapa de midia original e regra para preservar src, alt, caption, embed e posicao relativa.",
      undefined,
      { risco: "midia_original_perdida" },
    ));
  }

  if (preset === "reescrita" && !avaliarPresencaPositivaArtefato(artefato, /plagio|plÃ¡gio|sem plagio|sem plÃ¡gio|originalidade|reescrita/i).atendido) {
    achados.push(criarAchadoArtefatoProfile(
      "redacao_reescrita_sem_originalidade",
      "reescrita nao declara bloqueio de plagio ou criterio de originalidade",
      false,
      "critical",
      trechoRegexProfile(artefato, /reescrit/i),
      "adicione criterio de originalidade e bloqueio explicito de plagio.",
      undefined,
      { risco: "plagio_editorial" },
    ));
  }

  const generico = /texto generico|texto genÃ©rico|paragrafo generico|parÃ¡grafo genÃ©rico|como uma ia|nos dias de hoje|voce esta no lugar certo|vocÃª estÃ¡ no lugar certo|solucoes inovadoras|soluÃ§Ãµes inovadoras/i.test(artefato);
  if (generico) {
    achados.push(criarAchadoArtefatoProfile(
      "redacao_voz_generica",
      "texto aparenta voz generica ou formula pronta de IA",
      false,
      "blocking",
      trechoRegexProfile(artefato, /texto generico|texto genÃ©rico|paragrafo generico|parÃ¡grafo genÃ©rico|como uma ia|nos dias de hoje|voce esta no lugar certo|vocÃª estÃ¡ no lugar certo|solucoes inovadoras|soluÃ§Ãµes inovadoras/i),
      "troque formula generica por angulo, exemplo concreto e linguagem do publico.",
      undefined,
      { risco: "baixa_qualidade_editorial" },
    ));
  }

  return achados;
}

export function avaliarArtefatoPropostasProfile(artefato: string, preset: PresetProfile | null): AchadoProfile[] {
  const achados = validarTermosObrigatoriosArtefato(artefato, [
    { id: "propostas_entregaveis_artefato", descricao: "proposta declara entregaveis claros ao cliente", regex: /entregaveis|entregÃ¡veis|entrega|vou entregar|inclui|escopo/i, sugestao: "liste o que sera entregue ao cliente em linguagem curta e concreta." },
    { id: "propostas_persuasao_artefato", descricao: "proposta demonstra persuasao comercial especifica", regex: /dor|resultado|fechamento|persuasiv|confiante|valor|resolver|ganhar tempo|reduzir/i, sugestao: "mostre entendimento da dor e um motivo claro para o cliente escolher essa abordagem." },
    { id: "propostas_nota_interna_artefato", descricao: "proposta separa nota interna da mensagem ao cliente", regex: /nota interna|nota_interna|preco para ganhar|preÃ§o para ganhar|risco|upsell|stack/i, sugestao: "mantenha preco, prazo, stack, risco e upsell na nota interna." },
    { id: "propostas_score90_artefato", descricao: "proposta declara score minimo 90 antes de pronta para enviar", regex: /score(?:_final_proposta)?\s*(?:>=|:|=)?\s*(?:9[0-9]|100)|score minimo 90|score mÃ­nimo 90/i, sugestao: "declare score_final_proposta >= 90 ou bloqueie pronta_para_enviar." },
  ]);

  if (preset === "marketplace" && !avaliarPresencaPositivaArtefato(artefato, /99freelas|workana|marketplace|contato externo|restricoes_plataforma|restriÃ§Ãµes da plataforma/i).atendido) {
    achados.push(criarAchadoArtefatoProfile(
      "propostas_marketplace_sem_restricao",
      "proposta de marketplace nao declara restricoes de plataforma",
      false,
      "blocking",
      trechoRegexProfile(artefato, /proposta|cliente|freela/i),
      "declare restricoes de 99Freelas/Workana e nao envie contato externo quando a plataforma proibir.",
      undefined,
      { risco: "violacao_marketplace" },
    ));
  }

  const scoreBaixo = /\bscore(?:_final_proposta)?\b\s*(?::|=)\s*(?:[0-8]?\d)\b/i.test(artefato);
  if (scoreBaixo) {
    achados.push(criarAchadoArtefatoProfile(
      "propostas_score_abaixo_90",
      "proposta declara score abaixo de 90",
      false,
      "critical",
      trechoRegexProfile(artefato, /\bscore(?:_final_proposta)?\b\s*(?::|=)\s*(?:[0-8]?\d)\b/i),
      "marque pronta_para_enviar como falso e revise persuasao, entregaveis e nota interna.",
      undefined,
      { risco: "proposta_fraca_aprovada" },
    ));
  }

  const enchimento = /proposta generica|proposta genÃ©rica|diagnostico enchendo linguica|diagnÃ³stico enchendo linguiÃ§a|qualidade e compromisso|solucoes inovadoras|soluÃ§Ãµes inovadoras|atender suas necessidades/i.test(artefato);
  if (enchimento) {
    achados.push(criarAchadoArtefatoProfile(
      "propostas_enchimento_generico",
      "proposta aparenta enchimento generico em vez de diagnostico comercial direto",
      false,
      "blocking",
      trechoRegexProfile(artefato, /proposta generica|proposta genÃ©rica|diagnostico enchendo linguica|diagnÃ³stico enchendo linguiÃ§a|qualidade e compromisso|solucoes inovadoras|soluÃ§Ãµes inovadoras|atender suas necessidades/i),
      "remova frases comoditizadas e troque por escopo, dor, entregaveis e proxima acao.",
      undefined,
      { risco: "baixa_conversao_comercial" },
    ));
  }

  return achados;
}

export function avaliarArtefatoGameProfile(artefato: string, preset: PresetProfile | null): AchadoProfile[] {
  const achados = validarTermosObrigatoriosArtefato(artefato, [
    { id: "game_loop_artefato", descricao: "artefato de jogo declara core loop", regex: /core loop|loop|ciclo/i, sugestao: "declare acao principal, feedback, recompensa e reinicio." },
    { id: "game_estado_artefato", descricao: "artefato de jogo declara estado e transicoes", regex: /estado|state|playing|game_over|transic|transiÃ§/i, sugestao: "declare estados e transicoes permitidas." },
    { id: "game_pacing_artefato", descricao: "artefato de jogo declara pacing/curva", regex: /pacing|curva|dificuldade|sessao|sessÃ£o/i, severidade: "warning", sugestao: "adicione ritmo esperado e variacao de dificuldade." },
  ]);
  if (preset === "playtest" && !avaliarPresencaPositivaArtefato(artefato, /10 segundos|1 minuto|um minuto|primeiro minuto/i).atendido) {
    achados.push(criarAchadoArtefatoProfile("game_playtest_sem_tempo", "playtest nao descreve primeiros segundos e primeiro minuto", false, "blocking", undefined, "adicione simulacao dos primeiros 10s e do primeiro minuto."));
  }
  return achados;
}

export function avaliarArtefatoConversasProfile(artefato: string, preset: PresetProfile | null): AchadoProfile[] {
  const achados = validarTermosObrigatoriosArtefato(artefato, [
    { id: "conversas_tom_artefato", descricao: "artefato declara tom/persona da conversa", regex: /tom|persona|voz|formalidade|comercial|persuasiv|serio|consultiv/i, sugestao: "declare o tom, persona e nivel de formalidade usados na resposta." },
    { id: "conversas_estado_cliente_artefato", descricao: "artefato declara estado, intencao ou objecao do cliente", regex: /estado|etapa|intencao|sentimento|objec|lead|cliente/i, sugestao: "registre etapa, intencao detectada, sentimento e objecoes antes da resposta." },
    { id: "conversas_proxima_acao_artefato", descricao: "artefato declara proxima acao ou CTA honesto", regex: /proxima_acao|proxima acao|cta|agendar|encaminhar|diagnostico|abrir chamado|escalar/i, sugestao: "adicione proxima acao clara sem promessa indevida." },
    { id: "conversas_estado_visivel_artefato", descricao: "artefato declara ultima mensagem e ultima resposta visivel", regex: /ultima mensagem|ultima resposta visivel|mensagem_cliente_visivel|resposta_anterior_visivel|historico visivel|conversa visivel/i, sugestao: "baseie o turno na conversa visivel ao cliente, nao em pensamento interno ou resposta bruta." },
    { id: "conversas_saida_cliente_artefato", descricao: "artefato separa saida interna da resposta enviada", regex: /customer_reply|resposta final ao cliente|unica saida visivel|apenas resposta_cliente|somente resposta_cliente/i, sugestao: "declare que apenas customer_reply/resposta_cliente pode sair para o canal." },
    { id: "conversas_dedupe_artefato", descricao: "artefato declara deduplicacao por evento", regex: /dedupe|deduplic|evento_id|message_id|inbound|uma entrada[\s\S]{0,40}uma saida|uma mensagem[\s\S]{0,40}uma resposta/i, sugestao: "declare chave de deduplicacao por evento/mensagem recebida." },
  ]);

  const promessaSemBase = /garanto|garantia total|100%|sem risco|resultado garantido|vender mais em \d+\s*dias|prometo/i.test(artefato);
  if (promessaSemBase) {
    achados.push(criarAchadoArtefatoProfile(
      "conversas_promessa_sem_base",
      "resposta de bot parece prometer resultado, prazo ou garantia sem base",
      false,
      "critical",
      trechoRegexProfile(artefato, /garanto|garantia total|100%|sem risco|resultado garantido|vender mais em \d+\s*dias|prometo/i),
      "troque promessa absoluta por condicao verificavel, limite claro ou proposta de diagnostico.",
      undefined,
      { risco: "promessa_comercial_indevida" },
    ));
  }

  const temContextoAnterior = /ultima resposta visivel|resposta_anterior_visivel|pergunta anterior|escopo faz sentido|proposta faz sentido|etapa atual|etapa escopo/i.test(artefato);
  const confirmacaoCurta = /\b(sim claro|sim|fechado|pode ser|beleza|ok|certo|manda|bora|ta bom|isso mesmo|gostei)\b/i.test(artefato);
  const reiniciouAtendimento = /sou [A-Za-z]|me chamo|como posso ajudar|em que posso ajudar|quer organizar|apresentacao|apresenta[cç][aã]o|inicio de conversa/i.test(artefato);
  if (temContextoAnterior && confirmacaoCurta && reiniciouAtendimento) {
    achados.push(criarAchadoArtefatoProfile(
      "conversas_confirmacao_reiniciada",
      "confirmacao curta foi tratada como novo inicio em vez de avancar a etapa anterior",
      false,
      "critical",
      trechoRegexProfile(artefato, /(?:sim claro|sim|fechado|pode ser|beleza|ok|certo|manda|bora)[\s\S]{0,220}(?:sou [A-Za-z]|me chamo|como posso ajudar|quer organizar|apresenta[cç][aã]o)|(?:escopo faz sentido|proposta faz sentido|pergunta anterior)[\s\S]{0,220}(?:sou [A-Za-z]|me chamo|como posso ajudar|quer organizar|apresenta[cç][aã]o)/i),
      "interprete confirmacoes contra a ultima pergunta visivel e avance a conversa sem repetir saudacao.",
      undefined,
      { risco: "estado_conversa_perdido" },
    ));
  }

  const vazouInterno = /(?:enviar|mandar|resposta visivel|customer_reply|resposta ao cliente)[\s\S]{0,120}(?:intent|stage|facts|missing_critical_info|internal_trace|raciocinio|pensamento interno|analise interna|JSON interno)|(?:raciocinio|pensamento interno|analise interna|JSON interno)[\s\S]{0,120}(?:cliente|canal|enviado|visivel)/i.test(artefato);
  if (vazouInterno) {
    achados.push(criarAchadoArtefatoProfile(
      "conversas_vazamento_interno",
      "resposta parece expor raciocinio, JSON ou campos internos ao cliente",
      false,
      "critical",
      trechoRegexProfile(artefato, /(?:intent|stage|facts|missing_critical_info|internal_trace|raciocinio|pensamento interno|analise interna|JSON interno)[\s\S]{0,160}(?:cliente|canal|enviado|visivel)|(?:enviar|mandar|resposta visivel)[\s\S]{0,160}(?:intent|stage|facts|missing_critical_info|internal_trace|JSON interno)/i),
      "mande ao canal apenas customer_reply/resposta_cliente, mantendo interpretacao e auditoria fora da mensagem visivel.",
      undefined,
      { risco: "vazamento_de_estado_interno" },
    ));
  }

  const whatsapp = /canal\s*:?\s*whatsapp|\bWHATSAPP\b/i.test(artefato);
  const canalAlternativo = /\b(email|e-mail|inbox|caixa de entrada)\b/i.test(artefato);
  const clientePediuCanal = /cliente pediu|cliente solicitou|pedido do cliente|solicitou email|pediu email/i.test(artefato);
  if (whatsapp && canalAlternativo && !clientePediuCanal) {
    achados.push(criarAchadoArtefatoProfile(
      "conversas_canal_inventado",
      "conversa em WhatsApp tenta deslocar para email ou inbox sem pedido do cliente",
      false,
      "blocking",
      trechoRegexProfile(artefato, /WHATSAPP[\s\S]{0,180}(?:email|e-mail|inbox|caixa de entrada)|(?:email|e-mail|inbox|caixa de entrada)[\s\S]{0,180}WHATSAPP/i),
      "resolva no canal atual, a menos que o cliente tenha pedido outro canal.",
      undefined,
      { risco: "friccao_de_canal" },
    ));
  }

  const respostaDuplicada = /duas respostas|duas mensagens visiveis|respondeu duas vezes|duplicou resposta|mesmo inbound|mesmo evento/i.test(artefato);
  const temDedupe = /dedupe|deduplic|evento_id|message_id|inbound_id|uma entrada[\s\S]{0,40}uma saida/i.test(artefato);
  if (respostaDuplicada && !temDedupe) {
    achados.push(criarAchadoArtefatoProfile(
      "conversas_sem_dedupe_evento",
      "artefato indica risco de resposta duplicada sem deduplicacao por evento",
      false,
      "blocking",
      trechoRegexProfile(artefato, /duas respostas|duas mensagens visiveis|respondeu duas vezes|duplicou resposta|mesmo inbound|mesmo evento/i),
      "registre evento_id/message_id e envie no maximo uma resposta visivel por inbound.",
      undefined,
      { risco: "resposta_duplicada" },
    ));
  }

  const precisaEscalar = /irritad|reclamac|juridic|cancelamento|processo|procon|advogado|ameaca/i.test(artefato);
  const escalou = avaliarPresencaPositivaArtefato(artefato, /escalar|humano|atendente|supervisor|ticket|chamado/i);
  if (precisaEscalar && !escalou.atendido) {
    achados.push(criarAchadoArtefatoProfile(
      "conversas_sem_escalacao_humana",
      "conversa sensivel exige escalacao humana explicita",
      false,
      "critical",
      escalou.trecho ?? trechoRegexProfile(artefato, /irritad|reclamac|juridic|cancelamento|processo|procon|advogado/i),
      "declare handoff para humano com motivo e prioridade antes de continuar no bot.",
      escalou.motivo,
      {
        linha: escalou.linha,
        coluna: escalou.coluna,
        inicio: escalou.inicio,
        fim: escalou.fim,
        risco: "handoff_humano_ausente",
      },
    ));
  }

  if (preset === "vendas") {
    achados.push(...validarTermosObrigatoriosArtefato(artefato, [
      { id: "conversas_vendas_objecao_artefato", descricao: "conversa de vendas trata objecao ou dor do cliente", regex: /objec|duvida|dor|interesse|comparando|orcamento/i, sugestao: "trate a objecao antes do CTA." },
      { id: "conversas_vendas_cta_artefato", descricao: "conversa de vendas contem CTA honesto", regex: /agendar|diagnostico|proposta|proxima acao|cta|posso te enviar/i, sugestao: "inclua convite claro e nao agressivo para a proxima etapa." },
    ]));
  }

  if (preset === "suporte") {
    achados.push(...validarTermosObrigatoriosArtefato(artefato, [
      { id: "conversas_suporte_problema_artefato", descricao: "suporte identifica problema ou chamado", regex: /problema|erro|chamado|ticket|suporte/i, sugestao: "identifique problema, contexto e o que sera feito." },
      { id: "conversas_suporte_handoff_artefato", descricao: "suporte declara escalacao quando necessario", regex: /escalar|humano|atendente|ticket|chamado/i, sugestao: "declare quando o atendimento sai do bot." },
    ]));
  }

  if (preset === "cobranca") {
    achados.push(...validarTermosObrigatoriosArtefato(artefato, [
      { id: "conversas_cobranca_tom_artefato", descricao: "cobranca usa tom respeitoso e objetivo", regex: /respeitoso|cordial|tom|sem constrangimento|regularizar/i, severidade: "critical", sugestao: "declare tom respeitoso e evite constrangimento ou ameaca." },
      { id: "conversas_cobranca_dado_artefato", descricao: "cobranca menciona valor, vencimento ou referencia autorizada", regex: /valor|vencimento|fatura|boleto|referencia autorizada/i, severidade: "blocking", sugestao: "referencie apenas dados autorizados da cobranca." },
    ]));
  }

  return achados;
}

export function avaliarArtefatoProfile(
  profile: PerfilSemantico,
  contrato: string,
  artefato: string | null | undefined,
  maturidade: MaturidadeProfile,
  preset: PresetProfile | null,
): AchadoProfile[] {
  if (!artefato || !artefato.trim()) return [];
  switch (profile) {
    case "software":
      return avaliarArtefatoSoftwareProfile(contrato, artefato, maturidade, preset);
    case "workflow":
      return avaliarArtefatoWorkflowProfile(contrato, artefato, preset);
    case "ops":
      return avaliarArtefatoOpsProfile(artefato, preset);
    case "legal":
      return avaliarArtefatoLegalProfile(artefato, preset);
    case "research":
      return avaliarArtefatoResearchProfile(artefato, preset);
    case "redacao":
      return avaliarArtefatoRedacaoProfile(artefato, preset);
    case "propostas":
      return avaliarArtefatoPropostasProfile(artefato, preset);
    case "game":
      return avaliarArtefatoGameProfile(artefato, preset);
    case "conversas":
      return avaliarArtefatoConversasProfile(artefato, preset);
  }
}

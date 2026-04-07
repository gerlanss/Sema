// @ts-nocheck
import type { IrCampo, IrModulo } from "@sema/nucleo";
import {
  mapearTipoParaInputHtml,
  normalizarNomeModulo,
  normalizarNomeParaSimbolo,
  type ArquivoGerado,
} from "@sema/padroes";

function escaparHtml(texto) {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function gerarCampoInput(campo, nivel) {
  const indent = "      ".repeat(nivel);
  const tipo = campo.tipo;
  const tipoInput = mapearTipoParaInputHtml(tipo);
  const obrigatorio = campo.modificadores.includes("required");
  const atributos = obrigatorio ? ' required' : '';

  if (tipoInput === "textarea") {
    return `${indent}<div class="sema-campo">
${indent}  <label for="campo-${campo.nome}">${campo.nome}${obrigatorio ? ' <span class="sema-obrigatorio">*</span>' : ''}</label>
${indent}  <textarea id="campo-${campo.nome}" name="${campo.nome}" data-tipo-sema="${tipo}"${atributos}></textarea>
${indent}</div>`;
  }

  if (tipoInput === "checkbox") {
    return `${indent}<div class="sema-campo sema-campo-checkbox">
${indent}  <label>
${indent}    <input type="checkbox" id="campo-${campo.nome}" name="${campo.nome}" data-tipo-sema="${tipo}">
${indent}    <span>${campo.nome}</span>
${indent}  </label>
${indent}</div>`;
  }

  return `${indent}<div class="sema-campo">
${indent}  <label for="campo-${campo.nome}">${campo.nome}${obrigatorio ? ' <span class="sema-obrigatorio">*</span>' : ''}</label>
${indent}  <input type="${tipoInput}" id="campo-${campo.nome}" name="${campo.nome}" data-tipo-sema="${tipo}"${atributos}>
${indent}</div>`;
}

function gerarTabelaEntity(entity) {
  const cabecalho = entity.campos.map((campo) => `          <th>${campo.nome} <small>(${campo.tipo})</small></th>`).join("\n");
  return `    <section class="sema-entity" data-entity="${entity.nome}">
      <h3>${entity.nome}</h3>
      <table class="sema-tabela">
        <thead>
          <tr>
${cabecalho}
          </tr>
        </thead>
        <tbody>
          <tr>
${entity.campos.map((campo) => `            <td data-campo="${campo.nome}">—</td>`).join("\n")}
          </tr>
        </tbody>
      </table>
    </section>`;
}

function gerarFormularioTask(task) {
  const campos = task.input.map((campo) => gerarCampoInput(campo, 2)).join("\n\n");
  const erros = Object.entries(task.errors);
  const erroHtml = erros.length > 0
    ? `\n      <div class="sema-erros" data-task="${task.nome}">\n${erros.map(([codigo, mensagem]) => `        <div class="sema-erro" data-erro="${codigo}" hidden>${escaparHtml(mensagem)}</div>`).join("\n")}\n      </div>`
    : "";

  return `    <section class="sema-task" data-task="${task.nome}">
      <h3>Task: ${task.nome}</h3>
      <form id="form-${normalizarNomeParaSimbolo(task.nome)}" class="sema-formulario" data-task="${task.nome}">
        <fieldset>
          <legend>Entrada</legend>
${campos}
        </fieldset>
        <button type="submit" class="sema-botao">Executar ${task.nome}</button>
      </form>${erroHtml}
      <div class="sema-saida" data-task-saida="${task.nome}" hidden>
        <h4>Saida</h4>
${task.output.map((campo) => `        <div class="sema-campo-saida" data-campo="${campo.nome}"><strong>${campo.nome}</strong>: <span>—</span></div>`).join("\n")}
      </div>
    </section>`;
}

function gerarEnumSelect(enumeracao) {
  const opcoes = enumeracao.valores.map((valor) => `        <option value="${valor}">${valor}</option>`).join("\n");
  return `    <section class="sema-enum" data-enum="${enumeracao.nome}">
      <h3>Enum: ${enumeracao.nome}</h3>
      <select id="enum-${normalizarNomeParaSimbolo(enumeracao.nome)}" class="sema-select" data-enum="${enumeracao.nome}">
        <option value="">— Selecionar —</option>
${opcoes}
      </select>
    </section>`;
}

function gerarState(state) {
  const transicoes = state.transicoes.length > 0
    ? state.transicoes.map((transicao) => `        <li class="sema-transicao"><span class="sema-estado-origem">${transicao.origem}</span> → <span class="sema-estado-destino">${transicao.destino}</span></li>`).join("\n")
    : '        <li>Nenhuma transicao declarada.</li>';
  return `    <section class="sema-state" data-state="${state.nome ?? "anonimo"}">
      <h3>State${state.nome ? `: ${state.nome}` : ""}</h3>
      <ul class="sema-transicoes">
${transicoes}
      </ul>
    </section>`;
}

function gerarFlow(flow) {
  const etapas = flow.etapasEstruturadas.map((etapa) => {
    const destinos = [];
    if (etapa.emSucesso) {
      destinos.push(`sucesso → ${etapa.emSucesso}`);
    }
    if (etapa.emErro) {
      destinos.push(`erro → ${etapa.emErro}`);
    }
    return `        <li class="sema-etapa" data-etapa="${etapa.nome}" data-task="${etapa.task ?? ""}">
          <strong>${etapa.nome}</strong>${etapa.task ? ` (usa ${etapa.task})` : ""}${destinos.length > 0 ? ` [${destinos.join(", ")}]` : ""}
        </li>`;
  }).join("\n");
  return `    <section class="sema-flow" data-flow="${flow.nome}">
      <h3>Flow: ${flow.nome}</h3>
      <ol class="sema-etapas">
${etapas || '        <li>Nenhuma etapa estruturada.</li>'}
      </ol>
    </section>`;
}

function gerarRoute(route) {
  return `    <section class="sema-route" data-route="${route.nome}">
      <h3>Route: ${route.nome}</h3>
      <div class="sema-route-detalhe">
        <span class="sema-route-metodo">${route.metodo ?? "POST"}</span>
        <code class="sema-route-caminho">${route.caminho ?? "/"}</code>
        ${route.task ? `<span class="sema-route-task">→ ${route.task}</span>` : ""}
      </div>
      ${route.inputPublico.length > 0 ? `<details class="sema-route-io"><summary>Input publico</summary><ul>${route.inputPublico.map((campo) => `<li>${campo.nome}: ${campo.tipo}${campo.modificadores.includes("required") ? " (obrigatorio)" : ""}</li>`).join("")}</ul></details>` : ""}
      ${route.outputPublico.length > 0 ? `<details class="sema-route-io"><summary>Output publico</summary><ul>${route.outputPublico.map((campo) => `<li>${campo.nome}: ${campo.tipo}</li>`).join("")}</ul></details>` : ""}
    </section>`;
}

export function gerarHtml(modulo: IrModulo): ArquivoGerado[] {
  const nomeBase = normalizarNomeModulo(modulo.nome).replace(/\./g, "_");
  const titulo = modulo.nome.replace(/\./g, " › ");

  const entidades = modulo.entities.map(gerarTabelaEntity).join("\n\n");
  const enums = modulo.enums.map(gerarEnumSelect).join("\n\n");
  const states = modulo.states.map(gerarState).join("\n\n");
  const tasks = modulo.tasks.map(gerarFormularioTask).join("\n\n");
  const flows = modulo.flows.map(gerarFlow).join("\n\n");
  const routes = modulo.routes.map(gerarRoute).join("\n\n");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Contrato Sema: ${escaparHtml(modulo.nome)}">
  <title>${escaparHtml(titulo)} — Sema</title>
  <link rel="stylesheet" href="${nomeBase}.css">
</head>
<body>
  <header class="sema-header">
    <h1>${escaparHtml(titulo)}</h1>
    <p class="sema-subtitulo">Contrato gerado automaticamente pela Sema.</p>
  </header>

  <main class="sema-main">
${entidades ? `    <!-- Entities -->\n${entidades}\n\n` : ""}${enums ? `    <!-- Enums -->\n${enums}\n\n` : ""}${states ? `    <!-- States -->\n${states}\n\n` : ""}${tasks ? `    <!-- Tasks -->\n${tasks}\n\n` : ""}${flows ? `    <!-- Flows -->\n${flows}\n\n` : ""}${routes ? `    <!-- Routes -->\n${routes}\n\n` : ""}  </main>

  <footer class="sema-footer">
    <p>Modulo: <code>${escaparHtml(modulo.nome)}</code> | Gerado pela Sema</p>
  </footer>

  <script src="${nomeBase}.js" type="module"></script>
</body>
</html>
`;

  return [{ caminhoRelativo: `${nomeBase}.html`, conteudo: html }];
}

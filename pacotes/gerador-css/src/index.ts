// @ts-nocheck
import type { IrModulo } from "@sema/nucleo";
import {
  normalizarNomeModulo,
  normalizarNomeParaSimbolo,
  type ArquivoGerado,
} from "@sema/padroes";

function gerarEstilosEntity(entity) {
  const nome = normalizarNomeParaSimbolo(entity.nome);
  return `.sema-entity[data-entity="${entity.nome}"] {
  border-left: 3px solid var(--sema-cor-entidade);
}
`;
}

function gerarEstilosTask(task) {
  const erros = Object.keys(task.errors);
  const erroEstilos = erros.map((nomeErro) => `.sema-erro[data-erro="${nomeErro}"] {
  display: block;
  color: var(--sema-cor-erro-texto);
  background: var(--sema-cor-erro-fundo);
  border-left: 3px solid var(--sema-cor-erro);
  padding: 0.5rem 0.75rem;
  margin-top: 0.5rem;
  border-radius: var(--sema-raio);
  font-size: 0.875rem;
  animation: sema-surgir 0.3s ease;
}
`).join("\n");
  return erroEstilos;
}

function gerarEstilosState(state) {
  const estilos = [];
  for (const transicao of state.transicoes) {
    estilos.push(`.sema-estado-origem:has(+ .sema-estado-destino) { font-weight: 600; }`);
  }
  return estilos.join("\n");
}

function gerarEstilosEnum(enumeracao) {
  return enumeracao.valores.map((valor) => `.sema-select option[value="${valor}"] {
  color: var(--sema-cor-texto);
}
`).join("");
}

export function gerarCss(modulo: IrModulo): ArquivoGerado[] {
  const nomeBase = normalizarNomeModulo(modulo.nome).replace(/\./g, "_");

  const entidades = modulo.entities.map(gerarEstilosEntity).join("\n");
  const tasks = modulo.tasks.map(gerarEstilosTask).join("\n");
  const enums = modulo.enums.map(gerarEstilosEnum).join("\n");

  const css = `/* Arquivo gerado automaticamente pela Sema. */
/* Modulo de origem: ${modulo.nome} */

/* ========================================
   Design System — Variaveis
   ======================================== */

:root {
  /* Cores principais */
  --sema-cor-primaria: #6366f1;
  --sema-cor-primaria-hover: #4f46e5;
  --sema-cor-primaria-suave: #eef2ff;
  --sema-cor-sucesso: #10b981;
  --sema-cor-sucesso-fundo: #ecfdf5;
  --sema-cor-erro: #ef4444;
  --sema-cor-erro-texto: #991b1b;
  --sema-cor-erro-fundo: #fef2f2;
  --sema-cor-aviso: #f59e0b;
  --sema-cor-info: #3b82f6;

  /* Neutros */
  --sema-cor-fundo: #fafafa;
  --sema-cor-superficie: #ffffff;
  --sema-cor-texto: #18181b;
  --sema-cor-texto-secundario: #71717a;
  --sema-cor-borda: #e4e4e7;
  --sema-cor-borda-foco: #a5b4fc;
  --sema-cor-entidade: #8b5cf6;

  /* Tipografia */
  --sema-fonte: "Inter", "Segoe UI", system-ui, -apple-system, sans-serif;
  --sema-fonte-mono: "JetBrains Mono", "Fira Code", "Consolas", monospace;
  --sema-tamanho-base: 0.9375rem;
  --sema-tamanho-titulo: 1.75rem;
  --sema-tamanho-subtitulo: 1.25rem;
  --sema-tamanho-pequeno: 0.8125rem;

  /* Espacamento */
  --sema-espacamento-xs: 0.25rem;
  --sema-espacamento-sm: 0.5rem;
  --sema-espacamento-md: 1rem;
  --sema-espacamento-lg: 1.5rem;
  --sema-espacamento-xl: 2rem;

  /* Bordas e sombras */
  --sema-raio: 0.5rem;
  --sema-raio-lg: 0.75rem;
  --sema-sombra: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04);
  --sema-sombra-lg: 0 4px 12px rgba(0, 0, 0, 0.1);

  /* Transicoes */
  --sema-transicao: 150ms ease;
  --sema-transicao-lenta: 300ms ease;
}

/* ========================================
   Dark Mode
   ======================================== */

@media (prefers-color-scheme: dark) {
  :root {
    --sema-cor-primaria: #818cf8;
    --sema-cor-primaria-hover: #a5b4fc;
    --sema-cor-primaria-suave: #1e1b4b;
    --sema-cor-sucesso: #34d399;
    --sema-cor-sucesso-fundo: #064e3b;
    --sema-cor-erro: #f87171;
    --sema-cor-erro-texto: #fecaca;
    --sema-cor-erro-fundo: #450a0a;
    --sema-cor-fundo: #09090b;
    --sema-cor-superficie: #18181b;
    --sema-cor-texto: #fafafa;
    --sema-cor-texto-secundario: #a1a1aa;
    --sema-cor-borda: #3f3f46;
    --sema-cor-borda-foco: #6366f1;
    --sema-cor-entidade: #a78bfa;
  }
}

/* ========================================
   Base
   ======================================== */

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--sema-fonte);
  font-size: var(--sema-tamanho-base);
  line-height: 1.6;
  color: var(--sema-cor-texto);
  background-color: var(--sema-cor-fundo);
  -webkit-font-smoothing: antialiased;
}

/* ========================================
   Layout
   ======================================== */

.sema-header {
  background: var(--sema-cor-superficie);
  border-bottom: 1px solid var(--sema-cor-borda);
  padding: var(--sema-espacamento-xl) var(--sema-espacamento-lg);
  text-align: center;
}

.sema-header h1 {
  font-size: var(--sema-tamanho-titulo);
  font-weight: 700;
  color: var(--sema-cor-primaria);
  letter-spacing: -0.02em;
}

.sema-subtitulo {
  color: var(--sema-cor-texto-secundario);
  font-size: var(--sema-tamanho-pequeno);
  margin-top: var(--sema-espacamento-xs);
}

.sema-main {
  max-width: 64rem;
  margin: 0 auto;
  padding: var(--sema-espacamento-xl) var(--sema-espacamento-lg);
  display: flex;
  flex-direction: column;
  gap: var(--sema-espacamento-lg);
}

.sema-footer {
  text-align: center;
  padding: var(--sema-espacamento-lg);
  color: var(--sema-cor-texto-secundario);
  font-size: var(--sema-tamanho-pequeno);
  border-top: 1px solid var(--sema-cor-borda);
}

.sema-footer code {
  font-family: var(--sema-fonte-mono);
  background: var(--sema-cor-primaria-suave);
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.8125rem;
}

/* ========================================
   Entities
   ======================================== */

.sema-entity,
.sema-task,
.sema-enum,
.sema-state,
.sema-flow,
.sema-route {
  background: var(--sema-cor-superficie);
  border: 1px solid var(--sema-cor-borda);
  border-radius: var(--sema-raio-lg);
  padding: var(--sema-espacamento-lg);
  box-shadow: var(--sema-sombra);
  transition: box-shadow var(--sema-transicao);
}

.sema-entity:hover,
.sema-task:hover,
.sema-route:hover {
  box-shadow: var(--sema-sombra-lg);
}

.sema-entity h3,
.sema-task h3,
.sema-enum h3,
.sema-state h3,
.sema-flow h3,
.sema-route h3 {
  font-size: var(--sema-tamanho-subtitulo);
  font-weight: 600;
  margin-bottom: var(--sema-espacamento-md);
  color: var(--sema-cor-texto);
}

/* ========================================
   Tabelas de Entity
   ======================================== */

.sema-tabela {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--sema-tamanho-pequeno);
}

.sema-tabela th {
  text-align: left;
  padding: var(--sema-espacamento-sm) var(--sema-espacamento-md);
  background: var(--sema-cor-primaria-suave);
  border-bottom: 2px solid var(--sema-cor-borda);
  font-weight: 600;
  white-space: nowrap;
}

.sema-tabela th small {
  color: var(--sema-cor-texto-secundario);
  font-weight: 400;
  margin-left: 0.25rem;
}

.sema-tabela td {
  padding: var(--sema-espacamento-sm) var(--sema-espacamento-md);
  border-bottom: 1px solid var(--sema-cor-borda);
  color: var(--sema-cor-texto-secundario);
}

/* ========================================
   Formularios de Task
   ======================================== */

.sema-formulario fieldset {
  border: 1px solid var(--sema-cor-borda);
  border-radius: var(--sema-raio);
  padding: var(--sema-espacamento-md);
  margin-bottom: var(--sema-espacamento-md);
}

.sema-formulario legend {
  font-weight: 600;
  font-size: var(--sema-tamanho-pequeno);
  color: var(--sema-cor-texto-secundario);
  padding: 0 var(--sema-espacamento-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.sema-campo {
  margin-bottom: var(--sema-espacamento-md);
}

.sema-campo label {
  display: block;
  font-weight: 500;
  font-size: var(--sema-tamanho-pequeno);
  margin-bottom: var(--sema-espacamento-xs);
  color: var(--sema-cor-texto);
}

.sema-obrigatorio {
  color: var(--sema-cor-erro);
}

.sema-campo input[type="text"],
.sema-campo input[type="number"],
.sema-campo input[type="email"],
.sema-campo input[type="url"],
.sema-campo input[type="date"],
.sema-campo input[type="datetime-local"],
.sema-campo textarea {
  width: 100%;
  padding: 0.5rem 0.75rem;
  font-family: var(--sema-fonte);
  font-size: var(--sema-tamanho-base);
  color: var(--sema-cor-texto);
  background: var(--sema-cor-fundo);
  border: 1px solid var(--sema-cor-borda);
  border-radius: var(--sema-raio);
  outline: none;
  transition: border-color var(--sema-transicao), box-shadow var(--sema-transicao);
}

.sema-campo input:focus,
.sema-campo textarea:focus {
  border-color: var(--sema-cor-borda-foco);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}

.sema-campo textarea {
  min-height: 5rem;
  resize: vertical;
}

.sema-campo-checkbox label {
  display: flex;
  align-items: center;
  gap: var(--sema-espacamento-sm);
  cursor: pointer;
}

.sema-campo-checkbox input[type="checkbox"] {
  width: 1.125rem;
  height: 1.125rem;
  accent-color: var(--sema-cor-primaria);
}

/* ========================================
   Botoes
   ======================================== */

.sema-botao {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.625rem 1.25rem;
  font-family: var(--sema-fonte);
  font-size: var(--sema-tamanho-base);
  font-weight: 600;
  color: #fff;
  background: var(--sema-cor-primaria);
  border: none;
  border-radius: var(--sema-raio);
  cursor: pointer;
  transition: background var(--sema-transicao), transform var(--sema-transicao);
}

.sema-botao:hover {
  background: var(--sema-cor-primaria-hover);
  transform: translateY(-1px);
}

.sema-botao:active {
  transform: translateY(0);
}

/* ========================================
   Erros
   ======================================== */

.sema-erros {
  margin-top: var(--sema-espacamento-sm);
}

.sema-erro[hidden] {
  display: none;
}

/* ========================================
   Saida
   ======================================== */

.sema-saida {
  margin-top: var(--sema-espacamento-md);
  padding: var(--sema-espacamento-md);
  background: var(--sema-cor-sucesso-fundo);
  border: 1px solid var(--sema-cor-sucesso);
  border-radius: var(--sema-raio);
}

.sema-saida[hidden] {
  display: none;
}

.sema-saida h4 {
  font-size: var(--sema-tamanho-pequeno);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--sema-cor-sucesso);
  margin-bottom: var(--sema-espacamento-sm);
}

.sema-campo-saida {
  padding: var(--sema-espacamento-xs) 0;
  font-size: var(--sema-tamanho-pequeno);
}

/* ========================================
   Selects (Enums)
   ======================================== */

.sema-select {
  width: 100%;
  padding: 0.5rem 0.75rem;
  font-family: var(--sema-fonte);
  font-size: var(--sema-tamanho-base);
  color: var(--sema-cor-texto);
  background: var(--sema-cor-fundo);
  border: 1px solid var(--sema-cor-borda);
  border-radius: var(--sema-raio);
  outline: none;
  transition: border-color var(--sema-transicao);
}

.sema-select:focus {
  border-color: var(--sema-cor-borda-foco);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}

/* ========================================
   States
   ======================================== */

.sema-state {
  border-left: 3px solid var(--sema-cor-aviso);
}

.sema-transicoes {
  list-style: none;
  padding: 0;
}

.sema-transicoes li {
  padding: var(--sema-espacamento-sm) 0;
  border-bottom: 1px solid var(--sema-cor-borda);
  font-size: var(--sema-tamanho-pequeno);
}

.sema-transicoes li:last-child {
  border-bottom: none;
}

.sema-estado-origem {
  font-weight: 600;
  color: var(--sema-cor-texto);
}

.sema-estado-destino {
  color: var(--sema-cor-primaria);
  font-weight: 600;
}

/* ========================================
   Flows
   ======================================== */

.sema-flow {
  border-left: 3px solid var(--sema-cor-info);
}

.sema-etapas {
  padding-left: var(--sema-espacamento-lg);
  counter-reset: etapa;
}

.sema-etapas li {
  padding: var(--sema-espacamento-sm) 0;
  font-size: var(--sema-tamanho-pequeno);
}

.sema-etapa strong {
  color: var(--sema-cor-primaria);
}

/* ========================================
   Routes
   ======================================== */

.sema-route {
  border-left: 3px solid var(--sema-cor-sucesso);
}

.sema-route-detalhe {
  display: flex;
  align-items: center;
  gap: var(--sema-espacamento-sm);
  flex-wrap: wrap;
  margin-bottom: var(--sema-espacamento-sm);
}

.sema-route-metodo {
  display: inline-block;
  padding: 0.125rem 0.5rem;
  font-family: var(--sema-fonte-mono);
  font-size: var(--sema-tamanho-pequeno);
  font-weight: 700;
  color: #fff;
  background: var(--sema-cor-sucesso);
  border-radius: 0.25rem;
  text-transform: uppercase;
}

.sema-route-caminho {
  font-family: var(--sema-fonte-mono);
  font-size: var(--sema-tamanho-pequeno);
  color: var(--sema-cor-texto);
}

.sema-route-task {
  font-size: var(--sema-tamanho-pequeno);
  color: var(--sema-cor-texto-secundario);
}

.sema-route-io {
  margin-top: var(--sema-espacamento-sm);
  font-size: var(--sema-tamanho-pequeno);
}

.sema-route-io summary {
  cursor: pointer;
  font-weight: 500;
  color: var(--sema-cor-texto-secundario);
}

.sema-route-io ul {
  padding-left: var(--sema-espacamento-lg);
  margin-top: var(--sema-espacamento-xs);
}

/* ========================================
   Animacoes
   ======================================== */

@keyframes sema-surgir {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ========================================
   Responsividade
   ======================================== */

@media (max-width: 640px) {
  .sema-main {
    padding: var(--sema-espacamento-md);
  }

  .sema-header {
    padding: var(--sema-espacamento-lg) var(--sema-espacamento-md);
  }

  .sema-header h1 {
    font-size: 1.375rem;
  }

  .sema-tabela {
    display: block;
    overflow-x: auto;
  }

  .sema-route-detalhe {
    flex-direction: column;
    align-items: flex-start;
  }
}

/* ========================================
   Estilos especificos do modulo
   ======================================== */

${entidades}
${tasks}
${enums}
`;

  return [{ caminhoRelativo: `${nomeBase}.css`, conteudo: css }];
}

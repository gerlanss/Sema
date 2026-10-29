// SEMA-GOVERNED: sema.produto.cli_invocacao_publica.argumentos
// Descrição: ajuda pequena por comando e um único fluxo IA baseado no perfil e no escopo persistente.
export const FLUXO_IA = [
  "Sema para criar ou editar software, inclusive HTML/CSS/JavaScript simples.",
  "Primeira adoção: pergunte e aguarde aceite. Obtenha a janela realmente configurada; nunca deduza pelo modelo ou ofereça um padrão presumido.",
  'Depois: sema sessao "<intenção>" --janela-contexto <tokens> --arquivo <contrato> --json',
  "O perfil escolhe o contexto. Leia apenas contrato selecionado, dependências justificadas e docs bloqueantes. Resumos são opcionais; índices globais, AST e IR ficam sob demanda, no escopo necessário.",
  'sema docs-impacto --intencao "<intenção>" --arquivo <contrato> --json',
  "Guarde mudancaId. O retorno contém proximasChamadas como arrays de argumentos para sema. Após compactação: sema sessao --mudanca-id <id> --json; use estadoAtual recompilado, não conclusões antigas do resumo da conversa. Protocolo antigo bloqueia até sync-codex e releitura de SEMA_BOOT.md.",
  "Antes da edição: inspecionar <contrato> --drift none; impacto com --alvo <símbolo>; drift <contrato> --cache fresh --pacote --json.",
  "Após editar: validar o contrato, testar o comportamento e repetir drift fresh. Referências válidas e score não comprovam comportamento; confira lacunas de evidência.",
  "Fechamento documental: sema finalizar-mudanca --mudanca-id <id> --doc-lida <doc1> --doc-lida <doc2> --json. Use só docs efetivamente lidas. Declaração não comprova compreensão nem substitui testes.",
  "Consumir JSON diretamente; não cortar linhas nem reserializar com pouca profundidade. Drift com ou sem --pacote: payload.status.success, payload.status.score e payload.counts. Sessão: payload.perfil.janelaTokens, payload.perfil.orcamentoTokens e payload.perfil.reservaSaidaTokens. TypeError ao acessar um campo não é erro de JSON.parse.",
  'Ao criar o contrato, planeje em cada task: impl { js: app.cadastrar } e vinculos { arquivo: "app.js" simbolo: app.cadastrar }. Confirme no código e no drift assim que implementar. HTML/CSS são arquivos vinculados no módulo, não impl JS. SEMA-GOVERNED não substitui o mapeamento; não exige ES modules.',
  "Enum declara valores diretamente: enum Filtro { todas, pendentes, concluidas }. Não aninhe valores { ... }. Corrija diagnósticos antes de usar contagens de uma análise inválida.",
  "Se protocolo/índice estiver desatualizado: sync-codex --json, depois retome a mesma mudança. Sema não concede autorização externa.",
].join("\n");

export function ajudaComandoIa(comando: string): string | undefined {
  const ajuda: Record<string, string> = {
    "sessao": 'sema sessao "<intenção>" --arquivo <contrato> --janela-contexto <tokens> [--salvar-perfil] --json\nRetomar: sema sessao --mudanca-id <id> --json. Sem janela conhecida, pergunte e aguarde. Leia payload.perfil.janelaTokens, payload.perfil.orcamentoTokens e payload.perfil.reservaSaidaTokens. sem_correspondencia significa intenção/arquivo sem contrato correspondente, não documentação finalizada.',
    "docs-impacto": 'sema docs-impacto --intencao "<ação>" --arquivo <contrato> [--arquivo <outro>] [--completo] [--criar-ausentes] --json\nRetomar: sema docs-impacto --mudanca-id <id> --json. Retorna mudancaId e próximas chamadas; referências recomendadas não obrigam leitura.',
    "finalizar-mudanca": 'sema finalizar-mudanca --mudanca-id <id> --doc-lida <doc1> --doc-lida <doc2> --json\nAlternativa explícita: --intencao "<ação>" --arquivo <contrato>. Repita --arquivo e --doc-lida por item; --docs não existe. Não use um contrato como intenção posicional. Confere documentação; não executa testes nem atesta conclusão integral.',
    "drift": "sema drift <contrato.sema> --cache fresh --pacote --json\nEscopo: --escopo arquivo|modulo|projeto. --alvo pertence a impacto, não a drift. Com ou sem --pacote, leia payload.status.success, payload.status.score e payload.counts. Sem --pacote mantém os detalhes e campos legados. Referências encontradas não são comportamento verificado; confira status.behaviorEvidence.",
    "inspecionar": "sema inspecionar <contrato.sema> --drift none --json\nA entrada é um contrato .sema, não o arquivo .js da implementação. Para localizar símbolos vivos, use drift no contrato.",
    "validar": "sema validar <contrato.sema> --json\nValida a linguagem do contrato, não executa a aplicação. Arquivos nos vínculos devem estar entre aspas; use as opções indicadas pelos diagnósticos.",
  };
  return ajuda[comando];
}

// Only fixed, reviewed help may cross the public argument-error boundary.
export function mensagemArgumentosIa(comando: string): string {
  const ajuda = ajudaComandoIa(comando);
  return "Argumentos inválidos. Consulte a ajuda do comando." + (ajuda ? `\n${ajuda}` : "");
}

export function mensagemArgumentosIaPermitida(mensagem: string): boolean {
  return ["sessao", "docs-impacto", "finalizar-mudanca", "drift", "inspecionar", "validar"]
    .some((comando) => mensagem === mensagemArgumentosIa(comando));
}

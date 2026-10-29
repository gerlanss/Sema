// SEMA-GOVERNED: sema.produto.cli_invocacao_publica.argumentos
// Descrição: ajuda pequena por comando e um único fluxo IA baseado no perfil e no escopo persistente.
export const FLUXO_IA = [
  "Sema para criar ou editar software, inclusive HTML/CSS/JavaScript simples.",
  "Primeira adoção: pergunte e aguarde aceite. Obtenha a janela realmente configurada; nunca deduza pelo modelo ou ofereça um padrão presumido.",
  'Depois: sema sessao "<intenção>" --janela-contexto <tokens> --arquivo <contrato> --json',
  "O perfil escolhe o contexto. Leia apenas contrato selecionado, dependências justificadas e docs bloqueantes. Resumos são opcionais; índices globais, AST e IR ficam sob demanda, no escopo necessário.",
  'sema docs-impacto --intencao "<intenção>" --arquivo <contrato> --json',
  "Guarde mudancaId. O retorno contém proximasChamadas como arrays de argumentos para sema. Após compactação: sema sessao --mudanca-id <id> --json.",
  "Antes da edição: inspecionar <contrato> --drift none; impacto com --alvo <símbolo>; drift <contrato> --cache fresh --pacote --json.",
  "Após editar: validar o contrato, testar o comportamento e repetir drift fresh. Referências válidas e score não comprovam comportamento; confira lacunas de evidência.",
  "Fechamento documental: sema finalizar-mudanca --mudanca-id <id> --doc-lida <doc1> --doc-lida <doc2> --json. Use só docs efetivamente lidas. Declaração não comprova compreensão nem substitui testes.",
  "Consumir JSON diretamente; não cortar linhas nem reserializar com pouca profundidade. Use --pacote no drift; detalhes completos somente quando necessários.",
  "Vínculos: arquivo sempre entre aspas, por exemplo arquivo: \"src/app/lista.js\". Use impl na task com o símbolo encontrado pela CLI. JavaScript não precisa virar ES module para usar Sema.",
  "Se protocolo/índice estiver desatualizado: sync-codex --json, depois retome a mesma mudança. Sema não concede autorização externa.",
].join("\n");

export function ajudaComandoIa(comando: string): string | undefined {
  const ajuda: Record<string, string> = {
    "sessao": 'sema sessao "<intenção>" --arquivo <contrato> --janela-contexto <tokens> [--salvar-perfil] --json\nRetomar: sema sessao --mudanca-id <id> --json. Sem janela conhecida, pergunte e aguarde.',
    "docs-impacto": 'sema docs-impacto --intencao "<ação>" --arquivo <contrato> [--arquivo <outro>] [--completo] [--criar-ausentes] --json\nRetomar: sema docs-impacto --mudanca-id <id> --json. Retorna mudancaId e próximas chamadas; referências recomendadas não obrigam leitura.',
    "finalizar-mudanca": 'sema finalizar-mudanca --mudanca-id <id> --doc-lida <doc1> --doc-lida <doc2> --json\nAlternativa explícita: --intencao "<ação>" --arquivo <contrato>. Repita --arquivo e --doc-lida por item; --docs não existe. Não use um contrato como intenção posicional. Confere documentação; não executa testes nem atesta conclusão integral.',
    "drift": "sema drift <contrato.sema> --cache fresh --pacote --json\nEscopo: --escopo arquivo|modulo|projeto. --alvo pertence a impacto, não a drift. Sem --pacote obtém detalhes completos. Referências encontradas não são comportamento verificado; confira tasksWithGaps e status.behaviorEvidence.",
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

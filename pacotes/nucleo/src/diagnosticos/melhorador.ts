// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: codigo governado pelo Sema; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.
// Melhoria de mensagens de erro SEM0xx
// Contrato: cli_melhoria_erros.sema

export interface ErroSemantico {
  codigo: string;
  mensagem: string;
  dica?: string;
  arquivo?: string;
  linha?: number;
  coluna?: number;
  localizacao?: {
    arquivo?: string;
    linha?: number;
    coluna?: number;
  };
}

export interface MensagemMelhorada {
  mensagemMelhorada: string;
  snippetCorrecao: string;
  explicacao: string;
  documentacaoLink: string;
  gravidade: "alta" | "media" | "baixa";
}

const SNIPPETS_CORRECAO: Record<string, (nomeElemento: string) => string> = {
  SEM094: (nome) => `  auth {
    modo: obrigatorio  // ou: anonimo, opcional
  }`,

  SEM095: (nome) => `  authz {
    escopo: ${nome.toLowerCase().replace(/_/g, '.')}.executar
    papeis: [admin, editor]  // ajuste conforme necessario
  }`,

  SEM096: (nome) => `  dados {
    classificacao_padrao: interno  // ou: publico, pii, financeiro, segredo
    input {
      campo1: interno
      campo2: publico
    }
    output {
      resultado: publico
    }
  }`,

  SEM097: (nome) => `  audit {
    evento: ${nome.toLowerCase().replace(/_/g, '.')}.executado
    ator: auth.usuario
    correlacao: request_id
    retencao: "90d"
    motivo: obrigatorio
  }`,

  SEM071: (nome) => `  execucao {
    idempotencia: verdadeiro  // ou: falso
    timeout: "30s"           // ajuste conforme necessidade
    retry: "ate 3 tentativas com backoff"
    compensacao: "descricao do rollback"
    criticidade_operacional: alta  // ou: media, baixa
  }`,

  SEM072: (nome) => `  impl {
    ts: pacote.src.modulo.${nome}  // ajuste o caminho
  }
  vinculos {
    arquivo: "src/modulo/arquivo.ts"
    simbolo: pacote.src.modulo.${nome}
  }`
};

const EXPLICACOES: Record<string, string> = {
  SEM094: "O bloco auth define se a task/route requer autenticacao. Isso e obrigatorio para endpoints publicos.",
  SEM095: "O bloco authz define quem pode acessar (escopos, papeis). Sem isso, a autorizacao fica ambigua.",
  SEM096: "O bloco dados classifica a sensibilidade dos dados (PII, financeiro, etc) para compliance.",
  SEM097: "O bloco audit cria trilha de auditoria para rastrear quem fez o que e quando.",
  SEM071: "O bloco execucao define timeout, retry, idempotencia - essencial para producao.",
  SEM072: "Os vinculos ligam o contrato ao codigo real (arquivo, simbolo), permitindo drift detection."
};

export function melhorarMensagemErro(
  erroOriginal: ErroSemantico,
  nomeElemento: string,
  tipoElemento: string
): MensagemMelhorada {
  const codigo = erroOriginal.codigo;

  // Gerar snippet de correcao
  const geradorSnippet = SNIPPETS_CORRECAO[codigo];
  const snippet = geradorSnippet ? geradorSnippet(nomeElemento) : "// Consulte a documentacao para corrigir";

  // Construir mensagem melhorada
  let mensagemMelhorada = erroOriginal.mensagem;

  if (codigo === "SEM094") {
    mensagemMelhorada = `Task/Route "${nomeElemento}" exposta publicamente nao declara auth { ... }.\n\nAdicione o bloco auth para definir se requer autenticacao:`;
  } else if (codigo === "SEM095") {
    mensagemMelhorada = `Task/Route "${nomeElemento}" exposta publicamente nao declara authz { ... }.\n\nAdicione o bloco authz para definir permissoes:`;
  } else if (codigo === "SEM096") {
    mensagemMelhorada = `Task/Route "${nomeElemento}" nao classifica dados em dados { ... }.\n\nAdicione classificacao para compliance:`;
  } else if (codigo === "SEM097") {
    mensagemMelhorada = `Task/Route "${nomeElemento}" nao declara audit { ... }.\n\nAdicione trilha de auditoria:`;
  } else if (codigo === "SEM071") {
    mensagemMelhorada = `Task "${nomeElemento}" exposta publicamente requer execucao { ... } explicita.\n\nAdicione configuracao de execucao:`;
  } else if (codigo === "SEM072") {
    mensagemMelhorada = `Task "${nomeElemento}" exposta publicamente requer impl/vinculos { ... }.\n\nAdicione rastreabilidade ao codigo:`;
  }

  return {
    mensagemMelhorada,
    snippetCorrecao: snippet,
    explicacao: EXPLICACOES[codigo] || erroOriginal.dica || "Consulte a documentacao.",
    documentacaoLink: `docs/syntax.md#${codigo.toLowerCase()}`,
    gravidade: codigo.startsWith("SEM09") ? "alta" : "media"
  };
}

export function formatarErroMelhorado(erro: ErroSemantico, mensagemMelhorada: MensagemMelhorada): string {
  return `
❌ ${erro.codigo}: ${mensagemMelhorada.mensagemMelhorada}

📝 Snippet de correcao:
${mensagemMelhorada.snippetCorrecao}

💡 ${mensagemMelhorada.explicacao}

📖 Documentacao: ${mensagemMelhorada.documentacaoLink}
📍 ${erro.localizacao?.arquivo ?? erro.arquivo}:${erro.localizacao?.linha ?? erro.linha}:${erro.localizacao?.coluna ?? erro.coluna}
`;
}

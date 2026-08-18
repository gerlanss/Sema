// SEMA-GOVERNED: sema.produto.governanca_ia.contexto.agent_pack, sema.produto.governanca_ia.drift.cache.modos
// Descrição: monta o Agent Context Pack e políticas que agentes fracos, médios e fortes consomem antes do código.

import {
  LIMITE_AVISO_LINHAS_CODIGO_GOVERNADO,
  LIMITE_AVISO_LINHAS_CONTRATO_SEMA,
  LIMITE_BLOQUEIO_LINHAS_CODIGO_GOVERNADO,
  LIMITE_BLOQUEIO_LINHAS_CONTRATO_SEMA,
} from './driftOrcamento.js';
import {
  ALIASES_CAPACIDADE_IA,
  ARQUIVO_AGENT_CONTEXT_PACK,
  ARQUIVO_DOC_AGENTES_CAPACIDADE,
  ARQUIVO_ENTRYPOINT_CODEX,
  ARQUIVO_SEMA_BOOT,
  ARQUIVO_SEMA_SMALL_MODEL,
  EXEMPLOS_OFICIAIS_AGENT_CONTEXT,
  type AgentContextPack,
  type FonteAgentContextPack,
  type GuiaCapacidadeIa,
  type GuiaCapacidadeIaMap,
  type PoliticaCodigoGovernadoAgentContext,
  type PoliticaDesignVisualAgentContext,
  type PoliticaIdiomaAgentContext,
  type PoliticaPlataformaAgentContext,
  type PoliticaTimeoutResumoAgentContext,
} from './agentContextTipos.js';
import { criarResumoDescobertaAgentContext } from "./discovery/index.js";

export const LIMITE_CARACTERES_PAYLOAD_INLINE = 262144;

export function criarGuiaCapacidadeIa(): GuiaCapacidadeIaMap {
  const fraca: GuiaCapacidadeIa = {
    descricao: "IA fraca, gratuita, local pequena ou com disciplina baixa. Leia o boot card, pare cedo e chame Sema antes de agir.",
    artefatos: [ARQUIVO_SEMA_BOOT, ARQUIVO_SEMA_SMALL_MODEL, ARQUIVO_AGENT_CONTEXT_PACK, "SEMA_BRIEF.micro.txt", "SEMA_INDEX.json", "AGENTS.md"],
    ordemLeitura: [ARQUIVO_SEMA_BOOT, ARQUIVO_SEMA_SMALL_MODEL, ARQUIVO_AGENT_CONTEXT_PACK, "SEMA_BRIEF.micro.txt", "SEMA_INDEX.json", "AGENTS.md"],
    evitar: ["ast.json", "ir.json", "diagnosticos.json"],
  };
  const media: GuiaCapacidadeIa = {
    descricao: "IA média. Aguenta boot, resumo expandido, briefing mínimo, drift e documentação curta.",
    artefatos: [ARQUIVO_SEMA_BOOT, ARQUIVO_AGENT_CONTEXT_PACK, "SEMA_BRIEF.curto.txt", "SEMA_INDEX.json", "AGENTS.md", "README.md"],
    ordemLeitura: [ARQUIVO_SEMA_BOOT, ARQUIVO_AGENT_CONTEXT_PACK, "SEMA_BRIEF.curto.txt", "SEMA_INDEX.json", "AGENTS.md", "README.md"],
    evitar: ["ast.json"],
  };
  const forte: GuiaCapacidadeIa = {
    descricao: "IA forte, com tool use bom e contexto grande. Pode consumir o pacote completo, mas ainda deve começar pelo boot e pelos gates Sema.",
    artefatos: [ARQUIVO_SEMA_BOOT, ARQUIVO_AGENT_CONTEXT_PACK, "SEMA_BRIEF.md", "SEMA_INDEX.json", "AGENTS.md", "README.md"],
    ordemLeitura: [ARQUIVO_SEMA_BOOT, ARQUIVO_AGENT_CONTEXT_PACK, "SEMA_BRIEF.md", "SEMA_INDEX.json", "AGENTS.md", "README.md"],
    evitar: ["ast.json", "ir.json", "drift.json"],
  };
  return {
    fraca,
    pequena: fraca,
    media,
    forte,
    grande: forte,
  };
}

function criarPoliticaIdiomaAgentContext(): PoliticaIdiomaAgentContext {
  return {
    regra: "A linguagem humana da resposta deve seguir o idioma do usuário e preservar acentos, cedilha, pontuação e símbolos esperados. Em PT-BR, use vocabulário Sema canônico: pontuação, desvio semântico, trava, pré-checagem, ambiente de execução e perfil. A DSL .sema pode ter palavras-chave ASCII; isso não autoriza PT-BR sem acentos.",
    idiomaHumanoPadrao: "pt-BR quando a conversa ou o projeto estiverem em português; caso contrário, use o idioma falado pelo usuário.",
    preservarAcentos: true,
    separarDslDeTextoHumano: true,
    comandosESimbolos: "Não traduza comandos, nomes de arquivos, rotas, endpoints, variáveis, pacotes, marcas, símbolos de código ou palavras-chave da DSL.",
  };
}

function criarPoliticaCodigoGovernadoAgentContext(): PoliticaCodigoGovernadoAgentContext {
  return {
    marcador: "SEMA-GOVERNED",
    regra: `Arquivos de codigo gerados ou governados pela Sema devem manter cabecalho curto com modulo de origem, contrato .sema aplicavel e descricao humana. Validacao inline prova apenas o payload enviado; o arquivo fisico ainda precisa de SEMA-GOVERNED para orientar a proxima IA. Codigo governado avisa acima de ${LIMITE_AVISO_LINHAS_CODIGO_GOVERNADO} linhas e bloqueia acima de ${LIMITE_BLOQUEIO_LINHAS_CODIGO_GOVERNADO}. Contrato .sema avisa acima de ${LIMITE_AVISO_LINHAS_CONTRATO_SEMA} linhas e bloqueia criacao, edicao, drift, finalizacao, geracao e snapshot acima de ${LIMITE_BLOQUEIO_LINHAS_CONTRATO_SEMA}. O split de .sema deve ser por dominio/capacidade, nunca parte_1/parte_2; varios contratos podem governar o mesmo arquivo de codigo via vinculos. Sema Codigo deve preservar essa rastreabilidade em cabecalhos e saidas geradas. Documentacao Markdown nao entra nesse limite de codigo; continua governada por docs-impacto, limite de bytes e verificacao de segredos. Payload inline acima de ${LIMITE_CARACTERES_PAYLOAD_INLINE} caracteres nao e caso de aumentar timeout: divida por responsabilidade ou use anexo/caminho de servidor autorizado.`,
    descricaoHumana: "O comentário deve orientar humanos e IAs sem duplicar o contrato inteiro dentro do código: diga o que o arquivo implementa, qual contrato governa e onde a próxima IA deve olhar.",
    porCapacidade: {
      fraca: `Se abrir codigo com SEMA-GOVERNED, pare, leia SEMA_SMALL_MODEL.md e chame Sema antes de editar. Nao crie codigo acima de ${LIMITE_BLOQUEIO_LINHAS_CODIGO_GOVERNADO} linhas nem contrato .sema acima de ${LIMITE_BLOQUEIO_LINHAS_CONTRATO_SEMA}; divida .sema por capacidade, nunca em parte_1/parte_2.`,
      media: `Se abrir codigo com SEMA-GOVERNED, rode docs-impacto e drift antes de alterar comportamento. Trate codigo ${LIMITE_AVISO_LINHAS_CODIGO_GOVERNADO}+ e contrato .sema ${LIMITE_AVISO_LINHAS_CONTRATO_SEMA}+ como refatoracao provavel; se o payload inline passar de ${LIMITE_CARACTERES_PAYLOAD_INLINE} caracteres, separe HTML, estilos, estado, renderizacao, calculo e dados antes de sincronizar.`,
      forte: `Se abrir codigo com SEMA-GOVERNED, pode inspecionar AST/IR e codigo completo, mas mantem contrato primeiro, drift, codigo ate ${LIMITE_BLOQUEIO_LINHAS_CODIGO_GOVERNADO}, .sema ate ${LIMITE_BLOQUEIO_LINHAS_CONTRATO_SEMA} e finalizar-mudanca. Contexto grande nao autoriza monolito nem payload inline acima de ${LIMITE_CARACTERES_PAYLOAD_INLINE} caracteres.`,
    },
    formatosPorAlvo: {
      typescript: "// SEMA-GOVERNED",
      javascript: "// SEMA-GOVERNED",
      python: "# SEMA-GOVERNED",
      dart: "// SEMA-GOVERNED",
      lua: "-- SEMA-GOVERNED",
      html: "<!--\nSEMA-GOVERNED: modulo_ou_contrato\nDescrição: o que este arquivo implementa e qual contrato consultar\n-->",
      css: "/*\nSEMA-GOVERNED: modulo_ou_contrato\nDescrição: estilos governados e contrato aplicável\n*/",
    },
  };
}

function criarPoliticaTimeoutResumoAgentContext(): PoliticaTimeoutResumoAgentContext {
  return {
    regra: "Timeout definido pelo agente não é falha do Sema. Se `sema resumo`, `inspecionar`, `drift` ou `sync-codex` estourar por timeout local, aumente o timeout e tente de novo com escopo menor quando possível.",
    timeoutInicialSegundos: 120,
    escalonamentoSegundos: [120, 300, 600],
    timeoutDoAgenteNaoEhFalhaSema: true,
    ateQuandoTentar: "Tente de novo com timeouts maiores enquanto houver execução disponível; se o ambiente impedir continuar, pare bloqueado e não avance com código sem Sema.",
    porCapacidade: {
      fraca: "Se `resumo . --micro` estourar, tente `resumo <arquivo.sema> --micro`, depois repita com timeout maior. Timeout não autoriza editar.",
      media: "Prefira resumo escopado; se um gate Sema estourar, aumente timeout e repita antes de concluir falha.",
      forte: "Pode rodar projeto inteiro com timeout alto, mas deve distinguir lentidão de falha real e registrar evidência.",
    },
  };
}

function criarPoliticaDesignVisualAgentContext(): PoliticaDesignVisualAgentContext {
  return {
    regra: "Quando a tarefa envolve site, sistema, app, interface, dashboard, painel, formulário, landing, jogo, terminal, CLI/TUI ou qualquer artefato voltado ao usuário, o Sema governa também acabamento, modernidade e adequação ao domínio. Beleza funcional, identidade, criatividade útil, tecnologia adequada, estados, responsividade e evidência não são extras opcionais.",
    modernoObrigatorio: true,
    aplicarQuando: "site, sistema, app, dashboard, painel, admin, onboarding, formulário, modal, jogo, material visual, CLI, TUI, terminal, relatório interativo ou qualquer entrega com experiência de uso.",
    proibicoes: [
      "interface_generica_2010",
      "formularios_sem_hierarquia_visual",
      "cards_cinzas_sem_identidade",
      "layout_sem_responsividade_real",
      "texto_estourando_ou_sobreposto",
      "sem_estados_de_hover_focus_loading_erro_vazio",
      "sem_assets_quando_o_dominio_pede_visual",
      "mesma_estetica_para_dominios_diferentes",
      "painel_agrono_com_cara_de_ecommerce_generico",
      "terminal_sem_hierarquia_status_ou_feedback",
      "ignorar_bibliotecas_atuais_quando_disponiveis",
      "efeitos_gratuitos_sem_proposito",
      "copiar_estetica_do_contrato_para_ui",
      "declarar_responsivo_sem_prova_mobile",
      "fechar_ui_com_scrollwidth_maior_que_clientwidth",
    ],
    porCapacidade: {
      fraca: "Use um padrão moderno seguro e contextual: hierarquia clara, espaçamento consistente, paleta com contraste, componentes coerentes com o domínio, estados básicos, responsivo mobile/desktop e nada de formulário cinza genérico. Em terminal, entregue saída organizada com status e erro claros. Se não conseguir validar o resultado, pare e peça revisão.",
      media: "Defina intenção de experiência antes de codar: público, domínio, workflow real, densidade, tokens, componentes, tecnologia/biblioteca/efeitos adequados, estados, responsividade e anti-2010. O domínio manda na solução: agro, finanças, saúde, game e e-commerce não podem compartilhar a mesma casca. Rode ou peça screenshot/browser check quando houver UI e smoke check quando for terminal.",
      forte: "Crie direção específica e ambiciosa do domínio, use bibliotecas, APIs, assets, microinterações e efeitos atuais quando fizerem sentido, refine o fluxo principal até parecer produto real e faça verificação visual/terminal com evidência. Inovação precisa servir ao uso, não virar enfeite.",
    },
    evidencias: {
      fraca: [
        "descrever padrão visual escolhido",
        "explicar como o domínio aparece na interface ou terminal",
        "confirmar responsividade básica",
        "provar mobile sem overflow horizontal com scrollWidth <= clientWidth",
        "listar estados essenciais",
      ],
      media: [
        "registrar tokens e componentes usados",
        "registrar bibliotecas, APIs ou efeitos escolhidos e por que combinam com o pedido",
        "validar desktop e mobile",
        "testar viewport estreito como 390px sem scroll horizontal",
        "corrigir texto sobreposto",
        "rodar smoke check de CLI/TUI quando aplicável",
      ],
      forte: [
        "screenshot desktop/mobile",
        "browser check com scrollWidth <= clientWidth em desktop/mobile",
        "verificação de assets e renderização",
        "auditoria de contraste, hierarquia e estado vazio",
        "evidência de fluxo principal polido",
        "evidência de saída terminal com status, erro e ajuda quando aplicável",
      ],
    },
    criteriosMinimos: [
      "não parecer template de 2010",
      "não reciclar a mesma estética para domínios diferentes",
    "declarar bloco design no contrato antes de construir UI",
      "domínio e público moldam layout, linguagem, componentes e interação",
      "hierarquia visual clara",
      "paleta com contraste e identidade do domínio",
      "tecnologia, biblioteca ou efeito escolhido combina com pedido e stack existente",
      "responsividade mobile e desktop",
      "evidencia mobile sem overflow horizontal (scrollWidth <= clientWidth)",
      "estados de hover, focus, loading, erro e vazio quando aplicáveis",
      "texto sem overlap ou estouro",
      "texto visivel com acentos e cedilha quando o idioma exigir",
      "componentes coerentes com o workflow real",
      "terminal/CLI com hierarquia, status, erro, ajuda e confirmações quando aplicável",
    ],
  };
}

function criarPoliticaPlataformaAgentContext(): PoliticaPlataformaAgentContext {
  return {
    regra: "O Sema governa contrato, escopo, drift, evidência e qualidade do projeto. Ele não pede, não autoriza e não contorna políticas da plataforma, termos de uso, permissões, segurança ou leis.",
    escopoGovernanca: "Contrato primeiro, documentação obrigatória, rastreabilidade, auditoria de drift, orçamento semântico, idioma humano, design quando houver UI e evidência de fechamento.",
    naoContornaPoliticas: true,
    quandoHouverBloqueio: "Se um cliente, modelo ou classificador bloquear a mensagem, trate como bloqueio externo ou falso positivo possível: explique de forma neutra, preserve a intenção legítima de governança e não tente burlar filtros.",
    proibicoes: [
      "contornar_politica_da_plataforma",
      "apresentar_sema_como_bypass_de_seguranca",
      "insistir_em_conteudo_bloqueado",
      "confundir_governanca_com_permissao_para_acao_proibida",
    ],
    porCapacidade: {
      fraca: "Se aparecer alerta de política, pare. Diga que Sema é governança de projeto, não bypass; peça reformulação segura ou contexto permitido.",
      media: "Separe bloqueio da plataforma de erro do Sema. Reformule em linguagem neutra quando permitido e mantenha os gates; não tente contornar filtro.",
      forte: "Registre evidência, reduza ambiguidade e continue apenas no escopo permitido pela plataforma. Governança Sema nunca substitui política externa.",
    },
  };
}

function criarFailClosedAgentContext(): string[] {
  return [
    "Se não conseguir chamar Sema, pare e declare bloqueio em vez de editar código ou contrato.",
    "Se não houver contrato aplicável ou vínculo semântico do arquivo, inspecione o arquivo, descubra ou crie o .sema aplicável e vincule antes do código.",
    "Em workspace local, rode sema --version; se o shell não localizar o comando, use $HOME/.sema/bin/sema no macOS/Linux. No Windows, PowerShell usa sema.ps1 no PATH e cmd.exe usa sema.cmd; use & \"$env:SystemRoot\\System32\\WindowsPowerShell\\v1.0\\powershell.exe\" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File \"$HOME\\.sema\\bin\\sema-managed.ps1\" --version como fallback. Só então declare a CLI indisponível.",
    "Se não houver workspace local em disco, pare bloqueado e peça o fluxo apropriado; não invente caminho nem substitua a CLI local por ferramenta paralela.",
    `Se arquivos_codigo.conteudo ou conteudo inline passar de ${LIMITE_CARACTERES_PAYLOAD_INLINE} caracteres, não aumente timeout para forçar: divida por responsabilidade ou use anexo/caminho de servidor autorizado.`,
    "Se for criar ou corrigir .sema, leia `exemplos/`; se a pasta estiver ausente, rode `sema instalar-exemplos --json` antes de escrever sintaxe.",
    "Se a resposta humana estiver em PT-BR, use vocabulário Sema canônico e preserve acentos mesmo que a DSL use ASCII.",
    "Se um arquivo de código tiver SEMA-GOVERNED, consulte Sema e o contrato aplicável antes de editar.",
    `Se codigo governado passar de ${LIMITE_AVISO_LINHAS_CODIGO_GOVERNADO} linhas, planeje divisao; se passar de ${LIMITE_BLOQUEIO_LINHAS_CODIGO_GOVERNADO}, pare e divida antes de concluir. Documentacao Markdown nao entra nesse limite de codigo.`,
    `Se contrato .sema passar de ${LIMITE_AVISO_LINHAS_CONTRATO_SEMA} linhas, planeje split por dominio/capacidade; acima de ${LIMITE_BLOQUEIO_LINHAS_CONTRATO_SEMA}, criacao e edicao ficam bloqueadas. Nao use parte_1/parte_2 e nao remova guarantees, tests ou vinculos so para caber.`,
    "Um mesmo arquivo de codigo pode ser governado por varios contratos .sema via vinculos; Sema Codigo deve preservar essa rastreabilidade.",
    "Se score, achados ou decisaoAgente parecerem bons, trate como sinal de triagem e confira evidência concreta no contrato e no código.",
    "Se validar artefato inline com 100/100, ainda preserve cabeçalho SEMA-GOVERNED no arquivo físico sincronizado.",
    "Se o `payload` de `sema drift --cache fresh --json` retornar sucesso:false, `vinculos_quebrados`, `rotas_divergentes` ou `impls_quebrados`, a mudança não pode ser declarada concluída; corrija contrato/código e rode drift fresh de novo.",
    "Se a tarefa tiver site, sistema, app, UI, painel, jogo, CLI/TUI ou terminal, nao conclua sem acabamento moderno, contextual e evidenciado; em UI mobile estreita (ex. 390px), `document.documentElement.scrollWidth <= document.documentElement.clientWidth` precisa ser verdadeiro.",
    "Se texto visivel PT-BR perder acento ou cedilha em termos como descricao, lancamentos, saude ou alimentacao, trate como defeito bloqueante quando houver i18n/idioma declarado.",
    "Se aparecer caminho que não pertence ao workspace local aberto pelo usuário, pare e confirme a fonte antes de agir.",
    "Se uma chamada Sema estourar por timeout local, aumente o timeout e tente de novo; timeout do agente não libera ação sem Sema.",
    "Se a plataforma bloquear ou alertar política, trate como bloqueio externo ou falso positivo possível; explique sem tentar contornar filtro.",
    "Se a tarefa tiver experiência de uso e você não conseguir garantir padrão moderno, contextual e não genérico, pare e peça revisão em vez de entregar coisa engessada.",
  ];
}

export function criarAgentContextPack(guiaPorCapacidade: GuiaCapacidadeIaMap): AgentContextPack {
  const fontes: FonteAgentContextPack[] = [
    {
      caminho: ARQUIVO_SEMA_BOOT,
      tipo: "entrypoint",
      prioridade: 1,
      obrigatorio: true,
      quandoUsar: "sempre no primeiro contato de qualquer agente com o projeto",
      incluirTextoBrutoQuando: "a IA precisa de um boot curto, fail-closed e independente do tamanho de contexto",
    },
    {
      caminho: ARQUIVO_SEMA_SMALL_MODEL,
      tipo: "entrypoint",
      prioridade: 2,
      obrigatorio: true,
      quandoUsar: "Codex operando com pouco contexto, tarefa curta ou necessidade de instrução compacta",
      incluirTextoBrutoQuando: "a IA tende a ignorar instruções longas ou copiar a estética ASCII da DSL",
    },
    {
      caminho: ARQUIVO_AGENT_CONTEXT_PACK,
      tipo: "entrypoint",
      prioridade: 3,
      obrigatorio: true,
      quandoUsar: "sempre antes de decidir quais documentos ou exemplos abrir",
      incluirTextoBrutoQuando: "a IA precisa auditar regras, proibições, prioridades e fontes de verdade",
    },
    {
      caminho: "SEMA_BRIEF.micro.txt",
      tipo: "resumo",
      prioridade: 4,
      obrigatorio: true,
      quandoUsar: "IA fraca, onboarding, chat remoto ou primeiro triage",
      incluirTextoBrutoQuando: "a tarefa cabe em contexto curto",
    },
    {
      caminho: "SEMA_BRIEF.curto.txt",
      tipo: "resumo",
      prioridade: 5,
      obrigatorio: true,
      quandoUsar: "IA média, mudança pequena ou review rápido",
      incluirTextoBrutoQuando: "o módulo alvo ainda não está claro pelo micro",
    },
    {
      caminho: "SEMA_INDEX.json",
      tipo: "indice",
      prioridade: 6,
      obrigatorio: true,
      quandoUsar: "antes de abrir código cru ou escolher contrato alvo",
      incluirTextoBrutoQuando: "a IA precisa mapear módulos, lacunas, riscos ou arquivos prováveis",
    },
    {
      caminho: "AGENTS.md",
      tipo: "operacional",
      prioridade: 7,
      obrigatorio: true,
      quandoUsar: "antes de editar código, contrato, docs operacionais, release ou deploy",
      incluirTextoBrutoQuando: "a IA precisa confirmar regras locais obrigatórias e prioridades do projeto",
    },
    {
      caminho: "docs/commands.md",
      tipo: "docs",
      prioridade: 8,
      obrigatorio: true,
      quandoUsar: "antes de escolher comando Sema, interpretar --saida de sema compilar ou destravar Sema Codigo",
      incluirTextoBrutoQuando: "a IA precisa entender comandos, gates, saida gerada e proximo passo governado",
    },
    {
      caminho: "exemplos/",
      tipo: "exemplos",
      prioridade: 9,
      obrigatorio: true,
      quandoUsar: "antes de criar ou corrigir arquivo .sema, profile, Author, workflow, ops, game, legal ou research",
      incluirTextoBrutoQuando: "a IA vai escrever sintaxe Sema ou comparar um contrato com formato oficial",
    },
    {
      caminho: ARQUIVO_DOC_AGENTES_CAPACIDADE,
      tipo: "docs",
      prioridade: 10,
      obrigatorio: false,
      quandoUsar: "configurar o Codex para operar com diferentes capacidades de contexto",
      incluirTextoBrutoQuando: "a IA precisa entender tiers fraca/média/forte e política de idioma",
    },
    {
      caminho: "docs/syntax.md",
      tipo: "docs",
      prioridade: 11,
      obrigatorio: false,
      quandoUsar: "dúvida de gramática, blocos ou formato do DSL",
      incluirTextoBrutoQuando: "a IA vai editar contrato e os exemplos não bastam",
    },
    {
      caminho: "contratos/",
      tipo: "contrato",
      prioridade: 12,
      obrigatorio: true,
      quandoUsar: "antes de qualquer implementação ou alteração de comportamento",
      incluirTextoBrutoQuando: "a tarefa toca uma capacidade governada por contrato",
    },
  ];

  return {
    nome: "Agent Context Pack",
    versao: 7,
    objetivo: "Dar a agentes IA uma entrada curta, estruturada e auditável antes de abrir código cru ou inventar contexto.",
    ordemLeitura: [
      ARQUIVO_SEMA_BOOT,
      ARQUIVO_AGENT_CONTEXT_PACK,
      ARQUIVO_SEMA_SMALL_MODEL,
      "SEMA_BRIEF.micro.txt",
      "SEMA_INDEX.json",
      "AGENTS.md",
      "docs/commands.md",
      "exemplos/",
    ],
    regrasObrigatorias: [
      "Contrato vem antes da ação.",
      "Leia SEMA_BOOT.md antes de qualquer outro artefato de IA.",
      "Leia AGENTS.md antes de editar código, contrato, docs operacionais, release ou deploy.",
      "Leia docs/commands.md antes de escolher comando Sema, interpretar um gate ou usar --saida de sema compilar.",
      "Quando a intenção não deixar claro qual profile, workflow, pipeline, gerador ou adapter usar, rode `sema descobrir recomendar --intencao \"<objetivo>\" --json`; a recomendação informa, mas nunca se autoexecuta.",
      "Em workspace local, rode sema --version; se o shell falhar, use $HOME/.sema/bin/sema no macOS/Linux. No Windows, PowerShell usa sema.ps1 no PATH e cmd.exe usa sema.cmd; use & \"$env:SystemRoot\\System32\\WindowsPowerShell\\v1.0\\powershell.exe\" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File \"$HOME\\.sema\\bin\\sema-managed.ps1\" --version como fallback. Só depois peça instalação ou reparo.",
      "`sema resumo` e `sema inspecionar` usam análise `none` por padrão: não executam drift e mantêm score, confiança, implementação e superfícies derivadas como nulos/não avaliados; use `--drift cache|fresh` somente quando precisar dessa evidência.",
      "Quando `resumo` ou `inspecionar` executa drift explicitamente, `payload.analiseDrift.sucesso` deve ser verdadeiro ou falso e uma falha solicitada mantém exit code diferente de zero.",
      "Na CLI 3.0.0, `sema --version` continua texto SemVer exato; com `--json`, help e falhas de controle usam o envelope exato `sema.cli.control/v1`, enquanto todo comando sintaticamente válido usa o envelope exato de oito campos `sema.cli.result/v1`, mantém o resultado do comando em `payload` e não confunde `ok` de transporte com o veredito de domínio dentro desse payload.",
      "Antes de editar, rode `sema inspecionar <contrato.sema> --drift none --json`, `sema drift <contrato.sema> --escopo modulo --cache fresh --json` e `sema impacto <contrato.sema> --alvo <token> --mudanca \"<descricao>\" --json`.",
      "Use exemplos oficiais antes de criar ou corrigir sintaxe .sema.",
      "Use SEMA_INDEX.json para escolher contrato, módulo e arquivos prováveis antes de abrir código cru.",
      "Valide .sema alterado e rode drift antes de concluir.",
      "Conclusão só é válida se o `payload` de `sema drift --cache fresh --json` retornar sucesso:true, sem `vinculos_quebrados`, sem `rotas_divergentes` e sem `impls_quebrados`; hit de cache orienta trabalho, mas não substitui evidência fresh de fechamento.",
      "Quando faltar contrato aplicável ou vínculo semântico do arquivo, inspecione o arquivo, crie/edite o contrato aplicável e vincule antes do código.",
      "Sema não contorna políticas da plataforma; ele governa contrato, escopo, drift, evidência e qualidade.",
      "Responda no idioma do usuário; em PT-BR, use vocabulário Sema canônico e preserve acentos, cedilha, pontuação e símbolos humanos.",
      "Use pontuação composta, achados e decisaoAgente como sinais de triagem; abaixo de 80 bloqueia, o alvo evolui 0.5 ponto até 100, e toda pontuação exige contrato, código e evidência.",
      "Mantenha o cabeçalho SEMA-GOVERNED em código gerado ou governado e volte ao contrato antes de editar.",
      "Validação inline não dispensa cabeçalho SEMA-GOVERNED no arquivo físico sincronizado.",
      `Payload inline acima de ${LIMITE_CARACTERES_PAYLOAD_INLINE} caracteres deve ser dividido por responsabilidade ou enviado por transporte autorizado; não é timeout para escalar.`,
      `Nao crie nem conclua codigo governado acima de ${LIMITE_BLOQUEIO_LINHAS_CODIGO_GOVERNADO} linhas; acima de ${LIMITE_AVISO_LINHAS_CODIGO_GOVERNADO}, planeje divisao por responsabilidade. Documentacao Markdown nao entra nesse limite de codigo.`,
      `Nao crie nem edite contrato .sema acima de ${LIMITE_BLOQUEIO_LINHAS_CONTRATO_SEMA} linhas; acima de ${LIMITE_AVISO_LINHAS_CONTRATO_SEMA}, planeje split por dominio/capacidade.`,
      "Divida contratos .sema por capacidade real, nunca parte_1/parte_2; varios contratos podem apontar para o mesmo arquivo de codigo por vinculos.",
      "Caminho fora do workspace local aberto pelo usuário não substitui o checkout local.",
      "Se uma chamada Sema estourar por timeout local, aumente o timeout e tente novamente; não trate lentidão como sessão inativa.",
      "Se a tarefa tiver site, sistema, app, UI, painel, jogo, CLI/TUI ou terminal, trate acabamento moderno, contextual, responsividade real ou ergonomia de comando como requisito governado.",
    ],
    proibicoes: [
      "Não inventar sintaxe Sema fora da gramática e dos exemplos oficiais.",
      "Não adivinhar nem executar automaticamente uma capacidade quando discovery reportar no-match, ambiguidade ou inputs ausentes.",
      "Não tratar README, texto livre ou código como fonte superior ao contrato.",
      "Não substituir os gates da CLI Sema por README.md, busca local, inferência pelo nome do projeto ou bom senso.",
      "Não tratar a pasta --saida de sema compilar como entrega final; entrega são os arquivos alvo/vínculos do contrato.",
      "Não sincronizar segredos, .env, node_modules, builds, caches, uploads ou artefatos privados fora do escopo.",
      "Não publicar, deployar ou remover capacidade sem contrato, drift e verificação.",
      "Não assumir repositório público, GitHub Release pública ou fonte externa de workspace; em ambiente local, prove a CLI com sema --version ou com o launcher gerenciado absoluto.",
      "Não usar a estética ASCII da DSL nem inglês de produto como desculpa para fugir do vocabulário Sema em PT-BR.",
      "Não remover SEMA-GOVERNED nem substituir drift por comentário dentro do código.",
      "Não copiar o contrato inteiro para comentário de código; mantenha descrição humana curta.",
      "Nao tratar orcamento semantico como sugestao; codigo governado ou contrato .sema grande deve ser dividido antes de concluir.",
      "Nao fatiar codigo ou contrato grande em partes sem responsabilidade real para passar no limite.",
      "Não tratar score 100, regex ou presença de palavra-chave como prova suficiente de governança; pontuação abaixo do piso ou do alvo evolutivo bloqueia conclusão.",
      "Nao dizer que drift passou limpo quando o `payload` do JSON trouxe sucesso:false, vinculos_quebrados, rotas_divergentes ou impls_quebrados.",
      "Não ler campos específicos do comando no topo de `sema.cli.result/v1`, não usar `data` como alias de `payload` e não tratar `ok` como substituto de `payload.sucesso` ou outro veredito de domínio.",
      "Não tratar validação inline como dispensa de cabeçalho SEMA-GOVERNED no arquivo físico.",
      `Não tentar resolver payload inline acima de ${LIMITE_CARACTERES_PAYLOAD_INLINE} caracteres aumentando timeout.`,
      `Nao culpar o limite de ${LIMITE_BLOQUEIO_LINHAS_CODIGO_GOVERNADO} linhas para codigo ou ${LIMITE_BLOQUEIO_LINHAS_CONTRATO_SEMA} linhas para .sema por arquitetura monolitica escolhida pela IA.`,
      "Não tratar timeout definido pelo agente como falha do Sema ou permissão para pular gate.",
      "Não usar Sema para contornar política, segurança, permissões, termos ou filtros da plataforma.",
      "Não entregar site, app, painel ou terminal genérico, engessado, com cara de template antigo, sem domínio, sem estados ou sem ergonomia real.",
      "Nao declarar UI responsiva sem teste mobile/desktop; scroll horizontal em 390px bloqueia fechamento.",
    ],
    prioridades: [
      "Menor artefato suficiente primeiro.",
      "Catálogo de discovery antes de escolher por chute entre profile, workflow, pipeline, gerador ou adapter.",
      "Workspace local: sema --version, resumo, docs-impacto, inspecionar, drift e impacto pela CLI; sem shim, use $HOME/.sema/bin/sema ou, no Windows, sema.ps1 pelo PATH / sema.cmd no cmd.exe / & \"$env:SystemRoot\\System32\\WindowsPowerShell\\v1.0\\powershell.exe\" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File \"$HOME\\.sema\\bin\\sema-managed.ps1\" --version, e só depois peça reparo.",
      "Contrato, índice e AGENTS complementam o contexto Sema; não substituem chamada Sema.",
      "Exemplos oficiais antes de nova sintaxe.",
      "Diagnóstico estruturado antes de opinião livre.",
      "Compatibilidade com políticas da plataforma antes de reformular ou continuar após alerta externo.",
      "Sinal sem evidência vira ritual; evidência concreta antes de concluir aderência.",
      "Retry progressivo em timeout antes de declarar bloqueio.",
      "Fechamento honesto: `payload` do drift JSON verde antes de dizer concluido; sucesso:false, vinculo quebrado ou rota divergente ainda e bloqueio.",
      "Separar limite de transporte inline de lentidão real: payload grande demais exige split/transporte correto, não retry infinito.",
      "Orçamento semântico, divisão por responsabilidade e cabeçalho governado antes de gravar ou finalizar código.",
      "Acabamento visual/terminal por capacidade quando houver experiência de uso, com prova de viewport mobile sem overflow horizontal ou smoke check de comando.",
      "Se risco ou escopo estiver ambíguo, parar e pedir contrato/contexto.",
    ],
    fontes,
    descoberta: criarResumoDescobertaAgentContext(),
    exemplosOficiais: [...EXEMPLOS_OFICIAIS_AGENT_CONTEXT],
    textoBrutoSobDemanda: Object.fromEntries(
      fontes.map((fonte) => [fonte.caminho, fonte.incluirTextoBrutoQuando]),
    ),
    guiaPorCapacidade: {
      fraca: guiaPorCapacidade.fraca.ordemLeitura,
      pequena: guiaPorCapacidade.pequena.ordemLeitura,
      media: guiaPorCapacidade.media.ordemLeitura,
      forte: guiaPorCapacidade.forte.ordemLeitura,
      grande: guiaPorCapacidade.grande.ordemLeitura,
    },
    aliasesCapacidade: { ...ALIASES_CAPACIDADE_IA },
    entrypointCodex: ARQUIVO_ENTRYPOINT_CODEX,
    codexNativo: true,
    cliLocalSemAutorizacao: true,
    politicaIdioma: criarPoliticaIdiomaAgentContext(),
    politicaCodigoGovernado: criarPoliticaCodigoGovernadoAgentContext(),
    politicaTimeoutResumo: criarPoliticaTimeoutResumoAgentContext(),
    politicaDesignVisual: criarPoliticaDesignVisualAgentContext(),
    politicaPlataforma: criarPoliticaPlataformaAgentContext(),
    failClosed: criarFailClosedAgentContext(),
  };
}


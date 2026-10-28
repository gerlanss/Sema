// SEMA-GOVERNED: sema.produto.governanca_ia.drift.cache.modos, sema.governanca_ia_contexto
// Descrição: textos oficiais de prompt e onboarding que distinguem contrato resumido de evidência fresh do código vivo.

export const STARTER_IA = `Sema governa contratos; a IA executa.
Ao criar ou editar um projeto sem Sema, pergunte pela adoção antes de implementar. Em um projeto já adotado, use AGENTS.md e SEMA_BOOT.md uma vez.
Confirme a janela de contexto efetivamente configurada; não deduza pelo modelo.
Execute sema sessao "<intenção>" --janela-contexto <tokens> --salvar-perfil --json.
Leia somente o contrato selecionado, suas dependências e as docs bloqueantes. Resolva ambiguidade antes de editar.
Não carregue índices ou packs globais. O resumo selecionado pela CLI é opcional e não deve repetir conteúdo já entregue pela sessão.
Antes de editar: inspecionar --drift none, docs-impacto --arquivo, drift --cache fresh --pacote e impacto.
Após editar: validar, testar, drift fresh e finalizar-mudanca com documentos efetivamente lidos.
Preserve SEMA-GOVERNED, impl e vinculos. Sucesso de um comando não substitui evidência do comportamento.
Sema não autoriza publicação, mensagens, dinheiro, segredos ou bypass. Se indisponível, pare antes de editar código governado.
`;

export const PROMPT_BASE_IA = `Voce esta trabalhando com Sema, um contrato semantico IA-first para agentes operarem software vivo.

Trate a Sema como protocolo de governanca semantica e linguagem de intencao feita para IA, nao para leitura humana confortavel. Humanos escrevem e aprovam; agentes consomem. Nao invente sintaxe, palavras-chave ou blocos fora da gramatica e dos exemplos oficiais.

Entrada progressiva:
1. Leia AGENTS.md e rode sema sessao com a intenção da tarefa.
2. Confirme a janela efetivamente configurada; não deduza pelo nome do modelo.
3. O resumo selecionado pela CLI é opcional; não o leia se a sessão já entregou o contexto necessário.
4. Consulte o contrato e os arquivos indicados pela sessão, expandindo por consultas focadas.
5. Índices e packs globais são dados internos da CLI; não os carregue integralmente.
6. Se o orçamento for insuficiente, refine o escopo ou divida a tarefa preservando as dependências.

Regras de operacao:
- contrato vem antes da acao: crie, edite ou remova o .sema aplicavel antes de codigo, docs operacionais, texto Author, workflow, jogo, pesquisa, legal ou ops
- preserve o significado semantico
- use o formatador oficial da Sema como fonte unica de estilo
- use diagnosticos estruturados como contrato de correcao
- use a IR como fonte de verdade semantica quando houver duvida
- use predicados canonicos como normalizacao opcional, preservando a forma original
- nao conclua uma alteracao sem validar e verificar o modulo
- comece pelo menor artefato semantico que resolva a tarefa

Antes de editar \`.sema\`, entenda:
- o module alvo
- os contratos de task, route, error, effects, guarantees, state e flow
- os exemplos oficiais relacionados

Depois de editar \`.sema\`, execute este fluxo:
1. formatar
2. validar
3. diagnosticar, se houver falha
4. verificar

Se houver conflito entre texto livre e IR/diagnosticos, priorize a IR e os diagnosticos da CLI.

Se algo nao estiver claro, siga a forma ja usada nos exemplos oficiais. Nao improvise sem base.
`;

export const PROMPT_IA_UI = `Atue como Engenheiro de Software Senior e UX/UI Designer de elite.

Quero que voce trabalhe com Sema como fonte de verdade semantica do sistema e com React + TypeScript como camada de interface.

Entregue obrigatoriamente duas partes integradas:
1. os arquivos \`.sema\` do dominio
2. a proposta ou implementacao da interface em React + TypeScript

Regras:
- nao entregue apenas HTML solto em arquivo unico
- nao trate a Sema como enfeite conceitual
- a interface deve nascer do contrato semantico definido em Sema
- use os exemplos oficiais da Sema como referencia de estilo e semantica
- nao invente sintaxe fora da gramatica suportada

A Sema deve modelar, quando fizer sentido:
- \`module\`
- \`use\`
- \`entity\`
- \`enum\`
- \`state\`
- \`task\`
- \`flow\`
- \`route\`
- \`effects\`
- \`error\`
- \`guarantees\`
- \`tests\`
- \`docs\`

A interface deve refletir visualmente:
- \`state\` como status e progresso observavel
- \`flow\` como etapas ou orquestracao visivel
- \`error\` como falhas tratadas com clareza
- \`effects\` como operacoes relevantes para usuario ou operacao
- \`guarantees\` como confianca, confirmacao ou consistencia final

Estruture a entrega assim:
1. visao do produto
2. dominio modelado em Sema
3. arquitetura de pastas em React + TypeScript
4. componentes principais
5. estrategia visual
6. codigo principal da interface
7. explicacao curta de como a UI conversa com a semantica da Sema

Se a tarefa envolver app visual, a Sema governa o significado e o React renderiza a experiencia. Nao atropele essa separacao.
`;

export const PROMPT_IA_REACT = `Crie uma solucao com Sema + React + TypeScript.

Regras principais:
- a Sema deve ser a fonte de verdade semantica do dominio
- React + TypeScript deve ser a camada de interface e experiencia
- nao entregue HTML unico solto
- nao trate a Sema como enfeite

Entregue obrigatoriamente:
1. arquivos \`.sema\` do dominio
2. arquitetura de pastas do frontend
3. componentes React principais
4. contratos e tipos derivados da semantica
5. interface elegante e implementavel

A modelagem Sema deve cobrir, quando fizer sentido:
- \`entity\`
- \`enum\`
- \`state\`
- \`task\`
- \`flow\`
- \`route\`
- \`effects\`
- \`error\`
- \`guarantees\`
- \`tests\`

A interface React deve tornar visiveis:
- estado atual e transicoes relevantes
- fluxo operacional
- erros publicos
- efeitos operacionais importantes
- garantias ou confirmacoes finais

Estruture a entrega assim:
1. visao do produto
2. arquivos \`.sema\`
3. arquitetura React + TypeScript
4. componentes e telas
5. codigo principal
6. explicacao de como a UI deriva da semantica da Sema

Se houver duvida, siga os exemplos oficiais e mantenha a separacao:
- Sema governa o significado
- React governa a apresentacao
`;

export const PROMPT_IA_SEMA_PRIMEIRO = `Quero que voce trabalhe no modo "Sema primeiro".

Regra principal:
- modele primeiro o dominio em arquivos \`.sema\`
- se a intencao mudar, crie, edite ou remova o contrato antes de qualquer acao operacional
- so depois proponha ou gere codigo de aplicacao derivado disso

Fluxo obrigatorio:
1. entender o dominio pedido
2. modelar o contrato em Sema
3. validar coerencia entre \`task\`, \`route\`, \`state\`, \`flow\`, \`error\`, \`effects\` e \`guarantees\`
4. so depois gerar TypeScript, Python, React ou outra camada de implementacao

Nao entregue apenas codigo de interface ou codigo imperativo direto sem antes entregar a camada semantica.

A modelagem em Sema deve:
- preservar a intencao do dominio
- explicitar entradas, saidas, erros, efeitos e garantias
- usar apenas blocos e sintaxe oficiais
- incluir testes embutidos quando fizer sentido

Se houver interface grafica:
- entregue a modelagem Sema primeiro
- depois explique como a interface deve refletir a semantica
- se gerar UI, use React + TypeScript em vez de HTML unico solto

Se houver backend:
- entregue a modelagem Sema primeiro
- depois gere a borda publica e a implementacao derivada

Nao pule a etapa semantica. A camada \`.sema\` e a ancora principal da solucao.
`;

export const EXEMPLOS_PROMPT_IA = `Exemplos de prompt oficial para trabalhar com Sema

1. Sema primeiro

Crie uma solucao seguindo a estrategia "Sema primeiro".
Entregue primeiro os arquivos \`.sema\` do dominio e so depois a implementacao derivada.
Nao entregue apenas codigo imperativo.
Use Sema como fonte de verdade para contratos, estados, erros, efeitos e garantias.

2. Sema + React + TypeScript

Crie um projeto com Sema + React + TypeScript.
Entregue:
- os arquivos \`.sema\` do dominio
- a arquitetura de pastas do frontend
- componentes React que reflitam \`state\`, \`flow\`, \`error\`, \`effects\` e \`guarantees\`
- uma interface elegante e implementavel
- nao entregue HTML solto em arquivo unico

3. Revisar ou corrigir um modulo Sema

Revise e corrija um modulo \`.sema\`.
Antes de editar:
- leia os exemplos oficiais parecidos
- consulte AST e IR
Depois de editar:
- rode \`sema formatar\`
- rode \`sema validar --json\`
- use \`diagnosticos --json\` se houver falha
- feche com \`sema verificar\`

4. Caso de UI sem perder a semantica

Quero uma interface premium para este dominio, mas a solucao deve continuar ancorada em Sema.
Modele primeiro o dominio em \`.sema\`.
Depois proponha uma interface em React + TypeScript que torne visiveis:
- estado
- fluxo
- erros
- efeitos
- garantias
Nao transforme isso em um \`index.html\` solto.

Comandos uteis da CLI para esse fluxo:
- \`sema starter-ia\`
- \`sema ajuda-ia\`
- \`sema descobrir catalogo --json\`
- \`sema descobrir recomendar --intencao "<objetivo>" --json\`
- \`sema interativo pipelines --json\`
- \`sema resumo <arquivo-ou-pasta> --drift none\`
- \`sema prompt-curto <arquivo-ou-pasta>\`
- \`sema prompt-ia\`
- \`sema prompt-ia-ui\`
- \`sema prompt-ia-react\`
- \`sema prompt-ia-sema-primeiro\`
- \`sema contexto-ia <arquivo.sema>\`
`;

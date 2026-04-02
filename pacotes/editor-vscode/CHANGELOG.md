# Changelog

## Unreleased

- reposiciona a extensao como ponte de contexto para IA externa, em vez de depender de participante de chat embutido
- adiciona o comando `Sema: Preparar Contexto para IA Externa`, que copia prompt pronto e gera `SEMA_EXTERNAL_AI.md`
- adiciona `Sema: Diagnosticar CLI` e `Sema: Autoconfigurar CLI` para reduzir adivinhacao no bootstrap da extensao
- mantem o painel lateral com estado do projeto, alvo atual, drift, prompt e artefatos recentes
- preserva a CLI da Sema como backend unico para `inspecionar`, `resumo`, `drift`, `contexto-ia`, `validar`, `importar`, `compilar` e `testar`
- simplifica o empacotamento da extensao removendo a camada de chat/tools que nao ajudava IA externa

## 1.0.2

- consolida a pagina publica da extensao com instalacao oficial, links diretos e fluxo real com a CLI
- mantem a validacao por contexto de projeto e a linha publica pronta para uma nova publicacao da VSIX

## 1.0.1

- troca a validacao isolada por compilacao com contexto de projeto no servidor do VS Code
- resolve `use` cross-module na extensao com a mesma ideia de projeto compartilhado da CLI
- respeita buffers abertos durante o diagnostico e empacota a extensao com o novo loader de projeto
- limpa a pagina publica da extensao para destacar instalacao, links oficiais e fluxo real com a CLI

## 1.0.0

- fecha a primeira linha publica estavel da Sema com camada compacta para IA pequena, media e grande
- acompanha `sema resumo`, `prompt-curto`, `briefing.min.json`, `SEMA_BRIEF.*` e o reposicionamento explicitamente IA-first
- alinha instalacao, release e documentacao publica na linha `1.0.0`

## 0.9.1

- consolida a instalacao publica da CLI e da extensao na linha `0.9.1`
- alinha a documentacao para fluxo IA-first sem depender do monorepo da Sema
- acompanha o pacote publico com exemplos e docs empacotados para agente

## 0.9.0

- alinha a extensao com a linha publica `0.9.x` da Sema
- atualiza a documentacao para instalacao via GitHub Release e VSIX `0.9.0`
- acompanha o reposicionamento da Sema como linguagem de intervencao segura para IA e backend vivo

## 0.8.2

- fortalece o `importar nextjs` em handlers com `request.json()` tipado ou com cast inline
- reconhece melhor `NextResponse.json(...)` quando a resposta passa por variavel local antes do `return`
- fecha o buraco de bootstrap semantico em casos reais como `auth/login` e `local-firestore/query`

## 0.8.1

- melhora o importador `nextjs` com bootstrap semantico mais forte para `params`, `query`, `body`, `status` e `response`
- aceita importacao a partir da raiz do projeto, de `app/`, `src/app/api/` e de subpastas concretas de rota
- mantem o draft revisavel, mas reduz o fallback preguiçoso em handlers que ja carregam sinal forte

## 0.8.0

- alinha a extensao com a linha publica `0.8.x` da Sema
- acompanha a onda backend generica com onboarding e distribuicao mais redondos
- atualiza a documentacao da extensao para o fluxo publico com instaladores e release

## 0.7.0

- alinha a extensao com a linha publica `0.7.x` da Sema
- reposiciona a descricao publica em torno do protocolo e da camada semantica
- atualiza a documentacao da extensao para o fluxo de instalacao e uso atual

## 0.1.1

- melhora o manifesto para publicacao no Marketplace
- adiciona README mais completo para a pagina da extensao
- adiciona changelog oficial da extensao
- mantem highlight, snippets, formatacao e LSP inicial

## 0.1.0

- primeira versao publica da extensao da Sema
- suporte basico a arquivos `.sema`
- destaque de sintaxe
- snippets iniciais
- integracao com formatacao
- diagnosticos semanticos e hover basico via servidor de linguagem inicial

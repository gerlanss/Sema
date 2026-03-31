# Changelog

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

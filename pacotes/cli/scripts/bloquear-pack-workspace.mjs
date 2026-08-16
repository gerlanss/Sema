// SEMA-GOVERNED: sema.produto.fronteira_repositorios.empacotamento
// Descrição: bloqueia o npm pack direto do workspace; a fabricação pública ocorre em stage isolado.

console.error(
  "PACK_WORKSPACE_NAO_SUPORTADO: use `npm run cli:empacotar-publica` na raiz do repositório.",
);
process.exitCode = 1;

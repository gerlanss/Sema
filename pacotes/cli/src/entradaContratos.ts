// SEMA-GOVERNED: sema.validacao_resposta
// Descrição: rejeita validação ou formatação sem contratos efetivamente selecionados.
import type { Diagnostico } from "@sema/nucleo";

export function diagnosticarEntradaContratos(arquivos: readonly string[]): Diagnostico[] {
  if (arquivos.length === 0) {
    return [{
      codigo: "SEM_CLI_SEM_CONTRATOS",
      severidade: "erro",
      mensagem: "Nenhum contrato .sema encontrado no escopo. A aplicação não foi validada nem formatada.",
      dica: "Confirme o escopo. Se este projeto ainda não usa Sema, obtenha autorização de adoção e a janela de contexto antes de iniciar; depois modele o contrato da tarefa.",
    }];
  }
  if (arquivos.some((arquivo) => !arquivo.toLowerCase().endsWith(".sema"))) {
    return [{
      codigo: "SEM_CLI_ENTRADA_NAO_CONTRATO",
      severidade: "erro",
      mensagem: "Validar e formatar operam sobre contratos .sema, não sobre arquivos da aplicação.",
      dica: "Informe o contrato aplicável e use testes próprios para verificar a implementação.",
    }];
  }
  return [];
}

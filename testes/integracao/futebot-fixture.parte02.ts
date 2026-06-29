// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: fixture Futebot particionado; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

import { escreverFutebotFixture } from "./futebot-fixture.base.js";

export async function escreverFutebotFixtureParte02(base: string): Promise<void> {
  await escreverFutebotFixture(
      base,
      "sema/quarentena_retreino_focal.sema",
      `module futebot.quarentena {
    task avaliar_degradacao_modelo {
      input {
        strategy_id: Id required
      }
      output {
        sucesso: Booleano
      }
      impl {
        py: models.learner.Learner.verificar_degradacao
      }
      guarantees {
        sucesso existe
      }
      tests {
        caso "ok" {
          given {
            strategy_id: "strategy_1"
          }
          expect {
            sucesso: verdadeiro
          }
        }
      }
    }

    task aplicar_quarentena_seletiva {
      input {
        strategy_id: Id required
      }
      output {
        sucesso: Booleano
      }
      impl {
        py: pipeline.scanner.Scanner._verificar_auto_pause
      }
      guarantees {
        sucesso existe
      }
      tests {
        caso "ok" {
          given {
            strategy_id: "strategy_2"
          }
          expect {
            sucesso: verdadeiro
          }
        }
      }
    }

    task priorizar_ligas_quarentena {
      input {
        strategy_id: Id required
      }
      output {
        sucesso: Booleano
      }
      impl {
        py: pipeline.scheduler.Scheduler._priorizar_ligas_quarentena
      }
      guarantees {
        sucesso existe
      }
      tests {
        caso "ok" {
          given {
            strategy_id: "strategy_3"
          }
          expect {
            sucesso: verdadeiro
          }
        }
      }
    }

    task executar_retreino_focal_quarentena {
      input {
        strategy_id: Id required
      }
      output {
        sucesso: Booleano
      }
      impl {
        py: pipeline.scheduler.Scheduler._job_retreino_quarentena
      }
      guarantees {
        sucesso existe
      }
      tests {
        caso "ok" {
          given {
            strategy_id: "strategy_4"
          }
          expect {
            sucesso: verdadeiro
          }
        }
      }
    }
  }
  `,
    );
  await escreverFutebotFixture(
      base,
      "sema/telegram_operacao.sema",
      `module futebot.telegram {
    task registrar_chat_e_menu {
      input {
        chat_id: Id required
      }
      output {
        sucesso: Booleano
      }
      impl {
        py: services.telegram_bot.cmd_start
      }
      guarantees {
        sucesso existe
      }
      tests {
        caso "ok" {
          given {
            chat_id: "chat_admin"
          }
          expect {
            sucesso: verdadeiro
          }
        }
      }
    }

    task executar_comando_operacional {
      input {
        chat_id: Id required
      }
      output {
        sucesso: Booleano
      }
      impl {
        py: services.telegram_bot._executar_via_callback
      }
      guarantees {
        sucesso existe
      }
      tests {
        caso "ok" {
          given {
            chat_id: "chat_ops"
          }
          expect {
            sucesso: verdadeiro
          }
        }
      }
    }

    task rotear_callback_menu {
      input {
        chat_id: Id required
      }
      output {
        sucesso: Booleano
      }
      impl {
        py: services.telegram_bot._callback_handler
      }
      guarantees {
        sucesso existe
      }
      tests {
        caso "ok" {
          given {
            chat_id: "chat_ops"
          }
          expect {
            sucesso: verdadeiro
          }
        }
      }
    }

    task publicar_mensagem_automatica {
      input {
        chat_id: Id required
      }
      output {
        sucesso: Booleano
      }
      impl {
        py: services.telegram_bot._send_to_chats
      }
      guarantees {
        sucesso existe
      }
      tests {
        caso "ok" {
          given {
            chat_id: "chat_publico"
          }
          expect {
            sucesso: verdadeiro
          }
        }
      }
    }
  }
  `,
    );
  await escreverFutebotFixture(
      base,
      "sema/integracoes_externas.sema",
      `module futebot.integracoes {
    task consultar_status_api_football {
      input {
        league_id: Id required
      }
      output {
        sucesso: Booleano
      }
      impl {
        py: data.bulk_download._check_limite
      }
      guarantees {
        sucesso existe
      }
      tests {
        caso "ok" {
          given {
            league_id: 71
          }
          expect {
            sucesso: verdadeiro
          }
        }
      }
    }
  }
  `,
    );
}

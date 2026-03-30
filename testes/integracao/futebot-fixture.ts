import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const DIRETORIOS_CODIGO_FUTEBOT_FIXTURE = ["data", "models", "pipeline", "services"];

async function escrever(base: string, caminhoRelativo: string, conteudo: string): Promise<void> {
  const destino = path.join(base, caminhoRelativo);
  await mkdir(path.dirname(destino), { recursive: true });
  await writeFile(destino, conteudo, "utf8");
}

export async function criarProjetoPythonEstiloFuteBot(base: string): Promise<void> {
  await Promise.all([
    mkdir(path.join(base, "docs"), { recursive: true }),
    mkdir(path.join(base, "tests"), { recursive: true }),
    mkdir(path.join(base, ".pytest_cache"), { recursive: true }),
  ]);

  await escrever(
    base,
    "data/database.py",
    `class Database:
    """Persistencia principal do fixture."""

    def salvar_prediction(self, pred: dict):
        return {"prediction_id": 1, "pred": pred}

    def salvar_scan_candidates(self, data: str, tips: list[dict]):
        return {"data": data, "tips": tips}

    def resolver_prediction(self, fixture_id: int, resultado: str):
        return {"fixture_id": fixture_id, "resultado": resultado}
`,
  );

  await escrever(
    base,
    "data/bulk_download.py",
    `def _check_limite() -> tuple[int, bool]:
    return 10, False
`,
  );

  await escrever(
    base,
    "pipeline/scheduler.py",
    `class Scheduler:
    """Scheduler com metodos privados e decorators no meio."""

    def _garantir_radar_do_dia(self, data: str | None = None) -> bool:
        return True

    def _job_liberacao_t30(self):
        return {"liberado": True}

    def _job_check_ao_vivo(self):
        """Job live com docstring e linha em branco depois."""

        return {"live": True}

    def _job_relatorio(self):
        return {"relatorio": True}

    @staticmethod
    def _priorizar_ligas_quarentena(slices_ruins: list[dict]) -> list[int]:
        return [item.get("league_id", 0) for item in slices_ruins]

    def _job_retreino_quarentena(self):
        return {"retreino": True}
`,
  );

  await escrever(
    base,
    "pipeline/scanner.py",
    `class Scanner:
    def _verificar_auto_pause(self) -> tuple[bool, str]:
        return False, ""
`,
  );

  await escrever(
    base,
    "models/learner.py",
    `class Learner:
    @staticmethod
    def verificar_degradacao() -> dict:
        return {"degradado": False}

    def _registrar_feedback_contextual_fixture(self, fixture_id: int, gols_home: int, gols_away: int):
        return {
            "fixture_id": fixture_id,
            "gols_home": gols_home,
            "gols_away": gols_away,
        }
`,
  );

  await escrever(
    base,
    "services/telegram_bot.py",
    `async def cmd_start(update=None, context=None):
    return {"chat_registrado": True}


async def _callback_handler(update=None, context=None):
    return {"callback": True}


async def _executar_via_callback(query=None, handler_fn=None, context=None):
    return {"executado": True}


async def _send_to_chats(chats: list[int], mensagem: str):
    return {"enviados": len(chats), "mensagem": mensagem}
`,
  );

  await escrever(
    base,
    "tests/test_ignorado.py",
    `def test_nao_deve_entrar_no_drift():
    assert True
`,
  );

  await escrever(
    base,
    "sema/ciclo_previsao.sema",
    `module futebot.previsao {
  task registrar_candidatos_radar {
    input {
      fixture_id: Id required
    }
    output {
      sucesso: Booleano
    }
    impl {
      py: data.database.Database.salvar_scan_candidates
    }
    guarantees {
      sucesso existe
    }
    tests {
      caso "ok" {
        given {
          fixture_id: 1
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }

  task liberar_previsao_aprovada {
    input {
      fixture_id: Id required
    }
    output {
      sucesso: Booleano
    }
    impl {
      py: data.database.Database.salvar_prediction
    }
    guarantees {
      sucesso existe
    }
    tests {
      caso "ok" {
        given {
          fixture_id: 2
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }

  task acompanhar_previsao_live {
    input {
      fixture_id: Id required
    }
    output {
      sucesso: Booleano
    }
    impl {
      py: pipeline.scheduler.Scheduler._job_check_ao_vivo
    }
    guarantees {
      sucesso existe
    }
    tests {
      caso "ok" {
        given {
          fixture_id: 3
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }

  task resolver_previsao_encerrada {
    input {
      fixture_id: Id required
    }
    output {
      sucesso: Booleano
    }
    impl {
      py: data.database.Database.resolver_prediction
    }
    guarantees {
      sucesso existe
    }
    tests {
      caso "ok" {
        given {
          fixture_id: 4
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }

  task registrar_feedback_aprendizado {
    input {
      fixture_id: Id required
    }
    output {
      sucesso: Booleano
    }
    impl {
      py: models.learner.Learner._registrar_feedback_contextual_fixture
    }
    guarantees {
      sucesso existe
    }
    tests {
      caso "ok" {
        given {
          fixture_id: 5
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

  await escrever(
    base,
    "sema/operacao_futebot.sema",
    `module futebot.operacao {
  task gerar_radar_pre_live {
    input {
      data_operacao: Texto required
    }
    output {
      sucesso: Booleano
    }
    impl {
      py: pipeline.scheduler.Scheduler._garantir_radar_do_dia
    }
    guarantees {
      sucesso existe
    }
    tests {
      caso "ok" {
        given {
          data_operacao: "2026-03-30"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }

  task liberar_mercados_t30 {
    input {
      data_operacao: Texto required
    }
    output {
      sucesso: Booleano
    }
    impl {
      py: pipeline.scheduler.Scheduler._job_liberacao_t30
    }
    guarantees {
      sucesso existe
    }
    tests {
      caso "ok" {
        given {
          data_operacao: "2026-03-30"
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }

  task monitorar_ao_vivo {
    input {
      fixture_id: Id required
    }
    output {
      sucesso: Booleano
    }
    impl {
      py: pipeline.scheduler.Scheduler._job_check_ao_vivo
    }
    guarantees {
      sucesso existe
    }
    tests {
      caso "ok" {
        given {
          fixture_id: 10
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }

  task emitir_relatorio_diario {
    input {
      referencia: Texto required
    }
    output {
      sucesso: Booleano
    }
    impl {
      py: pipeline.scheduler.Scheduler._job_relatorio
    }
    guarantees {
      sucesso existe
    }
    tests {
      caso "ok" {
        given {
          referencia: "ontem"
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

  await escrever(
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

  await escrever(
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

  await escrever(
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

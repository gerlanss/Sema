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

export async function criarProjetoFlaskEstiloGestech(base: string): Promise<void> {
  await Promise.all([
    mkdir(path.join(base, "contratos"), { recursive: true }),
    mkdir(path.join(base, "Gestech", "routes"), { recursive: true }),
  ]);

  await escrever(
    base,
    "sema.config.json",
    JSON.stringify({
      origens: ["./contratos"],
      diretoriosCodigo: ["./Gestech"],
      fontesLegado: ["flask"],
      modoAdocao: "incremental",
      modoEstrito: true,
    }, null, 2),
  );

  await escrever(
    base,
    "Gestech/app.py",
    `from flask import Flask, jsonify

app = Flask(__name__)


@app.route('/status')
def status():
    return jsonify({'ok': True})


@app.route('/sync', methods=['GET', 'POST'])
def sync_store():
    return jsonify({'ok': True})
`,
  );

  await escrever(
    base,
    "Gestech/app_factory.py",
    `from flask import Flask

from routes.api_ranking import ranking_bp
from routes.api_ferramentas import ferramentas_bp


def create_app() -> Flask:
    app = Flask(__name__)
    app.register_blueprint(ranking_bp)
    app.register_blueprint(ferramentas_bp)
    return app
`,
  );

  await escrever(
    base,
    "Gestech/routes/api_ranking.py",
    `from flask import Blueprint, jsonify

ranking_bp = Blueprint('ranking', __name__)


def fake_cache(*args, **kwargs):
    def decorator(func):
        return func
    return decorator


@ranking_bp.route('/api/app-version', methods=['GET'])
def app_version():
    return jsonify({'version': '1.0.0'})


@ranking_bp.route('/api/ranking-showroom', methods=['GET'])
@fake_cache(
    timeout=20,
    query_string=True,
)
def ranking_showroom():
    return jsonify({'ranking': []})
`,
  );

  await escrever(
    base,
    "Gestech/routes/api_ferramentas.py",
    `from flask import Blueprint, jsonify

ferramentas_bp = Blueprint('ferramentas_api', __name__, url_prefix='/api/ferramentas')


@ferramentas_bp.route('/config', methods=['GET'])
def api_config():
    return jsonify({'ferramentas': []})


@ferramentas_bp.route('/admin/<int:ferramenta_id>', methods=['PUT', 'DELETE'])
def api_admin_item(ferramenta_id: int):
    return jsonify({'id': ferramenta_id})
`,
  );

  await escrever(
    base,
    "contratos/flask_showroom.sema",
    `module gestech.flask.showroom {
  task status {
    output {
      resultado: Json
    }
    impl {
      py: gestech.app.status
    }
    tests {
      caso "ok" {
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }

  task sync_store {
    output {
      resultado: Json
    }
    impl {
      py: gestech.app.sync_store
    }
    tests {
      caso "ok" {
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }

  task app_version {
    output {
      resultado: Json
    }
    impl {
      py: gestech.routes.api_ranking.app_version
    }
    tests {
      caso "ok" {
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }

  task ranking_showroom {
    output {
      resultado: Json
    }
    impl {
      py: gestech.routes.api_ranking.ranking_showroom
    }
    tests {
      caso "ok" {
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }

  task api_config {
    output {
      resultado: Json
    }
    impl {
      py: gestech.routes.api_ferramentas.api_config
    }
    tests {
      caso "ok" {
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }

  task api_admin_item {
    input {
      ferramenta_id: Inteiro required
    }
    output {
      resultado: Json
    }
    impl {
      py: gestech.routes.api_ferramentas.api_admin_item
    }
    tests {
      caso "ok" {
        given {
          ferramenta_id: 7
        }
        expect {
          sucesso: verdadeiro
        }
      }
    }
  }

  route status_publico {
    metodo: GET
    caminho: /status
    task: status
  }

  route sync_store_get_publico {
    metodo: GET
    caminho: /sync
    task: sync_store
  }

  route sync_store_post_publico {
    metodo: POST
    caminho: /sync
    task: sync_store
  }

  route app_version_publico {
    metodo: GET
    caminho: /api/app-version
    task: app_version
  }

  route ranking_showroom_publico {
    metodo: GET
    caminho: /api/ranking-showroom
    task: ranking_showroom
  }

  route api_config_publico {
    metodo: GET
    caminho: /api/ferramentas/config
    task: api_config
  }

  route api_admin_item_put_publico {
    metodo: PUT
    caminho: "/api/ferramentas/admin/{ferramenta_id}"
    task: api_admin_item
  }

  route api_admin_item_delete_publico {
    metodo: DELETE
    caminho: "/api/ferramentas/admin/{ferramenta_id}"
    task: api_admin_item
  }
}
`,
  );
}

export async function criarProjetoNextJsAppRouter(base: string): Promise<void> {
  await Promise.all([
    mkdir(path.join(base, "contratos"), { recursive: true }),
    mkdir(path.join(base, "src", "app", "api", "reposicao"), { recursive: true }),
    mkdir(path.join(base, "src", "app", "api", "pedido"), { recursive: true }),
    mkdir(path.join(base, "src", "app", "api", "reposicao", "[itemId]"), { recursive: true }),
  ]);

  await escrever(
    base,
    "sema.config.json",
    JSON.stringify({
      origens: ["./contratos"],
      diretoriosCodigo: ["./src"],
      modoAdocao: "incremental",
      modoEstrito: true,
    }, null, 2),
  );

  await escrever(
    base,
    "package.json",
    JSON.stringify({
      name: "fixture-nextjs-sema",
      private: true,
      dependencies: {
        next: "15.0.0",
      },
    }, null, 2),
  );

  await escrever(
    base,
    "src/app/api/reposicao/route.ts",
    `export async function GET() {
  return Response.json({ produtos: [], total: 0 });
}
`,
  );

  await escrever(
    base,
    "src/app/api/pedido/route.ts",
    `export async function GET() {
  return Response.json({ pedido: null });
}

export async function POST() {
  return Response.json({ ok: true });
}
`,
  );

  await escrever(
    base,
    "src/app/api/reposicao/[itemId]/route.ts",
    `export async function GET(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const resolved = await params;
  return Response.json({ itemId: resolved.itemId });
}
`,
  );

  await escrever(
    base,
    "contratos/next_http.sema",
    `module legado.next.http {
  task api_reposicao_get {
    output {
      resultado: Json
    }
    impl {
      ts: src.app.api.reposicao.route.GET
    }
    guarantees {
      resultado existe
    }
  }

  task api_pedido_get {
    output {
      resultado: Json
    }
    impl {
      ts: src.app.api.pedido.route.GET
    }
    guarantees {
      resultado existe
    }
  }

  task api_pedido_post {
    output {
      resultado: Json
    }
    impl {
      ts: src.app.api.pedido.route.POST
    }
    guarantees {
      resultado existe
    }
  }

  task api_reposicao_item_id_get {
    input {
      item_id: Id required
    }
    output {
      resultado: Json
    }
    impl {
      ts: src.app.api.reposicao.item_id.route.GET
    }
    guarantees {
      resultado existe
    }
  }

  route get_reposicao {
    metodo: GET
    caminho: /api/reposicao
    task: api_reposicao_get
  }

  route get_pedido {
    metodo: GET
    caminho: /api/pedido
    task: api_pedido_get
  }

  route post_pedido {
    metodo: POST
    caminho: /api/pedido
    task: api_pedido_post
  }

  route get_reposicao_item {
    metodo: GET
    caminho: "/api/reposicao/{itemId}"
    task: api_reposicao_item_id_get
  }
  }
`,
  );
}

export async function criarProjetoNextJsConsumer(base: string): Promise<void> {
  await Promise.all([
    mkdir(path.join(base, "contratos"), { recursive: true }),
    mkdir(path.join(base, "src", "lib"), { recursive: true }),
    mkdir(path.join(base, "src", "app", "ranking"), { recursive: true }),
  ]);

  await escrever(
    base,
    "sema.config.json",
    JSON.stringify({
      origens: ["./contratos"],
      diretoriosCodigo: ["./src"],
      fontesLegado: ["nextjs-consumer", "typescript"],
      modoAdocao: "incremental",
      modoEstrito: true,
    }, null, 2),
  );

  await escrever(
    base,
    "package.json",
    JSON.stringify({
      name: "fixture-nextjs-consumer-sema",
      private: true,
      dependencies: {
        next: "15.0.0",
      },
    }, null, 2),
  );

  await escrever(
    base,
    "src/lib/sema_consumer_bridge.ts",
    `export async function semaFetchShowroomRanking() {
  return {
    ranking: [
      { clube: "Tigres do Norte", pontos: 33 },
      { clube: "Porto Azul", pontos: 31 },
      { clube: "Galo de Ouro", pontos: 28 },
    ],
  };
}

export async function semaLoadRankingSummary() {
  return {
    totalClubes: 3,
    atualizadoEm: "2026-03-31T12:00:00.000Z",
  };
}
`,
  );

  await escrever(
    base,
    "src/app/ranking/page.tsx",
    `import { semaFetchShowroomRanking } from "../../lib/sema_consumer_bridge";

export default async function RankingPage() {
  const { ranking } = await semaFetchShowroomRanking();

  return (
    <main>
      <h1>Ranking showroom</h1>
      <ul>
        {ranking.map((item) => (
          <li key={item.clube}>
            {item.clube} - {item.pontos} pts
          </li>
        ))}
      </ul>
    </main>
  );
}
`,
  );

  await escrever(
    base,
    "src/app/ranking/loading.tsx",
    `export default function Loading() {
  return <p>Carregando ranking...</p>;
}
`,
  );

  await escrever(
    base,
    "src/app/ranking/error.tsx",
    `"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main>
      <h1>Falha ao carregar ranking</h1>
      <p>{error.message}</p>
      <button type="button" onClick={reset}>Tentar novamente</button>
    </main>
  );
}
`,
  );

  await escrever(
    base,
    "contratos/showroom_consumer.sema",
    `module showroom.consumer {
  task fetch_showroom_ranking {
    input {
    }
    output {
      ranking: Json
    }
    impl {
      ts: src.lib.sema_consumer_bridge.semaFetchShowroomRanking
    }
    vinculos {
      arquivo: "src/lib/sema_consumer_bridge.ts"
      simbolo: src.lib.sema_consumer_bridge.semaFetchShowroomRanking
      superficie: "/ranking"
      arquivo: "src/app/ranking/page.tsx"
      arquivo: "src/app/ranking/loading.tsx"
      arquivo: "src/app/ranking/error.tsx"
    }
    guarantees {
      ranking existe
    }
  }
}
`,
  );
}

export async function criarProjetoReactViteConsumer(base: string): Promise<void> {
  await Promise.all([
    mkdir(path.join(base, "contratos"), { recursive: true }),
    mkdir(path.join(base, "src", "lib"), { recursive: true }),
    mkdir(path.join(base, "src", "pages"), { recursive: true }),
  ]);

  await escrever(
    base,
    "sema.config.json",
    JSON.stringify({
      origens: ["./contratos"],
      diretoriosCodigo: ["./src"],
      fontesLegado: ["react-vite-consumer", "typescript"],
      modoAdocao: "incremental",
      modoEstrito: true,
    }, null, 2),
  );

  await escrever(
    base,
    "package.json",
    JSON.stringify({
      name: "fixture-react-vite-consumer-sema",
      private: true,
      dependencies: {
        react: "19.0.0",
        "react-router-dom": "7.0.0",
        vite: "6.0.0",
      },
    }, null, 2),
  );

  await escrever(
    base,
    "src/lib/sema_consumer_bridge.ts",
    `export async function semaFetchShowroomRanking() {
  return {
    ranking: [
      { clube: "Tigres do Norte", pontos: 33 },
      { clube: "Porto Azul", pontos: 31 },
      { clube: "Galo de Ouro", pontos: 28 },
    ],
  };
}

export async function semaLoadRankingSummary() {
  return {
    totalClubes: 3,
    atualizadoEm: "2026-03-31T12:00:00.000Z",
  };
}
`,
  );

  await escrever(
    base,
    "src/pages/ranking.tsx",
    `import { useEffect, useState } from "react";
import { semaFetchShowroomRanking } from "../lib/sema_consumer_bridge";

export function RankingPage() {
  const [ranking, setRanking] = useState<Array<{ clube: string; pontos: number }>>([]);

  useEffect(() => {
    void semaFetchShowroomRanking().then((payload) => setRanking(payload.ranking ?? []));
  }, []);

  return (
    <main>
      <h1>Ranking showroom</h1>
      <ul>
        {ranking.map((item) => (
          <li key={item.clube}>
            {item.clube} - {item.pontos} pts
          </li>
        ))}
      </ul>
    </main>
  );
}
`,
  );

  await escrever(
    base,
    "src/router.tsx",
    `import { createBrowserRouter } from "react-router-dom";
import { RankingPage } from "./pages/ranking";

export const appRouter = createBrowserRouter([
  {
    path: "/ranking",
    Component: RankingPage,
  },
]);
`,
  );

  await escrever(
    base,
    "src/App.tsx",
    `import { RouterProvider } from "react-router-dom";
import { appRouter } from "./router";

export default function App() {
  return <RouterProvider router={appRouter} />;
}
`,
  );

  await escrever(
    base,
    "src/main.tsx",
    `import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
`,
  );

  await escrever(
    base,
    "contratos/showroom_consumer.sema",
    `module showroom.consumer {
  task fetch_showroom_ranking {
    input {
    }
    output {
      ranking: Json
    }
    impl {
      ts: src.lib.sema_consumer_bridge.semaFetchShowroomRanking
    }
    vinculos {
      arquivo: "src/lib/sema_consumer_bridge.ts"
      simbolo: src.lib.sema_consumer_bridge.semaFetchShowroomRanking
      superficie: "/ranking"
      arquivo: "src/router.tsx"
      arquivo: "src/pages/ranking.tsx"
    }
    guarantees {
      ranking existe
    }
  }
}
`,
  );
}

export async function criarProjetoAngularConsumer(base: string): Promise<void> {
  await Promise.all([
    mkdir(path.join(base, "contratos"), { recursive: true }),
    mkdir(path.join(base, "src", "app", "features", "ranking"), { recursive: true }),
  ]);

  await escrever(
    base,
    "sema.config.json",
    JSON.stringify({
      origens: ["./contratos"],
      diretoriosCodigo: ["./src"],
      fontesLegado: ["angular-consumer", "typescript"],
      modoAdocao: "incremental",
      modoEstrito: true,
    }, null, 2),
  );

  await escrever(
    base,
    "package.json",
    JSON.stringify({
      name: "fixture-angular-consumer-sema",
      private: true,
      dependencies: {
        "@angular/core": "19.0.0",
        "@angular/router": "19.0.0",
      },
    }, null, 2),
  );

  await escrever(
    base,
    "src/app/sema_consumer_bridge.ts",
    `export async function semaFetchShowroomRanking() {
  return {
    ranking: [
      { clube: "Tigres do Norte", pontos: 33 },
      { clube: "Porto Azul", pontos: 31 },
      { clube: "Galo de Ouro", pontos: 28 },
    ],
  };
}

export async function semaLoadRankingSummary() {
  return {
    totalClubes: 3,
    atualizadoEm: "2026-03-31T12:00:00.000Z",
  };
}
`,
  );

  await escrever(
    base,
    "src/app/app.routes.ts",
    `import { Routes } from "@angular/router";

export const routes: Routes = [
  {
    path: "ranking",
    loadChildren: () => import("./features/ranking/ranking.routes").then((m) => m.RANKING_ROUTES),
  },
];
`,
  );

  await escrever(
    base,
    "src/app/features/ranking/ranking.routes.ts",
    `import { Routes } from "@angular/router";

export const RANKING_ROUTES: Routes = [
  {
    path: "",
    loadComponent: () => import("./ranking-page.component").then((m) => m.RankingPageComponent),
  },
];
`,
  );

  await escrever(
    base,
    "src/app/features/ranking/ranking-page.component.ts",
    `import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { semaFetchShowroomRanking } from "../../sema_consumer_bridge";

@Component({
  selector: "app-ranking-page",
  standalone: true,
  imports: [CommonModule],
  template: \`
    <main>
      <h1>Ranking showroom</h1>
      <ul>
        <li *ngFor="let item of ranking">
          {{ item.clube }} - {{ item.pontos }} pts
        </li>
      </ul>
    </main>
  \`,
})
export class RankingPageComponent implements OnInit {
  ranking: Array<{ clube: string; pontos: number }> = [];

  async ngOnInit() {
    const payload = await semaFetchShowroomRanking();
    this.ranking = payload.ranking ?? [];
  }
}
`,
  );

  await escrever(
    base,
    "contratos/showroom_consumer.sema",
    `module showroom.consumer {
  task fetch_showroom_ranking {
    input {
    }
    output {
      ranking: Json
    }
    impl {
      ts: src.app.sema_consumer_bridge.semaFetchShowroomRanking
    }
    vinculos {
      arquivo: "src/app/sema_consumer_bridge.ts"
      simbolo: src.app.sema_consumer_bridge.semaFetchShowroomRanking
      superficie: "/ranking"
      arquivo: "src/app/app.routes.ts"
      arquivo: "src/app/features/ranking/ranking.routes.ts"
      arquivo: "src/app/features/ranking/ranking-page.component.ts"
    }
    guarantees {
      ranking existe
    }
  }
}
`,
  );
}

export async function criarProjetoNextJsAppRouterSemantico(base: string): Promise<void> {
  await Promise.all([
    mkdir(path.join(base, "src", "app", "api", "auth", "session"), { recursive: true }),
    mkdir(path.join(base, "src", "app", "api", "auth", "login"), { recursive: true }),
    mkdir(path.join(base, "src", "app", "api", "catalogo", "busca"), { recursive: true }),
    mkdir(path.join(base, "src", "app", "api", "local-firestore", "query"), { recursive: true }),
    mkdir(path.join(base, "src", "app", "api", "reposicao", "[itemId]"), { recursive: true }),
    mkdir(path.join(base, "src", "app", "api", "fallback"), { recursive: true }),
  ]);

  await escrever(
    base,
    "package.json",
    JSON.stringify({
      name: "fixture-nextjs-semantico",
      private: true,
      dependencies: {
        next: "15.0.0",
        zod: "^3.23.8",
      },
    }, null, 2),
  );

  await escrever(
    base,
    "src/app/api/auth/session/route.ts",
    `import { NextResponse } from "next/server";
import { z } from "zod";

interface CreateSessionBody {
  email: string;
  password: string;
  remember?: boolean;
}

interface SessionResponse {
  session_id: string;
  user_id: string;
}

const sessionSchema = z.object({
  email: z.string(),
  password: z.string(),
  remember: z.boolean().optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const expand = url.searchParams.get("expand");
  const refreshId = request.nextUrl.searchParams.get("refreshId");

  if (!refreshId) {
    return NextResponse.json({ error: "missing_refresh" }, { status: 401 });
  }

  const response: SessionResponse = {
    session_id: refreshId,
    user_id: expand ?? "usr_default",
  };

  return NextResponse.json<SessionResponse>(response, { status: 200 });
}

export async function POST(request: Request) {
  const body = (await request.json()) as CreateSessionBody;
  const parsed = sessionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body" }, { status: 422 });
  }

  if (parsed.data.email === "blocked@example.com") {
    return NextResponse.json({ error: "blocked" }, { status: 403 });
  }
  const response = NextResponse.json<SessionResponse>({
    session_id: parsed.data.email,
    user_id: parsed.data.email,
  }, { status: 201 });

  return response;
}
`,
  );

  await escrever(
    base,
    "src/app/api/auth/login/route.ts",
    `import { NextResponse } from "next/server";

interface LoginBody {
  email?: string;
  password?: string;
  rememberMe?: boolean;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LoginBody;
    const email = body.email?.trim().toLowerCase() || "";
    const password = body.password || "";
    const rememberMe = body.rememberMe ?? true;

    if (!email || !password) {
      return NextResponse.json({ error: "missing_credentials" }, { status: 400 });
    }

    if (email === "blocked@example.com") {
      return NextResponse.json({ error: "blocked" }, { status: 401 });
    }

    const response = NextResponse.json({
      ok: true,
      user: {
        email,
        remember_me: rememberMe,
      },
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "unexpected_failure" },
      { status: 500 },
    );
  }
}
`,
  );

  await escrever(
    base,
    "src/app/api/catalogo/busca/route.ts",
    `import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const searchParams = request.nextUrl.searchParams;
  const termo = searchParams.get("termo");
  const limite = Number(searchParams.get("limite") ?? "10");

  return NextResponse.json({
    termo,
    limite,
    total: 0,
  });
}
`,
  );

  await escrever(
    base,
    "src/app/api/local-firestore/query/route.ts",
    `import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    collection?: string;
    filters?: Array<{ field: string; operator: string; value: string }>;
    orderBy?: { field: string; direction: "asc" | "desc" } | null;
    limit?: number | null;
  };

  if (!body.collection) {
    return NextResponse.json({ error: "missing_collection" }, { status: 400 });
  }

  return NextResponse.json({
    docs: [],
    total: body.limit ?? 0,
  });
}
`,
  );

  await escrever(
    base,
    "src/app/api/reposicao/[itemId]/route.ts",
    `import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const resolved = await params;

  return NextResponse.json({
    item_id: resolved.itemId,
    status: "ok",
  });
}
`,
  );

  await escrever(
    base,
    "src/app/api/fallback/route.ts",
    `export async function POST(request: Request) {
  const payload = await request.json();

  return Response.json(payload);
}
`,
  );
}

export async function criarProjetoFirebaseWorker(base: string): Promise<void> {
  await Promise.all([
    mkdir(path.join(base, "contratos"), { recursive: true }),
    mkdir(path.join(base, "src", "config"), { recursive: true }),
    mkdir(path.join(base, "src", "services"), { recursive: true }),
  ]);

  await escrever(
    base,
    "sema.config.json",
    JSON.stringify({
      origens: ["./contratos"],
      diretoriosCodigo: ["./src"],
      modoAdocao: "incremental",
      modoEstrito: true,
    }, null, 2),
  );

  await escrever(
    base,
    "package.json",
    JSON.stringify({
      name: "fixture-firebase-worker-sema",
      private: true,
      dependencies: {
        "firebase-admin": "^13.0.0",
      },
    }, null, 2),
  );

  await escrever(
    base,
    "firebase.json",
    JSON.stringify({
      functions: { source: "src" },
    }, null, 2),
  );

  await escrever(
    base,
    "src/config/collections.ts",
    `export const COLLECTIONS = {
  telegram_sessions: "telegram_sessions",
  worker_status: "worker_status",
} as const;
`,
  );

  await escrever(
    base,
    "src/services/health-check.ts",
    `import http from "node:http";

export type HealthStatus = {
  status: "healthy" | "degraded" | "unhealthy" | "initializing";
  timestamp: string;
};

export type HealthProvider = () => HealthStatus;

export function startHealthCheckServer(port: number, provider: HealthProvider) {
  const server = http.createServer((req, res) => {
    if (req.url === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(provider()));
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.listen(port);
  return server;
}
`,
  );

  await escrever(
    base,
    "src/sema_contract_bridge.ts",
    `import { COLLECTIONS } from "./config/collections";
import { startHealthCheckServer, type HealthProvider, type HealthStatus } from "./services/health-check";

export function semaStartWorkerHealthServer(port: number, provider: HealthProvider) {
  return startHealthCheckServer(port, provider);
}

export function semaWorkerHealthPayload(payload: HealthStatus): HealthStatus {
  return payload;
}

export function semaTelegramSessionRecord(payload: { sessionId: string }) {
  return payload;
}

export function semaCollectionNames() {
  return COLLECTIONS;
}
`,
  );

  await escrever(
    base,
    "contratos/monitoring_pipeline.sema",
    `module legado.firebase.monitoring {
  task inventariar_colecoes_monitoramento {
    output {
      collections: Json
    }
    effects {
      consulta runtime criticidade = baixa
    }
    impl {
      ts: src.sema_contract_bridge.semaCollectionNames
    }
    guarantees {
      collections existe
    }
  }

  task registrar_sessao_telegram {
    input {
      registro: Json required
    }
    output {
      registro: Json
    }
    effects {
      persiste telegram_sessions criticidade = alta
      evento telegram_auth criticidade = alta
    }
    impl {
      ts: src.sema_contract_bridge.semaTelegramSessionRecord
    }
    guarantees {
      registro existe
    }
  }
}
`,
  );

  await escrever(
    base,
    "contratos/worker_runtime.sema",
    `module legado.firebase.worker_runtime {
  task publicar_payload_health {
    output {
      status: Texto
      timestamp: Texto
    }
    effects {
      evento payload_health criticidade = alta
    }
    impl {
      ts: src.sema_contract_bridge.semaWorkerHealthPayload
    }
    guarantees {
      status existe
      timestamp existe
    }
  }

  route get_health_worker {
    metodo: GET
    caminho: /health
    task: publicar_payload_health
  }
}
`,
  );
}

export async function criarProjetoFlutterConsumer(base: string): Promise<void> {
  await Promise.all([
    mkdir(path.join(base, "contratos"), { recursive: true }),
    mkdir(path.join(base, "lib", "screens"), { recursive: true }),
  ]);

  await escrever(
    base,
    "sema.config.json",
    JSON.stringify({
      origens: ["./contratos"],
      diretoriosCodigo: ["./lib"],
      fontesLegado: ["flutter-consumer", "dart"],
      modoAdocao: "incremental",
      modoEstrito: true,
    }, null, 2),
  );

  await escrever(
    base,
    "pubspec.yaml",
    `name: fixture_flutter_consumer_sema
publish_to: "none"

environment:
  sdk: ">=3.3.0 <4.0.0"

dependencies:
  flutter:
    sdk: flutter
  go_router: ^14.0.0
`,
  );

  await escrever(
    base,
    "lib/sema_consumer_bridge.dart",
    `Future<Map<String, dynamic>> semaFetchShowroomRanking() async {
  return {
    "ranking": [
      {"clube": "Tigres do Norte", "pontos": 33},
      {"clube": "Porto Azul", "pontos": 31},
      {"clube": "Galo de Ouro", "pontos": 28},
    ],
  };
}

Future<Map<String, dynamic>> semaLoadRankingSummary() async {
  return {
    "totalClubes": 3,
    "atualizadoEm": "2026-03-31T12:00:00.000Z",
  };
}
`,
  );

  await escrever(
    base,
    "lib/router.dart",
    `import "package:go_router/go_router.dart";
import "package:flutter/widgets.dart";
import "screens/ranking_screen.dart";

final appRouter = GoRouter(
  routes: [
    GoRoute(
      path: "/ranking",
      builder: (BuildContext context, GoRouterState state) => const RankingScreen(),
    ),
  ],
);
`,
  );

  await escrever(
    base,
    "lib/screens/ranking_screen.dart",
    `import "package:flutter/widgets.dart";
import "../sema_consumer_bridge.dart";

class RankingScreen extends StatefulWidget {
  const RankingScreen({super.key});

  @override
  State<RankingScreen> createState() => _RankingScreenState();
}

class _RankingScreenState extends State<RankingScreen> {
  List<Map<String, dynamic>> ranking = const [];

  @override
  void initState() {
    super.initState();
    semaFetchShowroomRanking().then((payload) {
      final itens = (payload["ranking"] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .toList();
      if (!mounted) return;
      setState(() {
        ranking = itens;
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      children: ranking
          .map((item) => Text("\${item["clube"]} - \${item["pontos"]} pts"))
          .toList(),
    );
  }
}
`,
  );

  await escrever(
    base,
    "lib/main.dart",
    `import "package:flutter/material.dart";
import "router.dart";

void main() {
  runApp(const ShowroomApp());
}

class ShowroomApp extends StatelessWidget {
  const ShowroomApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      routerConfig: appRouter,
    );
  }
}
`,
  );

  await escrever(
    base,
    "contratos/showroom_consumer.sema",
    `module showroom.consumer {
  task fetch_showroom_ranking {
    input {
    }
    output {
      resultado: Json
    }
    impl {
      dart: lib.sema_consumer_bridge.semaFetchShowroomRanking
    }
    vinculos {
      arquivo: "lib/sema_consumer_bridge.dart"
      simbolo: lib.sema_consumer_bridge.semaFetchShowroomRanking
      superficie: "/ranking"
      arquivo: "lib/router.dart"
      arquivo: "lib/screens/ranking_screen.dart"
    }
    guarantees {
      resultado existe
    }
  }
}
`,
  );
}

export async function criarProjetoBridgeDart(base: string): Promise<void> {
  await Promise.all([
    mkdir(path.join(base, "contratos"), { recursive: true }),
    mkdir(path.join(base, "lib", "api"), { recursive: true }),
  ]);

  await escrever(
    base,
    "sema.config.json",
    JSON.stringify({
      origens: ["./contratos"],
      diretoriosCodigo: ["./lib"],
      modoAdocao: "incremental",
      modoEstrito: true,
    }, null, 2),
  );

  await escrever(
    base,
    "lib/api/sema_contract_bridge.dart",
    `Future<Map<String, dynamic>> semaFetchShowroomRanking() async {
  return {"status": "ok"};
}

Future<Map<String, dynamic>> semaCheckForUpdate() async {
  return {"version": "1.0.0"};
}
`,
  );

  await escrever(
    base,
    "contratos/consumer_bridge.sema",
    `module legado.dart.consumer {
  task fetch_showroom_ranking {
    output {
      resultado: Json
    }
    impl {
      dart: lib.api.sema_contract_bridge.semaFetchShowroomRanking
    }
    guarantees {
      resultado existe
    }
  }

  task check_for_update {
    output {
      resultado: Json
    }
    impl {
      dart: lib.api.sema_contract_bridge.semaCheckForUpdate
    }
    guarantees {
      resultado existe
    }
  }
}
`,
  );
}

export async function criarProjetoDotnetAspNet(base: string): Promise<void> {
  await Promise.all([
    mkdir(path.join(base, "contratos"), { recursive: true }),
    mkdir(path.join(base, "src", "Controllers"), { recursive: true }),
    mkdir(path.join(base, "src", "Minimal"), { recursive: true }),
  ]);

  await escrever(
    base,
    "sema.config.json",
    JSON.stringify({
      origens: ["./contratos"],
      diretoriosCodigo: ["./src"],
      fontesLegado: ["dotnet"],
      modoAdocao: "incremental",
      modoEstrito: true,
    }, null, 2),
  );

  await escrever(
    base,
    "src/Controllers/HealthController.cs",
    `using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/health")]
public class HealthController : ControllerBase
{
    [HttpGet("{id:int}")]
    public HealthPayload Get(int id)
    {
        return new HealthPayload { Status = "ok", Runtime = "aspnet" };
    }
}

public class HealthPayload
{
    public string Status { get; set; } = "";
    public string Runtime { get; set; } = "";
}
`,
  );

  await escrever(
    base,
    "src/Minimal/Program.cs",
    `var app = WebApplication.CreateBuilder(args).Build();
app.MapPost("/api/minimal/ping", Ping);

static object Ping()
{
    return new { status = "pong" };
}
`,
  );

  await escrever(
    base,
    "contratos/http.sema",
    `module legado.dotnet.http {
  task get_health {
    input {
      id: Inteiro required
    }
    output {
      resultado: Json
    }
    impl {
      cs: src.controllers.health_controller.HealthController.Get
    }
    guarantees {
      resultado existe
    }
  }

  task ping {
    output {
      resultado: Json
    }
    impl {
      cs: src.minimal.program.Ping
    }
    guarantees {
      resultado existe
    }
  }

  route get_health_publico {
    metodo: GET
    caminho: "/api/health/{id}"
    task: get_health
  }

  route ping_publico {
    metodo: POST
    caminho: /api/minimal/ping
    task: ping
  }
}
`,
  );
}

export async function criarProjetoSpringBoot(base: string): Promise<void> {
  await Promise.all([
    mkdir(path.join(base, "contratos"), { recursive: true }),
    mkdir(path.join(base, "src", "main", "java", "com", "acme", "health"), { recursive: true }),
  ]);

  await escrever(
    base,
    "sema.config.json",
    JSON.stringify({
      origens: ["./contratos"],
      diretoriosCodigo: ["./src"],
      fontesLegado: ["java"],
      modoAdocao: "incremental",
      modoEstrito: true,
    }, null, 2),
  );

  await escrever(
    base,
    "src/main/java/com/acme/health/HealthController.java",
    `package com.acme.health;

import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/health")
public class HealthController {
    @GetMapping("/{id}")
    public Map<String, String> show(@PathVariable Integer id) {
        return Map.of("status", "ok", "runtime", "spring");
    }

    @PostMapping("/refresh")
    public Map<String, String> refresh() {
        return Map.of("status", "refreshed");
    }
}
`,
  );

  await escrever(
    base,
    "contratos/http.sema",
    `module legado.java.http {
  task show {
    input {
      id: Inteiro required
    }
    output {
      resultado: Json
    }
    impl {
      java: src.main.java.com.acme.health.health_controller.HealthController.show
    }
    guarantees {
      resultado existe
    }
  }

  task refresh {
    output {
      resultado: Json
    }
    impl {
      java: src.main.java.com.acme.health.health_controller.HealthController.refresh
    }
    guarantees {
      resultado existe
    }
  }

  route show_publico {
    metodo: GET
    caminho: "/api/health/{id}"
    task: show
  }

  route refresh_publico {
    metodo: POST
    caminho: /api/health/refresh
    task: refresh
  }
}
`,
  );
}

export async function criarProjetoGoHttp(base: string): Promise<void> {
  await Promise.all([
    mkdir(path.join(base, "contratos"), { recursive: true }),
    mkdir(path.join(base, "internal"), { recursive: true }),
  ]);

  await escrever(
    base,
    "sema.config.json",
    JSON.stringify({
      origens: ["./contratos"],
      diretoriosCodigo: ["./internal"],
      fontesLegado: ["go"],
      modoAdocao: "incremental",
      modoEstrito: true,
    }, null, 2),
  );

  await escrever(
    base,
    "internal/routes.go",
    `package internal

import "github.com/gin-gonic/gin"

func register(router *gin.Engine) {
    router.GET("/health/:id", getHealth)
    router.POST("/health/refresh", refreshHealth)
}

func getHealth(ctx *gin.Context) {
    ctx.JSON(200, gin.H{"status": "ok"})
}

func refreshHealth(ctx *gin.Context) {
    ctx.JSON(200, gin.H{"status": "refreshed"})
}
`,
  );

  await escrever(
    base,
    "contratos/http.sema",
    `module legado.go.http {
  task get_health {
    input {
      id: Texto required
    }
    output {
      resultado: Json
    }
    impl {
      go: internal.routes.getHealth
    }
    guarantees {
      resultado existe
    }
  }

  task refresh_health {
    output {
      resultado: Json
    }
    impl {
      go: internal.routes.refreshHealth
    }
    guarantees {
      resultado existe
    }
  }

  route get_health_publico {
    metodo: GET
    caminho: "/health/{id}"
    task: get_health
  }

  route refresh_health_publico {
    metodo: POST
    caminho: /health/refresh
    task: refresh_health
  }
}
`,
  );
}

export async function criarProjetoRustAxum(base: string): Promise<void> {
  await Promise.all([
    mkdir(path.join(base, "contratos"), { recursive: true }),
    mkdir(path.join(base, "src"), { recursive: true }),
  ]);

  await escrever(
    base,
    "sema.config.json",
    JSON.stringify({
      origens: ["./contratos"],
      diretoriosCodigo: ["./src"],
      fontesLegado: ["rust"],
      modoAdocao: "incremental",
      modoEstrito: true,
    }, null, 2),
  );

  await escrever(
    base,
    "src/main.rs",
    `use axum::{routing::{get, post}, Router};

mod handlers;

fn app() -> Router {
    Router::new()
        .route("/health/{id}", get(handlers::health))
        .route("/health/refresh", post(handlers::refresh))
}
`,
  );

  await escrever(
    base,
    "src/handlers.rs",
    `pub async fn health() -> &'static str {
    "ok"
}

pub async fn refresh() -> &'static str {
    "refreshed"
}
`,
  );

  await escrever(
    base,
    "contratos/http.sema",
    `module legado.rust.http {
  task health {
    input {
      id: Texto required
    }
    output {
      resultado: Json
    }
    impl {
      rust: src.handlers.health
    }
    guarantees {
      resultado existe
    }
  }

  task refresh {
    output {
      resultado: Json
    }
    impl {
      rust: src.handlers.refresh
    }
    guarantees {
      resultado existe
    }
  }

  route health_publico {
    metodo: GET
    caminho: "/health/{id}"
    task: health
  }

  route refresh_publico {
    metodo: POST
    caminho: /health/refresh
    task: refresh
  }
}
`,
  );
}

export async function criarProjetoCppBridge(base: string): Promise<void> {
  await Promise.all([
    mkdir(path.join(base, "contratos"), { recursive: true }),
    mkdir(path.join(base, "src"), { recursive: true }),
  ]);

  await escrever(
    base,
    "sema.config.json",
    JSON.stringify({
      origens: ["./contratos"],
      diretoriosCodigo: ["./src"],
      fontesLegado: ["cpp"],
      modoAdocao: "incremental",
      modoEstrito: true,
    }, null, 2),
  );

  await escrever(
    base,
    "src/runtime.cpp",
    `class RuntimeBridge {
public:
    int processSnapshot(int payload) {
        return payload;
    }
};

int emitSignal(int code) {
    return code;
}
`,
  );

  await escrever(
    base,
    "contratos/runtime_bridge.sema",
    `module legado.cpp.bridge {
  task process_snapshot {
    input {
      payload: Inteiro required
    }
    output {
      resultado: Json
    }
    impl {
      cpp: src.runtime.RuntimeBridge.processSnapshot
    }
    guarantees {
      resultado existe
    }
  }

  task emit_signal {
    input {
      code: Inteiro required
    }
    output {
      resultado: Json
    }
    impl {
      cpp: src.runtime.emitSignal
    }
    guarantees {
      resultado existe
    }
  }
}
`,
  );
}

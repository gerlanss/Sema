// SEMA-GOVERNED: sema.governanca_ia_contexto
// Descricao: fixture Futebot particionado; consulte contratos/sema/governanca_ia_contexto.sema antes de editar.

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { escreverFutebotFixture as escrever } from "./futebot-fixture.base.js";

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

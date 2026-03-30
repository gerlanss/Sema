from flask import Blueprint, jsonify, request

ranking_bp = Blueprint("ranking_bp", __name__, url_prefix="/api/ranking-showroom")


@ranking_bp.route("/", methods=["GET"])
def ranking_showroom():
    canal = request.args.get("canal", "home")
    return jsonify(
        {
            "vitrine_id": "showroom_home",
            "top_item_slug": "camera-smart-4k",
            "total_itens": 12,
            "atualizado_em": "2026-03-30",
            "canal": canal,
        }
    )


@ranking_bp.route("/<int:item_id>", methods=["GET"])
def ranking_item(item_id: int):
    return jsonify(
        {
            "item_id": str(item_id),
            "slug": f"item-{item_id}",
            "posicao": 1,
            "score": 98.4,
            "status": "ativo",
        }
    )


@ranking_bp.route("/sync", methods=["POST"])
def sync_ranking():
    payload = request.get_json(silent=True) or {}
    origem = payload.get("origem", "catalogo")
    return jsonify(
        {
            "execucao_id": "sync_20260330",
            "itens_processados": 12,
            "status_sync": "concluido",
            "origem": origem,
        }
    ), 202

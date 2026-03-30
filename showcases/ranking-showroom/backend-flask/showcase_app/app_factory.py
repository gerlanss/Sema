from flask import Flask, jsonify

from showcase_app.routes.api_ranking import ranking_bp


def create_app() -> Flask:
    app = Flask(__name__)

    @app.route("/health", methods=["GET"])
    def health():
        return jsonify({"status": "ok", "servico": "ranking-showroom"})

    app.register_blueprint(ranking_bp)
    return app

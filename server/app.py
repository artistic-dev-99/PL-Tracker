from flask import Flask, jsonify
from flask_cors import CORS
import signal
import sys
from config import Config
from db import init_db
from logger import logger

from controllers.system_controller import system_bp
from controllers.auth_controller import auth_bp
from controllers.users_controller import users_bp
from controllers.entries_controller import entries_bp
from controllers.excel_controller import excel_bp

def create_app(db_path=None):
    app = Flask(__name__, static_folder='../client/static', static_url_path='')
    app.config.from_object(Config)

    if db_path:
        app.config["PL_TRACKER_DB"] = db_path
    else:
        db_path = app.config["PL_TRACKER_DB"]

    # Enable CORS
    CORS(app)

    # Initialize Database Schema & Migrations
    init_db(db_path)

    # Static index route
    @app.route("/")
    def index():
        return app.send_static_file("index.html")

    # Register Blueprints
    app.register_blueprint(system_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(users_bp)
    app.register_blueprint(entries_bp)
    app.register_blueprint(excel_bp)

    # Global Error Handling Middleware
    @app.errorhandler(404)
    def not_found_error(error):
        return jsonify({"status": "error", "message": "Resource not found"}), 404

    @app.errorhandler(500)
    def internal_error(error):
        logger.error(f"Unhandled 500 server error: {str(error)}")
        return jsonify({"status": "error", "message": "Internal server error occurred"}), 500

    @app.errorhandler(Exception)
    def handle_unexpected_error(e):
        logger.error(f"Unexpected exception: {str(e)}", exc_info=True)
        return jsonify({"status": "error", "message": str(e)}), 500

    return app

def handle_shutdown_signals(sig, frame):
    logger.info(f"Received shutdown signal ({sig}). Closing application gracefully...")
    sys.exit(0)

# Register Graceful Shutdown signals
signal.signal(signal.SIGINT, handle_shutdown_signals)
signal.signal(signal.SIGTERM, handle_shutdown_signals)

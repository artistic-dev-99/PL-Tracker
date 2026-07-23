from flask import Blueprint, jsonify, request, send_file, current_app
import os
from db import get_db_connection, init_db
from config import Config
from logger import logger

system_bp = Blueprint("system", __name__)

def get_db_path():
    return current_app.config.get("PL_TRACKER_DB") or Config.PL_TRACKER_DB

@system_bp.route("/health", methods=["GET"])
def health_check():
    return jsonify({
        "status": "healthy",
        "service": "PL Tracker 2 API",
        "version": "2.0.0"
    }), 200

@system_bp.route("/api/db-status", methods=["GET"])
def db_status():
    try:
        db_p = get_db_path()
        conn = get_db_connection(db_p)
        user_count = conn.execute("SELECT COUNT(*) FROM users;").fetchone()[0]
        conn.close()
        return jsonify({
            "status": "ok",
            "db_empty": user_count == 0
        })
    except Exception as e:
        logger.error(f"Database status check failed: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

@system_bp.route("/api/diagnostics/db-size", methods=["GET"])
def db_size():
    try:
        db_p = get_db_path()
        if os.path.exists(db_p):
            size_bytes = os.path.getsize(db_p)
            size_kb = round(size_bytes / 1024, 2)
            return jsonify({"status": "success", "size_kb": size_kb, "size_bytes": size_bytes})
        return jsonify({"status": "success", "size_kb": 0, "size_bytes": 0})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@system_bp.route("/api/diagnostics/backup", methods=["GET"])
def download_backup():
    try:
        db_p = get_db_path()
        if os.path.exists(db_p):
            return send_file(db_p, as_attachment=True, download_name=os.path.basename(db_p))
        return jsonify({"status": "error", "message": "Database file not found"}), 404
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

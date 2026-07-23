from flask import Blueprint, request, jsonify, current_app
from services.excel_service import import_excel_data
from config import Config

excel_bp = Blueprint("excel", __name__)

def get_db_path():
    return current_app.config.get("PL_TRACKER_DB") or Config.PL_TRACKER_DB

@excel_bp.route("/api/admin/import-excel", methods=["POST"])
def import_excel_route():
    admin_userid = request.form.get("userid")
    if not admin_userid:
        return jsonify({"status": "error", "message": "Missing userid parameter"}), 400

    if "file" not in request.files:
        return jsonify({"status": "error", "message": "No Excel file provided"}), 400

    file = request.files["file"]
    if not file.filename or not (file.filename.endswith(".xlsm") or file.filename.endswith(".xlsx")):
        return jsonify({"status": "error", "message": "File must be an Excel file (.xlsm or .xlsx)"}), 400

    file_bytes = file.read()
    source_ip = request.remote_addr or "127.0.0.1"

    res, err, status_code = import_excel_data(file_bytes, admin_userid, source_ip, get_db_path())
    if err:
        return jsonify({"status": "error", "message": err}), status_code
    return jsonify(res), status_code

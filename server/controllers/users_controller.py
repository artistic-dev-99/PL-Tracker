from flask import Blueprint, request, jsonify, current_app
from services.user_service import get_users_list, update_user_heartbeat, update_user_account, delete_user_account, toggle_user_status
from config import Config

users_bp = Blueprint("users", __name__)

def get_db_path():
    return current_app.config.get("PL_TRACKER_DB") or Config.PL_TRACKER_DB

@users_bp.route("/api/users/list", methods=["GET"])
def list_users():
    users, err = get_users_list(get_db_path())
    if err:
        return jsonify({"status": "error", "message": err}), 500
    return jsonify(users), 200

@users_bp.route("/api/users/heartbeat", methods=["POST"])
def heartbeat():
    data = request.json or {}
    userid = data.get("userid")
    if not userid:
        return jsonify({"status": "error", "message": "Missing userid"}), 400
    success, err = update_user_heartbeat(userid, get_db_path())
    if not success:
        return jsonify({"status": "error", "message": err}), 500
    return jsonify({"status": "success"}), 200

@users_bp.route("/api/users/update", methods=["POST"])
def update_user():
    data = request.json or {}
    requesting_userid = data.get("requesting_userid")
    target_userid = data.get("target_userid")
    new_username = data.get("new_username", "").strip() if data.get("new_username") else None
    new_password = data.get("new_password")
    new_role = data.get("new_role")

    if not requesting_userid or not target_userid:
        return jsonify({"status": "error", "message": "Missing requesting_userid or target_userid"}), 400

    res, err, status_code = update_user_account(requesting_userid, target_userid, new_username, new_password, new_role, get_db_path())
    if err:
        return jsonify({"status": "error", "message": err}), status_code
    return jsonify(res), status_code

@users_bp.route("/api/users/delete", methods=["DELETE"])
def delete_user():
    data = request.json or {}
    requesting_userid = data.get("requesting_userid")
    target_userid = data.get("target_userid")
    delete_entries = data.get("delete_entries", False)

    if not requesting_userid or not target_userid:
        return jsonify({"status": "error", "message": "Missing requesting_userid or target_userid"}), 400

    res, err, status_code = delete_user_account(requesting_userid, target_userid, delete_entries, get_db_path())
    if err:
        return jsonify({"status": "error", "message": err}), status_code
    return jsonify(res), status_code

@users_bp.route("/api/users/toggle-status", methods=["POST"])
def toggle_status():
    data = request.json or {}
    requesting_userid = data.get("requesting_userid")
    target_userid = data.get("target_userid")
    new_status = data.get("new_status")

    if not requesting_userid or not target_userid or not new_status:
        return jsonify({"status": "error", "message": "Missing parameters"}), 400

    res, err, status_code = toggle_user_status(requesting_userid, target_userid, new_status, get_db_path())
    if err:
        return jsonify({"status": "error", "message": err}), status_code
    return jsonify(res), status_code

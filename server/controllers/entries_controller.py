from flask import Blueprint, request, jsonify, current_app
from services.entry_service import create_entry, query_entries, update_entry, delete_entries
from utils.validators import validate_work_order, validate_pack_no, validate_timestamp, validate_mode
from config import Config
from logger import logger

entries_bp = Blueprint("entries", __name__)

def get_db_path():
    return current_app.config.get("PL_TRACKER_DB") or Config.PL_TRACKER_DB

@entries_bp.route("/api/entries/submit", methods=["POST"])
def submit_entry_route():
    data = request.json or {}
    userid = data.get("userid")
    work_order_raw = data.get("work_order")
    pack_no_raw = data.get("pack_no")
    pl_type = data.get("pl_type")
    sub_pl_type = data.get("sub_pl_type")
    location = data.get("location")
    customer = data.get("customer")
    mode = validate_mode(data.get("mode"))
    timestamp_raw = data.get("timestamp")
    source_ip = request.remote_addr or "127.0.0.1"

    if not all([userid, work_order_raw, pack_no_raw, pl_type, sub_pl_type, location, customer, timestamp_raw]):
        return jsonify({"status": "error", "message": "Missing required fields"}), 400

    work_order, err_wo = validate_work_order(work_order_raw)
    if err_wo:
        return jsonify({"status": "error", "message": err_wo}), 400

    pack_no, err_pack = validate_pack_no(pack_no_raw)
    if err_pack:
        return jsonify({"status": "error", "message": err_pack}), 400

    timestamp, err_ts = validate_timestamp(timestamp_raw)
    if err_ts:
        return jsonify({"status": "error", "message": err_ts}), 400

    res, err, status_code = create_entry(userid, work_order, pack_no, pl_type, sub_pl_type, location, customer, mode, timestamp, source_ip, get_db_path())
    if err:
        return jsonify({"status": "error", "message": err}), status_code
    return jsonify(res), status_code

@entries_bp.route("/api/entries/query", methods=["GET"])
def query_entries_route():
    filters = {
        "work_order": request.args.get("work_order"),
        "pack_no": request.args.get("pack_no"),
        "pl_type": request.args.get("pl_type"),
        "sub_pl_type": request.args.get("sub_pl_type"),
        "location": request.args.get("location"),
        "customer": request.args.get("customer"),
        "mode": request.args.get("mode"),
        "userid": request.args.get("userid"),
        "start_date": request.args.get("start_date"),
        "end_date": request.args.get("end_date")
    }
    results, err, status_code = query_entries(filters, get_db_path())
    if err:
        return jsonify({"status": "error", "message": err}), status_code
    return jsonify(results), status_code

@entries_bp.route("/api/entries/update", methods=["PUT"])
def update_entry_route():
    data = request.json or {}
    requesting_userid = data.get("requesting_userid")
    entry_id = data.get("entry_id")
    work_order_raw = data.get("work_order")
    pack_no_raw = data.get("pack_no")
    pl_type = data.get("pl_type")
    sub_pl_type = data.get("sub_pl_type")
    location = data.get("location")
    customer = data.get("customer")
    mode = validate_mode(data.get("mode"))
    timestamp_raw = data.get("timestamp")

    if not all([requesting_userid, entry_id, work_order_raw, pack_no_raw, pl_type, sub_pl_type, location, customer, timestamp_raw]):
        return jsonify({"status": "error", "message": "Missing required fields"}), 400

    work_order, err_wo = validate_work_order(work_order_raw)
    if err_wo:
        return jsonify({"status": "error", "message": err_wo}), 400

    pack_no, err_pack = validate_pack_no(pack_no_raw)
    if err_pack:
        return jsonify({"status": "error", "message": err_pack}), 400

    timestamp, err_ts = validate_timestamp(timestamp_raw)
    if err_ts:
        return jsonify({"status": "error", "message": err_ts}), 400

    res, err, status_code = update_entry(requesting_userid, entry_id, work_order, pack_no, pl_type, sub_pl_type, location, customer, mode, timestamp, get_db_path())
    if err:
        return jsonify({"status": "error", "message": err}), status_code
    return jsonify(res), status_code

@entries_bp.route("/api/entries/delete", methods=["DELETE"])
def delete_entries_route():
    data = request.json or {}
    requesting_userid = data.get("requesting_userid")
    entry_id = data.get("entry_id")
    entry_ids = data.get("entry_ids")

    if not entry_ids and entry_id:
        entry_ids = [entry_id]

    if not requesting_userid or not entry_ids:
        return jsonify({"status": "error", "message": "Missing requesting_userid or entry_ids"}), 400

    res, err, status_code = delete_entries(requesting_userid, entry_ids, get_db_path())
    if err:
        return jsonify({"status": "error", "message": err}), status_code
    return jsonify(res), status_code

from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import os
import bcrypt
import threading
import io
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from db import get_db_connection, init_db

app = Flask(__name__, static_folder='../client/static', static_url_path='')
CORS(app) # Enable CORS for all routes

@app.route("/")
def index():
    return app.send_static_file("index.html")

DB_PATH = os.environ.get("PL_TRACKER_DB", "pl_tracker.db")
db_lock = threading.Lock()

# Initialize DB on start
init_db(DB_PATH)

def get_user_by_username(username):
    conn = get_db_connection(DB_PATH)
    try:
        user = conn.execute("SELECT * FROM users WHERE Username = ?;", (username,)).fetchone()
        return user
    finally:
        conn.close()

def check_auth(username, password):
    user = get_user_by_username(username)
    if not user:
        return None, "username"
    
    # Check password
    hashed = user["PasswordHash"]
    if bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8')):
        return user, None
    else:
        return None, "password"

@app.route("/api/db-status", methods=["GET"])
def db_status():
    try:
        conn = get_db_connection(DB_PATH)
        user_count = conn.execute("SELECT COUNT(*) FROM users;").fetchone()[0]
        conn.close()
        return jsonify({
            "status": "ok",
            "db_empty": user_count == 0
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

@app.route("/api/auth/setup", methods=["POST"])
def auth_setup():
    data = request.json or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return jsonify({"status": "error", "message": "Username and password are required"}), 400

    with db_lock:
        conn = get_db_connection(DB_PATH)
        try:
            # Verify if db is indeed empty
            user_count = conn.execute("SELECT COUNT(*) FROM users;").fetchone()[0]
            if user_count > 0:
                return jsonify({"status": "error", "message": "Database is already initialized"}), 400

            # Hash password
            password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            conn.execute(
                "INSERT INTO users (Username, PasswordHash, Role) VALUES (?, ?, ?);",
                (username, password_hash, "Admin")
            )
            conn.commit()
            return jsonify({"status": "success", "message": "First Admin account created successfully"})
        except Exception as e:
            return jsonify({"status": "error", "message": str(e)}), 500
        finally:
            conn.close()

@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    data = request.json or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return jsonify({
            "status": "error",
            "error_type": "validation",
            "message": "Username and password are required"
        }), 400

    user, error_type = check_auth(username, password)
    if error_type == "username":
        return jsonify({
            "status": "error",
            "error_type": "username",
            "message": "User not found"
        }), 401
    elif error_type == "password":
        return jsonify({
            "status": "error",
            "error_type": "password",
            "message": "Incorrect password"
        }), 401

    if "Status" in user.keys() and user["Status"] == "Blocked":
        return jsonify({
            "status": "error",
            "error_type": "auth",
            "message": "This account is blocked. Contact administrator."
        }), 403

    return jsonify({
        "status": "success",
        "user": {
            "userid": user["UserID"],
            "username": user["Username"],
            "role": user["Role"]
        }
    })

@app.route("/api/auth/register", methods=["POST"])
def auth_register():
    data = request.json or {}
    requesting_userid = data.get("requesting_userid")
    admin_username = data.get("admin_username", "").strip()
    admin_password = data.get("admin_password", "")
    new_username = data.get("new_username", "").strip()
    new_password = data.get("new_password", "")
    new_role = data.get("new_role", "Local").strip()

    if not new_username or not new_password:
        return jsonify({"status": "error", "message": "Username and password are required"}), 400

    if new_role not in ("Admin", "Local"):
        return jsonify({"status": "error", "message": "Invalid role specified"}), 400

    conn = get_db_connection(DB_PATH)
    try:
        is_authorized = False
        if requesting_userid:
            req_user = conn.execute("SELECT Role FROM users WHERE UserID = ?;", (requesting_userid,)).fetchone()
            if req_user and req_user["Role"] == "Admin":
                is_authorized = True

        if not is_authorized and admin_username and admin_password:
            admin_user, err = check_auth(admin_username, admin_password)
            if not err and admin_user["Role"] == "Admin":
                is_authorized = True

        if not is_authorized:
            return jsonify({"status": "error", "message": "Admin authorization failed"}), 403

        with db_lock:
            existing = conn.execute("SELECT UserID FROM users WHERE LOWER(Username) = LOWER(?);", (new_username,)).fetchone()
            if existing:
                return jsonify({"status": "error", "message": f"Username '{new_username}' is already taken"}), 400

            new_hash = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            cursor = conn.execute(
                "INSERT INTO users (Username, PasswordHash, Role) VALUES (?, ?, ?);",
                (new_username, new_hash, new_role)
            )
            conn.commit()
            new_id = cursor.lastrowid
            return jsonify({
                "status": "success",
                "message": f"User '{new_username}' registered successfully",
                "user": {"userid": new_id, "username": new_username, "role": new_role}
            })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        conn.close()

@app.route("/api/entries/submit", methods=["POST"])
def entries_submit():
    data = request.json or {}
    userid = data.get("userid")
    work_order = data.get("work_order")
    pack_no = data.get("pack_no")
    pl_type = data.get("pl_type")
    sub_pl_type = data.get("sub_pl_type")
    location = data.get("location")
    customer = data.get("customer")
    mode = data.get("mode", "Manual")
    if mode not in ["Mail", "Manual"]:
        mode = "Manual"
    timestamp = data.get("timestamp") # Format: YYYY-MM-DD HH:MM:SS
    source_ip = request.remote_addr or "127.0.0.1"

    # Validation
    if not all([userid, work_order, pack_no, pl_type, sub_pl_type, location, customer, timestamp]):
        return jsonify({"status": "error", "message": "Missing required fields"}), 400

    try:
        work_order = int(work_order)
        pack_no = int(pack_no)
    except ValueError:
        return jsonify({"status": "error", "message": "Work Order and Pack No must be numeric"}), 400

    if work_order <= 200000000 or work_order >= 1000000000:
        return jsonify({"status": "error", "message": "Work Order must be a 9-digit number starting with > 200000000"}), 400
    if pack_no <= 40000 or pack_no >= 100000:
        return jsonify({"status": "error", "message": "Pack No must be a 5-digit number > 40000"}), 400

    # Format timestamp date
    try:
        dt = datetime.strptime(timestamp, "%Y-%m-%d %H:%M:%S")
        date_str = dt.strftime("%Y-%m-%d")
    except ValueError:
        return jsonify({"status": "error", "message": "Timestamp must follow YYYY-MM-DD HH:MM:SS format"}), 400

    with db_lock:
        conn = get_db_connection(DB_PATH)
        try:
            # Check user exists and get username
            user = conn.execute("SELECT Username FROM users WHERE UserID = ?;", (userid,)).fetchone()
            if not user:
                return jsonify({"status": "error", "message": "User not found"}), 404
            
            username = user["Username"]
            user_initial = username[0].upper() if username else 'X'

            # Begin transaction explicitly
            conn.execute("BEGIN TRANSACTION;")

            # 1 single combined query for sequence ID calculation (Ponytail optimization)
            counts_sql = """
                SELECT 
                    (SELECT COUNT(*) FROM entries) AS master_cnt,
                    (SELECT COUNT(*) FROM entries WHERE UserID = ?) AS user_cnt,
                    (SELECT COUNT(*) FROM entries WHERE SUBSTR(EntryTimestamp, 1, 10) = ?) AS daily_cnt,
                    (SELECT COUNT(*) FROM entries WHERE UserID = ? AND SUBSTR(EntryTimestamp, 1, 10) = ?) AS user_daily_cnt;
            """
            row = conn.execute(counts_sql, (userid, date_str, userid, date_str)).fetchone()

            master_unique_id = row["master_cnt"] + 1
            user_lifetime_count = row["user_cnt"] + 1
            unique_id_by_user = f"{user_initial}{user_lifetime_count:03d}"
            daily_count_id = row["daily_cnt"] + 1
            user_daily_count_id = row["user_daily_cnt"] + 1
            unique_id_by_day_by_user = f"{user_initial}{user_daily_count_id:03d}"

            # Insert Core Entry
            cursor = conn.execute("""
                INSERT INTO entries (UserID, WorkOrder, PackNo, PLType, SubPLType, Location, Customer, EntryTimestamp, SourcePC_IP, Mode)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """, (userid, work_order, pack_no, pl_type, sub_pl_type, location, customer, timestamp, source_ip, mode))
            entry_id = cursor.lastrowid

            # Insert ID Logic Tracking record
            conn.execute("""
                INSERT INTO user_daily_tracking (EntryID, MasterUniqueID, UniqueIDByUser, DailyCountID, UserDailyCountID, UniqueIDByDayByUser)
                VALUES (?, ?, ?, ?, ?, ?);
            """, (entry_id, master_unique_id, unique_id_by_user, daily_count_id, user_daily_count_id, unique_id_by_day_by_user))

            conn.commit()
            return jsonify({
                "status": "success",
                "entry": {
                    "entry_id": entry_id,
                    "master_unique_id": master_unique_id,
                    "unique_id_by_user": unique_id_by_user,
                    "daily_count_id": daily_count_id,
                    "user_daily_count_id": user_daily_count_id,
                    "unique_id_by_day_by_user": unique_id_by_day_by_user,
                    "mode": mode
                }
            })
        except Exception as e:
            conn.rollback()
            return jsonify({"status": "error", "message": str(e)}), 500
        finally:
            conn.close()

@app.route("/api/entries/query", methods=["GET"])
def entries_query():
    # Extracts filter params
    userid = request.args.get("userid")
    work_order = request.args.get("work_order")
    pack_no = request.args.get("pack_no")
    pl_type = request.args.get("pl_type")
    sub_pl_type = request.args.get("sub_pl_type")
    location = request.args.get("location")
    customer = request.args.get("customer")
    mode = request.args.get("mode")
    start_date = request.args.get("start_date") # YYYY-MM-DD
    end_date = request.args.get("end_date") # YYYY-MM-DD
    search_q = request.args.get("search_query") # global search query

    query = """
        SELECT e.*, u.Username, u.Role, 
               t.MasterUniqueID, t.UniqueIDByUser, t.DailyCountID, t.UserDailyCountID, t.UniqueIDByDayByUser
        FROM entries e
        JOIN users u ON e.UserID = u.UserID
        LEFT JOIN user_daily_tracking t ON e.EntryID = t.EntryID
        WHERE 1=1
    """
    params = []

    if userid:
        query += " AND e.UserID = ?"
        params.append(int(userid))
    if work_order:
        query += " AND e.WorkOrder = ?"
        params.append(int(work_order))
    if pack_no:
        query += " AND e.PackNo = ?"
        params.append(int(pack_no))
    if pl_type:
        query += " AND e.PLType = ?"
        params.append(pl_type)
    if sub_pl_type:
        query += " AND e.SubPLType = ?"
        params.append(sub_pl_type)
    if location:
        query += " AND e.Location = ?"
        params.append(location)
    if customer:
        query += " AND e.Customer = ?"
        params.append(customer)
    if mode:
        query += " AND e.Mode = ?"
        params.append(mode)
    if start_date:
        query += " AND SUBSTR(e.EntryTimestamp, 1, 10) >= ?"
        params.append(start_date)
    if end_date:
        query += " AND SUBSTR(e.EntryTimestamp, 1, 10) <= ?"
        params.append(end_date)
    if search_q:
        query += " AND (CAST(e.WorkOrder AS TEXT) LIKE ? OR CAST(e.PackNo AS TEXT) LIKE ? OR e.Location LIKE ? OR e.Customer LIKE ? OR u.Username LIKE ?)"
        term = f"%{search_q}%"
        params.extend([term, term, term, term, term])

    query += " ORDER BY e.EntryTimestamp DESC, e.EntryID DESC"

    conn = get_db_connection(DB_PATH)
    try:
        rows = conn.execute(query, params).fetchall()
        results = []
        for r in rows:
            mode_val = r["Mode"] if "Mode" in r.keys() and r["Mode"] else "Manual"
            results.append({
                "EntryID": r["EntryID"],
                "UserID": r["UserID"],
                "Username": r["Username"],
                "UserRole": r["Role"],
                "WorkOrder": r["WorkOrder"],
                "PackNo": r["PackNo"],
                "PLType": r["PLType"],
                "SubPLType": r["SubPLType"],
                "Location": r["Location"],
                "Customer": r["Customer"],
                "Mode": mode_val,
                "EntryTimestamp": r["EntryTimestamp"],
                "SourcePC_IP": r["SourcePC_IP"],
                "MasterUniqueID": r["MasterUniqueID"],
                "UniqueIDByUser": r["UniqueIDByUser"],
                "DailyCountID": r["DailyCountID"],
                "UserDailyCountID": r["UserDailyCountID"],
                "UniqueIDByDayByUser": r["UniqueIDByDayByUser"]
            })
        return jsonify(results)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        conn.close()

def has_edit_permission(requesting_userid, target_entry_id):
    conn = get_db_connection(DB_PATH)
    try:
        # Get user role
        user = conn.execute("SELECT Role FROM users WHERE UserID = ?;", (requesting_userid,)).fetchone()
        if not user:
            return False
        
        if user["Role"] == "Admin":
            return True

        # If Local user, check if entry belongs to them
        entry = conn.execute("SELECT UserID FROM entries WHERE EntryID = ?;", (target_entry_id,)).fetchone()
        if not entry:
            return False
        
        return entry["UserID"] == requesting_userid
    finally:
        conn.close()

def has_bulk_edit_permissions(requesting_userid, entry_ids):
    if not entry_ids:
        return True, None
    conn = get_db_connection(DB_PATH)
    try:
        user = conn.execute("SELECT Role FROM users WHERE UserID = ?;", (requesting_userid,)).fetchone()
        if not user:
            return False, "User not found"
        if user["Role"] == "Admin":
            return True, None

        placeholders = ",".join("?" for _ in entry_ids)
        rows = conn.execute(f"SELECT EntryID, UserID FROM entries WHERE EntryID IN ({placeholders});", tuple(entry_ids)).fetchall()
        
        found_ids = {r["EntryID"] for r in rows}
        for eid in entry_ids:
            if eid not in found_ids:
                return False, f"Entry ID {eid} not found"
        
        for r in rows:
            if r["UserID"] != int(requesting_userid):
                return False, f"Unauthorized to modify entry ID {r['EntryID']}"
        
        return True, None
    finally:
        conn.close()

@app.route("/api/entries/update", methods=["PUT"])
def entries_update():
    data = request.json or {}
    requesting_userid = data.get("requesting_userid")
    entry_id = data.get("entry_id")
    work_order = data.get("work_order")
    pack_no = data.get("pack_no")
    pl_type = data.get("pl_type")
    sub_pl_type = data.get("sub_pl_type")
    location = data.get("location")
    customer = data.get("customer")
    mode = data.get("mode", "Manual")
    if mode not in ["Mail", "Manual"]:
        mode = "Manual"
    timestamp = data.get("timestamp")

    if not all([requesting_userid, entry_id, work_order, pack_no, pl_type, sub_pl_type, location, customer, timestamp]):
        return jsonify({"status": "error", "message": "Missing fields"}), 400

    try:
        work_order = int(work_order)
        pack_no = int(pack_no)
    except ValueError:
        return jsonify({"status": "error", "message": "Work Order and Pack No must be numeric"}), 400

    if work_order <= 200000000 or work_order >= 1000000000:
        return jsonify({"status": "error", "message": "Work Order must be a 9-digit number starting with > 200000000"}), 400
    if pack_no <= 40000 or pack_no >= 100000:
        return jsonify({"status": "error", "message": "Pack No must be a 5-digit number > 40000"}), 400

    if not has_edit_permission(requesting_userid, entry_id):
        return jsonify({"status": "error", "message": "Unauthorized. You cannot modify entries of other users."}), 403

    with db_lock:
        conn = get_db_connection(DB_PATH)
        try:
            conn.execute("""
                UPDATE entries
                SET WorkOrder = ?, PackNo = ?, PLType = ?, SubPLType = ?, Location = ?, Customer = ?, EntryTimestamp = ?, Mode = ?
                WHERE EntryID = ?;
            """, (work_order, pack_no, pl_type, sub_pl_type, location, customer, timestamp, mode, entry_id))
            conn.commit()
            return jsonify({"status": "success", "message": "Entry updated successfully"})
        except Exception as e:
            return jsonify({"status": "error", "message": str(e)}), 500
        finally:
            conn.close()

@app.route("/api/entries/delete", methods=["DELETE"])
def entries_delete():
    data = request.json or {}
    requesting_userid = data.get("requesting_userid")
    entry_id = data.get("entry_id")

    if not requesting_userid or not entry_id:
        return jsonify({"status": "error", "message": "Missing fields"}), 400

    if not has_edit_permission(requesting_userid, entry_id):
        return jsonify({"status": "error", "message": "Unauthorized. You cannot delete entries of other users."}), 403

    with db_lock:
        conn = get_db_connection(DB_PATH)
        try:
            conn.execute("DELETE FROM entries WHERE EntryID = ?;", (entry_id,))
            conn.commit()
            return jsonify({"status": "success", "message": "Entry deleted successfully"})
        except Exception as e:
            return jsonify({"status": "error", "message": str(e)}), 500
        finally:
            conn.close()

@app.route("/api/entries/bulk-update", methods=["POST"])
def entries_bulk_update():
    data = request.json or {}
    requesting_userid = data.get("requesting_userid")
    updates = data.get("updates", []) # list of entry updates

    if not requesting_userid or not updates:
        return jsonify({"status": "error", "message": "Missing requesting_userid or updates list"}), 400

    # Batch verify permissions on all entries
    entry_ids = [entry.get("entry_id") for entry in updates]
    allowed, err_msg = has_bulk_edit_permissions(requesting_userid, entry_ids)
    if not allowed:
        return jsonify({"status": "error", "message": err_msg}), 403

    with db_lock:
        conn = get_db_connection(DB_PATH)
        try:
            conn.execute("BEGIN TRANSACTION;")
            for entry in updates:
                eid = entry.get("entry_id")
                wo = int(entry.get("work_order"))
                pn = int(entry.get("pack_no"))
                plt = entry.get("pl_type")
                subplt = entry.get("sub_pl_type")
                loc = entry.get("location")
                cust = entry.get("customer")
                ts = entry.get("timestamp")
                mode_val = entry.get("mode", "Manual")
                if mode_val not in ["Mail", "Manual"]:
                    mode_val = "Manual"
                conn.execute("""
                    UPDATE entries
                    SET WorkOrder = ?, PackNo = ?, PLType = ?, SubPLType = ?, Location = ?, Customer = ?, EntryTimestamp = ?, Mode = ?
                    WHERE EntryID = ?;
                """, (wo, pn, plt, subplt, loc, cust, ts, mode_val, eid))
            conn.commit()
            return jsonify({"status": "success", "message": f"Successfully updated {len(updates)} entries"})
        except Exception as e:
            conn.rollback()
            return jsonify({"status": "error", "message": str(e)}), 500
        finally:
            conn.close()

@app.route("/api/entries/bulk-delete", methods=["POST"])
def entries_bulk_delete():
    data = request.json or {}
    requesting_userid = data.get("requesting_userid")
    entry_ids = data.get("entry_ids", [])

    if not requesting_userid or not entry_ids:
        return jsonify({"status": "error", "message": "Missing requesting_userid or entry_ids list"}), 400

    # Batch verify permissions on all entries
    allowed, err_msg = has_bulk_edit_permissions(requesting_userid, entry_ids)
    if not allowed:
        return jsonify({"status": "error", "message": err_msg}), 403

    with db_lock:
        conn = get_db_connection(DB_PATH)
        try:
            conn.execute("BEGIN TRANSACTION;")
            placeholders = ",".join("?" for _ in entry_ids)
            conn.execute(f"DELETE FROM entries WHERE EntryID IN ({placeholders});", tuple(entry_ids))
            conn.commit()
            return jsonify({"status": "success", "message": f"Successfully deleted {len(entry_ids)} entries"})
        except Exception as e:
            conn.rollback()
            return jsonify({"status": "error", "message": str(e)}), 500
        finally:
            conn.close()

@app.route("/api/users/heartbeat", methods=["POST"])
def users_heartbeat():
    data = request.json or {}
    userid = data.get("userid")
    if not userid:
        return jsonify({"status": "error", "message": "Missing userid"}), 400
    conn = get_db_connection(DB_PATH)
    try:
        conn.execute("UPDATE users SET LastActive = CURRENT_TIMESTAMP WHERE UserID = ?;", (userid,))
        conn.commit()
        return jsonify({"status": "success"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        conn.close()

@app.route("/api/users/list", methods=["GET"])
def users_list():
    conn = get_db_connection(DB_PATH)
    try:
        rows = conn.execute("SELECT UserID, Username, Role, Status, CreatedAt, LastActive FROM users;").fetchall()
        now = datetime.now()
        users = []
        for r in rows:
            last_active_str = r["LastActive"] if "LastActive" in r.keys() else None
            online_status = "Offline"
            is_online = False
            if last_active_str:
                try:
                    last_dt = datetime.strptime(last_active_str, "%Y-%m-%d %H:%M:%S")
                    diff_seconds = (now - last_dt).total_seconds()
                    if diff_seconds < 180:
                        online_status = "Working Now"
                        is_online = True
                    elif diff_seconds < 600:
                        online_status = "Idle"
                        is_online = True
                except Exception:
                    pass
            users.append({
                "UserID": r["UserID"],
                "Username": r["Username"],
                "Role": r["Role"],
                "Status": r["Status"] if r["Status"] else "Active",
                "CreatedAt": r["CreatedAt"],
                "LastActive": r["LastActive"] if "LastActive" in r.keys() else None,
                "is_online": is_online,
                "online_status": online_status
            })
        return jsonify(users)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        conn.close()

@app.route("/api/users/toggle-status", methods=["POST"])
def users_toggle_status():
    data = request.json or {}
    requesting_userid = data.get("requesting_userid")
    target_userid = data.get("target_userid")
    new_status = data.get("new_status")

    if not requesting_userid or not target_userid or not new_status:
        return jsonify({"status": "error", "message": "Missing parameters"}), 400

    if new_status not in ["Active", "Blocked"]:
        return jsonify({"status": "error", "message": "Invalid status value"}), 400

    conn = get_db_connection(DB_PATH)
    try:
        admin_user = conn.execute("SELECT Role FROM users WHERE UserID = ?;", (requesting_userid,)).fetchone()
        if not admin_user or admin_user["Role"] != "Admin":
            return jsonify({"status": "error", "message": "Admin privileges required"}), 403

        if int(requesting_userid) == int(target_userid):
            return jsonify({"status": "error", "message": "You cannot modify your own status"}), 400

        with db_lock:
            conn.execute("UPDATE users SET Status = ? WHERE UserID = ?;", (new_status, target_userid))
            conn.commit()
            return jsonify({"status": "success", "message": f"User status changed to {new_status}"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        conn.close()

@app.route("/api/users/update", methods=["POST"])
def users_update():
    data = request.json or {}
    requesting_userid = data.get("requesting_userid")
    target_userid = data.get("target_userid")
    new_username = data.get("new_username", "").strip() if data.get("new_username") else None
    new_password = data.get("new_password")
    new_role = data.get("new_role")

    if not requesting_userid or not target_userid:
        return jsonify({"status": "error", "message": "Missing requesting_userid or target_userid"}), 400

    conn = get_db_connection(DB_PATH)
    try:
        req_user = conn.execute("SELECT Role FROM users WHERE UserID = ?;", (requesting_userid,)).fetchone()
        if not req_user:
            return jsonify({"status": "error", "message": "Requesting user not found"}), 404
        
        is_admin = (req_user["Role"] == "Admin")
        is_self = (int(requesting_userid) == int(target_userid))

        if not is_admin and not is_self:
            return jsonify({"status": "error", "message": "Unauthorized to update this user account"}), 403

        target_user = conn.execute("SELECT * FROM users WHERE UserID = ?;", (target_userid,)).fetchone()
        if not target_user:
            return jsonify({"status": "error", "message": "Target user not found"}), 404

        with db_lock:
            conn.execute("BEGIN TRANSACTION;")

            # 1. Update Username if provided & changed
            if new_username and new_username.lower() != target_user["Username"].lower():
                existing = conn.execute("SELECT UserID FROM users WHERE LOWER(Username) = LOWER(?) AND UserID != ?;", (new_username, target_userid)).fetchone()
                if existing:
                    conn.rollback()
                    return jsonify({"status": "error", "message": f"Username '{new_username}' is already taken"}), 400

                conn.execute("UPDATE users SET Username = ? WHERE UserID = ?;", (new_username, target_userid))

                # Recalculate leading letter of Unique IDs for this user
                new_initial = new_username[0].upper() if new_username else 'X'
                conn.execute("""
                    UPDATE user_daily_tracking
                    SET UniqueIDByUser = ? || SUBSTR(UniqueIDByUser, 2),
                        UniqueIDByDayByUser = ? || SUBSTR(UniqueIDByDayByUser, 2)
                    WHERE EntryID IN (SELECT EntryID FROM entries WHERE UserID = ?);
                """, (new_initial, new_initial, target_userid))

            # 2. Update Password if provided
            if new_password and len(new_password) > 0:
                if len(new_password) < 6:
                    conn.rollback()
                    return jsonify({"status": "error", "message": "Password must be at least 6 characters"}), 400
                new_hash = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                conn.execute("UPDATE users SET PasswordHash = ? WHERE UserID = ?;", (new_hash, target_userid))

            # 3. Update Role if provided and admin
            if new_role and is_admin:
                if new_role in ["Admin", "Local"]:
                    conn.execute("UPDATE users SET Role = ? WHERE UserID = ?;", (new_role, target_userid))

            conn.commit()
            return jsonify({"status": "success", "message": "User account updated successfully"})
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        conn.close()

@app.route("/api/users/delete", methods=["POST", "DELETE"])
def users_delete():
    data = request.json or {}
    requesting_userid = data.get("requesting_userid")
    target_userid = data.get("target_userid")
    delete_entries = data.get("delete_entries", False)

    if not requesting_userid or not target_userid:
        return jsonify({"status": "error", "message": "Missing parameters"}), 400

    conn = get_db_connection(DB_PATH)
    try:
        admin_user = conn.execute("SELECT Role FROM users WHERE UserID = ?;", (requesting_userid,)).fetchone()
        if not admin_user or admin_user["Role"] != "Admin":
            return jsonify({"status": "error", "message": "Admin privileges required"}), 403
        
        if int(requesting_userid) == int(target_userid):
            return jsonify({"status": "error", "message": "You cannot delete your own account"}), 400

        with db_lock:
            conn.execute("BEGIN TRANSACTION;")
            if delete_entries:
                conn.execute("DELETE FROM entries WHERE UserID = ?;", (target_userid,))
            else:
                # Reassign entries to requesting admin so FK CASCADE does not wipe historical data
                conn.execute("UPDATE entries SET UserID = ? WHERE UserID = ?;", (requesting_userid, target_userid))
            conn.execute("DELETE FROM users WHERE UserID = ?;", (target_userid,))
            conn.commit()
            msg = "User and all associated entries deleted successfully" if delete_entries else "User account deleted successfully (entries preserved and reassigned)"
            return jsonify({"status": "success", "message": msg})
    except Exception as e:
        conn.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        conn.close()

@app.route("/api/auth/change-password", methods=["POST"])
def auth_change_password():
    data = request.json or {}
    userid = data.get("userid")
    current_password = data.get("current_password")
    new_password = data.get("new_password")

    if not userid or not current_password or not new_password:
        return jsonify({"status": "error", "message": "All fields are required"}), 400

    if len(new_password) < 6:
        return jsonify({"status": "error", "message": "New password must be at least 6 characters"}), 400

    with db_lock:
        conn = get_db_connection(DB_PATH)
        try:
            # Check user exists
            user = conn.execute("SELECT * FROM users WHERE UserID = ?;", (userid,)).fetchone()
            if not user:
                return jsonify({"status": "error", "message": "User not found"}), 404
            
            # Verify current password
            hashed = user["PasswordHash"]
            if not bcrypt.checkpw(current_password.encode('utf-8'), hashed.encode('utf-8')):
                return jsonify({"status": "error", "message": "Incorrect current password"}), 401
            
            # Hash and update password
            new_hash = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            conn.execute("UPDATE users SET PasswordHash = ? WHERE UserID = ?;", (new_hash, userid))
            conn.commit()
            return jsonify({"status": "success", "message": "Password changed successfully"})
        except Exception as e:
            return jsonify({"status": "error", "message": str(e)}), 500
        finally:
            conn.close()

@app.route("/api/admin/backup", methods=["GET"])
def admin_backup():
    userid = request.args.get("userid")
    if not userid:
        return jsonify({"status": "error", "message": "User ID required"}), 400
    
    conn = get_db_connection(DB_PATH)
    try:
        user = conn.execute("SELECT Role FROM users WHERE UserID = ?;", (userid,)).fetchone()
        if not user or user["Role"] != "Admin":
            return jsonify({"status": "error", "message": "Admin privileges required"}), 403
        
        from flask import send_file
        return send_file(DB_PATH, as_attachment=True, download_name="pl_tracker_backup.db")
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        conn.close()

@app.route("/api/admin/db-size", methods=["GET"])
def admin_db_size():
    try:
        size_bytes = os.path.getsize(DB_PATH)
        size_kb = round(size_bytes / 1024, 2)
        return jsonify({"status": "success", "size_kb": size_kb})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/admin/restore", methods=["POST"])
def admin_restore():
    userid = request.form.get("userid")
    if not userid:
        return jsonify({"status": "error", "message": "User ID required"}), 400

    conn = get_db_connection(DB_PATH)
    try:
        user = conn.execute("SELECT Role FROM users WHERE UserID = ?;", (userid,)).fetchone()
        if not user or user["Role"] != "Admin":
            return jsonify({"status": "error", "message": "Admin privileges required"}), 403
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        conn.close()

    if 'file' not in request.files:
        return jsonify({"status": "error", "message": "No file uploaded"}), 400

    file = request.files['file']
    if not file.filename.endswith('.db'):
        return jsonify({"status": "error", "message": "Invalid file type. Must be a .db file"}), 400

    with db_lock:
        temp_path = "temp_restore.db"
        try:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            file.save(temp_path)
            
            # Verify it is a valid SQLite DB with users table
            temp_conn = sqlite3.connect(temp_path)
            temp_conn.execute("SELECT COUNT(*) FROM users;").fetchone()
            temp_conn.close()

            # Overwrite active DB
            # We must close any active connections if possible, but SQLite timeout helps here.
            # We can remove active DB and rename temp
            if os.path.exists(DB_PATH):
                os.remove(DB_PATH)
            os.rename(temp_path, DB_PATH)

            return jsonify({"status": "success", "message": "Database restored successfully!"})
        except Exception as e:
            if os.path.exists(temp_path):
                os.remove(temp_path)
            return jsonify({"status": "error", "message": f"Verification failed: {str(e)}"}), 400

def parse_excel_bytes(file_bytes):
    z = zipfile.ZipFile(io.BytesIO(file_bytes))

    # 1. Shared strings
    strings = []
    if 'xl/sharedStrings.xml' in z.namelist():
        ss_xml = z.read('xl/sharedStrings.xml')
        ss_root = ET.fromstring(ss_xml)
        for si in ss_root.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si'):
            t = si.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t')
            if t is not None and t.text:
                strings.append(t.text)
            else:
                texts = [node.text for node in si.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t') if node.text is not None]
                strings.append(''.join(texts))

    # 2. Map sheet name to file target
    wb_rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
    rel_map = {r.attrib['Id']: r.attrib['Target'] for r in wb_rels.findall('{http://schemas.openxmlformats.org/package/2006/relationships}Relationship')}

    wb_xml = ET.fromstring(z.read('xl/workbook.xml'))
    sheets = wb_xml.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheets/{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheet')

    target_sheet_file = None
    for s in sheets:
        if s.attrib.get('name') == 'Data':
            target = rel_map[s.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')]
            target_sheet_file = 'xl/' + target if not target.startswith('xl/') else target
            break

    if not target_sheet_file and sheets:
        target = rel_map[sheets[0].attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')]
        target_sheet_file = 'xl/' + target if not target.startswith('xl/') else target

    if not target_sheet_file:
        raise ValueError("No valid worksheet found in Excel file")

    sheet_root = ET.fromstring(z.read(target_sheet_file))
    rows = sheet_root.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheetData/{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row')

    raw_rows = []
    for r in rows:
        row_dict = {}
        for c in r.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c'):
            ref = c.attrib.get('r')
            col = ''.join([ch for ch in ref if ch.isalpha()])
            t = c.attrib.get('t')
            v = c.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v')
            val = v.text if v is not None else ''
            if t == 's' and val != '' and val.isdigit():
                idx = int(val)
                val = strings[idx] if idx < len(strings) else val
            row_dict[col] = val.strip() if isinstance(val, str) else val
        if row_dict:
            raw_rows.append(row_dict)

    if not raw_rows:
        return []

    # Map header column names
    header_row = raw_rows[0]
    col_map = {}
    for col_letter, val in header_row.items():
        clean_val = str(val).lower().replace(' ', '').replace('_', '')
        if clean_val in ['workorder', 'wo']:
            col_map['work_order'] = col_letter
        elif clean_val in ['packno', 'packnum', 'packnumber']:
            col_map['pack_no'] = col_letter
        elif clean_val in ['pltype', 'type']:
            col_map['pl_type'] = col_letter
        elif clean_val in ['subpltype', 'subtype']:
            col_map['sub_pl_type'] = col_letter
        elif clean_val in ['customer', 'cust']:
            col_map['customer'] = col_letter
        elif clean_val in ['location', 'loc']:
            col_map['location'] = col_letter
        elif clean_val in ['date']:
            col_map['date'] = col_letter
        elif clean_val in ['time']:
            col_map['time'] = col_letter
        elif clean_val in ['user', 'username']:
            col_map['user'] = col_letter

    parsed_entries = []
    base_date = datetime(1899, 12, 30)

    for r in raw_rows[1:]:
        wo = r.get(col_map.get('work_order', ''))
        pn = r.get(col_map.get('pack_no', ''))
        plt = r.get(col_map.get('pl_type', ''))
        subplt = r.get(col_map.get('sub_pl_type', ''))
        cust = r.get(col_map.get('customer', ''))
        loc = r.get(col_map.get('location', ''))
        date_raw = r.get(col_map.get('date', ''))
        time_raw = r.get(col_map.get('time', ''))
        user_raw = r.get(col_map.get('user', ''))

        if wo is None or pn is None or str(wo).strip() == '' or str(pn).strip() == '':
            continue

        try:
            work_order_val = int(float(wo))
            pack_no_val = int(float(pn))
        except (ValueError, TypeError):
            continue

        # Parse Date
        dt_obj = None
        try:
            d_val = float(date_raw)
            dt_obj = base_date + timedelta(days=d_val)
        except (ValueError, TypeError):
            date_str = str(date_raw).strip()
            for fmt in ['%Y-%m-%d', '%m/%d/%Y', '%d/%m/%Y', '%Y/%m/%d']:
                try:
                    dt_obj = datetime.strptime(date_str, fmt)
                    break
                except ValueError:
                    pass

        if not dt_obj:
            dt_obj = datetime.now()

        # Parse Time
        t_delta = timedelta(0)
        try:
            t_val = float(time_raw)
            t_delta = timedelta(days=t_val)
        except (ValueError, TypeError):
            time_str = str(time_raw).strip()
            for fmt in ['%H:%M:%S', '%H:%M', '%I:%M:%S %p', '%I:%M %p']:
                try:
                    t_struct = datetime.strptime(time_str, fmt)
                    t_delta = timedelta(hours=t_struct.hour, minutes=t_struct.minute, seconds=t_struct.second)
                    break
                except ValueError:
                    pass

        full_dt = datetime(dt_obj.year, dt_obj.month, dt_obj.day) + t_delta
        timestamp_str = full_dt.strftime('%Y-%m-%d %H:%M:%S')

        parsed_entries.append({
            'work_order': work_order_val,
            'pack_no': pack_no_val,
            'pl_type': str(plt) if plt else 'Add',
            'sub_pl_type': str(subplt) if subplt else 'With ASN',
            'customer': str(cust) if cust else 'Inditex',
            'location': str(loc) if loc else 'B1 GF',
            'timestamp': timestamp_str,
            'username': str(user_raw).strip() if user_raw else 'Admin',
            'dt': full_dt
        })

    # Sort entries chronologically by timestamp
    parsed_entries.sort(key=lambda x: x['dt'])
    return parsed_entries

@app.route("/api/admin/import-excel", methods=["POST"])
def admin_import_excel():
    userid = request.form.get("userid") or (request.json.get("userid") if request.is_json else None)
    if not userid:
        return jsonify({"status": "error", "message": "User ID required"}), 400

    conn = get_db_connection(DB_PATH)
    try:
        user = conn.execute("SELECT Role FROM users WHERE UserID = ?;", (userid,)).fetchone()
        if not user or user["Role"] != "Admin":
            return jsonify({"status": "error", "message": "Admin privileges required to import Excel data"}), 403
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        conn.close()

    if 'file' not in request.files:
        return jsonify({"status": "error", "message": "No file uploaded"}), 400

    file = request.files['file']
    if not file.filename.lower().endswith(('.xlsx', '.xlsm')):
        return jsonify({"status": "error", "message": "Invalid file format. Please upload an Excel file (.xlsx or .xlsm)"}), 400

    try:
        file_bytes = file.read()
        entries_to_import = parse_excel_bytes(file_bytes)
    except Exception as e:
        return jsonify({"status": "error", "message": f"Error parsing Excel file: {str(e)}"}), 400

    if not entries_to_import:
        return jsonify({"status": "error", "message": "No valid data rows found in the Excel file"}), 400

    source_ip = request.remote_addr or "127.0.0.1"

    with db_lock:
        conn = get_db_connection(DB_PATH)
        try:
            conn.execute("BEGIN TRANSACTION;")

            user_cache = {}
            created_users = set()

            for entry in entries_to_import:
                username = entry["username"]
                
                # Check user cache or DB
                if username not in user_cache:
                    user_row = conn.execute("SELECT UserID, Username FROM users WHERE LOWER(Username) = LOWER(?);", (username,)).fetchone()
                    if user_row:
                        user_cache[username] = (user_row["UserID"], user_row["Username"])
                    else:
                        # Auto-create user account
                        default_hash = bcrypt.hashpw("password123".encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                        cur = conn.execute(
                            "INSERT INTO users (Username, PasswordHash, Role) VALUES (?, ?, ?);",
                            (username, default_hash, "Local")
                        )
                        new_uid = cur.lastrowid
                        user_cache[username] = (new_uid, username)
                        created_users.add(username)

                uid, clean_username = user_cache[username]
                user_initial = clean_username[0].upper() if clean_username else 'X'
                timestamp = entry["timestamp"]
                date_str = timestamp[:10]

                # Sequence calculation
                counts_sql = """
                    SELECT 
                        (SELECT COUNT(*) FROM entries) AS master_cnt,
                        (SELECT COUNT(*) FROM entries WHERE UserID = ?) AS user_cnt,
                        (SELECT COUNT(*) FROM entries WHERE SUBSTR(EntryTimestamp, 1, 10) = ?) AS daily_cnt,
                        (SELECT COUNT(*) FROM entries WHERE UserID = ? AND SUBSTR(EntryTimestamp, 1, 10) = ?) AS user_daily_cnt;
                """
                row = conn.execute(counts_sql, (uid, date_str, uid, date_str)).fetchone()

                master_unique_id = row["master_cnt"] + 1
                user_lifetime_count = row["user_cnt"] + 1
                unique_id_by_user = f"{user_initial}{user_lifetime_count:03d}"
                daily_count_id = row["daily_cnt"] + 1
                user_daily_count_id = row["user_daily_cnt"] + 1
                unique_id_by_day_by_user = f"{user_initial}{user_daily_count_id:03d}"

                # Insert Core Entry
                cursor = conn.execute("""
                    INSERT INTO entries (UserID, WorkOrder, PackNo, PLType, SubPLType, Location, Customer, EntryTimestamp, SourcePC_IP)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
                """, (uid, entry["work_order"], entry["pack_no"], entry["pl_type"], entry["sub_pl_type"], entry["location"], entry["customer"], timestamp, source_ip))
                entry_id = cursor.lastrowid

                # Insert ID Tracking
                conn.execute("""
                    INSERT INTO user_daily_tracking (EntryID, MasterUniqueID, UniqueIDByUser, DailyCountID, UserDailyCountID, UniqueIDByDayByUser)
                    VALUES (?, ?, ?, ?, ?, ?);
                """, (entry_id, master_unique_id, unique_id_by_user, daily_count_id, user_daily_count_id, unique_id_by_day_by_user))

            conn.commit()

            start_dt = entries_to_import[0]["timestamp"]
            end_dt = entries_to_import[-1]["timestamp"]

            return jsonify({
                "status": "success",
                "message": f"Successfully imported {len(entries_to_import)} entries from Excel file",
                "imported_count": len(entries_to_import),
                "created_users": list(created_users),
                "user_count": len(user_cache),
                "date_range": {
                    "start": start_dt,
                    "end": end_dt
                }
            })
        except Exception as e:
            conn.rollback()
            return jsonify({"status": "error", "message": f"Database import failed: {str(e)}"}), 500
        finally:
            conn.close()

@app.route("/api/dashboard/location-analytics", methods=["GET"])
def get_location_analytics():
    """
    Dedicated endpoint returning location-wise totals, trends, and breakdown metrics
    for the 8 canonical locations: B1 GF, B1 FF, B2 GF, B2 FF, B2 HF, B2 EF, KW GF, OS.
    """
    conn = get_db_connection(DB_PATH)
    cursor = conn.cursor()
    
    canonical_locations = ["B1 GF", "B1 FF", "B2 GF", "B2 FF", "B2 HF", "B2 EF", "KW GF", "OS"]
    
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    
    try:
        query = """
            SELECT e.Location, e.PLType, e.SubPLType, e.Customer, e.WorkOrder, e.PackNo, e.EntryTimestamp, u.Username
            FROM entries e
            JOIN users u ON e.UserID = u.UserID
            WHERE 1=1
        """
        params = []
        if start_date:
            query += " AND SUBSTR(e.EntryTimestamp, 1, 10) >= ?"
            params.append(start_date)
        if end_date:
            query += " AND SUBSTR(e.EntryTimestamp, 1, 10) <= ?"
            params.append(end_date)
            
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        # Build structure per location
        location_data = {loc: {"total_scans": 0, "work_orders": set(), "pack_nos": set(), "customers": {}, "pl_types": {}, "time_series": {}} for loc in canonical_locations}
        
        for r in rows:
            loc = r["Location"]
            if loc not in location_data:
                location_data[loc] = {"total_scans": 0, "work_orders": set(), "pack_nos": set(), "customers": {}, "pl_types": {}, "time_series": {}}
            
            ld = location_data[loc]
            ld["total_scans"] += 1
            ld["work_orders"].add(r["WorkOrder"])
            ld["pack_nos"].add(r["PackNo"])
            
            cust = r["Customer"] or "Unknown"
            ld["customers"][cust] = ld["customers"].get(cust, 0) + 1
            
            plt = r["PLType"] or "Unknown"
            ld["pl_types"][plt] = ld["pl_types"].get(plt, 0) + 1
            
            date_str = (r["EntryTimestamp"] or "")[:10]
            if date_str:
                ld["time_series"][date_str] = ld["time_series"].get(date_str, 0) + 1
                
        # Format response
        result = {}
        for loc, ld in location_data.items():
            top_cust = max(ld["customers"].items(), key=lambda x: x[1])[0] if ld["customers"] else "N/A"
            sorted_dates = sorted(ld["time_series"].keys())
            result[loc] = {
                "total_scans": ld["total_scans"],
                "unique_work_orders": len(ld["work_orders"]),
                "unique_pack_nos": len(ld["pack_nos"]),
                "top_customer": top_cust,
                "customer_breakdown": ld["customers"],
                "pl_type_breakdown": ld["pl_types"],
                "time_series": [{"date": d, "count": ld["time_series"][d]} for d in sorted_dates]
            }
            
        return jsonify({
            "status": "success",
            "canonical_locations": canonical_locations,
            "locations": result
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        conn.close()

if __name__ == "__main__":
    host = os.environ.get("PL_TRACKER_HOST", "0.0.0.0")
    port = int(os.environ.get("PL_TRACKER_PORT", 5000))
    app.run(host=host, port=port, debug=True)

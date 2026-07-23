from flask import Blueprint, request, jsonify, current_app
from services.auth_service import check_auth, hash_password
from services.user_service import get_db_connection, db_lock
from config import Config
from logger import logger

auth_bp = Blueprint("auth", __name__)

def get_db_path():
    return current_app.config.get("PL_TRACKER_DB") or Config.PL_TRACKER_DB

@auth_bp.route("/api/auth/setup", methods=["POST"])
def auth_setup():
    data = request.json or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return jsonify({"status": "error", "message": "Username and password are required"}), 400

    db_path = get_db_path()
    with db_lock:
        conn = get_db_connection(db_path)
        try:
            user_count = conn.execute("SELECT COUNT(*) FROM users;").fetchone()[0]
            if user_count > 0:
                return jsonify({"status": "error", "message": "Database is already initialized"}), 400

            password_hash = hash_password(password)
            cursor = conn.execute(
                "INSERT INTO users (Username, PasswordHash, Role) VALUES (?, ?, ?);",
                (username, password_hash, "Admin")
            )
            conn.commit()
            new_id = cursor.lastrowid
            logger.info(f"First Admin account '{username}' created successfully")
            return jsonify({
                "status": "success",
                "message": "First Admin account created successfully",
                "user": {"userid": new_id, "username": username, "role": "Admin"}
            })
        except Exception as e:
            return jsonify({"status": "error", "message": str(e)}), 500
        finally:
            conn.close()

@auth_bp.route("/api/auth/login", methods=["POST"])
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

    db_path = get_db_path()
    user, error_type = check_auth(username, password, db_path)
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

    logger.info(f"User '{username}' logged in successfully")
    return jsonify({
        "status": "success",
        "user": {
            "userid": user["UserID"],
            "username": user["Username"],
            "role": user["Role"]
        }
    })

@auth_bp.route("/api/auth/register", methods=["POST"])
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

    db_path = get_db_path()
    conn = get_db_connection(db_path)
    try:
        is_authorized = False
        if requesting_userid:
            req_user = conn.execute("SELECT Role FROM users WHERE UserID = ?;", (requesting_userid,)).fetchone()
            if req_user and req_user["Role"] == "Admin":
                is_authorized = True

        if not is_authorized and admin_username and admin_password:
            admin_user, err = check_auth(admin_username, admin_password, db_path)
            if not err and admin_user["Role"] == "Admin":
                is_authorized = True

        if not is_authorized:
            return jsonify({"status": "error", "message": "Admin authorization failed"}), 403

        with db_lock:
            existing = conn.execute("SELECT UserID FROM users WHERE LOWER(Username) = LOWER(?);", (new_username,)).fetchone()
            if existing:
                return jsonify({"status": "error", "message": f"Username '{new_username}' is already taken"}), 400

            new_hash = hash_password(new_password)
            cursor = conn.execute(
                "INSERT INTO users (Username, PasswordHash, Role) VALUES (?, ?, ?);",
                (new_username, new_hash, new_role)
            )
            conn.commit()
            new_id = cursor.lastrowid
            logger.info(f"Admin registered new user '{new_username}' ({new_role})")
            return jsonify({
                "status": "success",
                "message": f"User '{new_username}' registered successfully",
                "user": {"userid": new_id, "username": new_username, "role": new_role}
            })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        conn.close()

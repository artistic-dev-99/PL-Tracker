from datetime import datetime
import threading
from db import get_db_connection
from services.auth_service import hash_password
from config import Config

db_lock = threading.Lock()

def get_users_list(db_path=None):
    db_path = db_path or Config.PL_TRACKER_DB
    conn = get_db_connection(db_path)
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
        return users, None
    except Exception as e:
        return None, str(e)
    finally:
        conn.close()

def update_user_heartbeat(userid, db_path=None):
    db_path = db_path or Config.PL_TRACKER_DB
    conn = get_db_connection(db_path)
    try:
        conn.execute("UPDATE users SET LastActive = CURRENT_TIMESTAMP WHERE UserID = ?;", (userid,))
        conn.commit()
        return True, None
    except Exception as e:
        return False, str(e)
    finally:
        conn.close()

def update_user_account(requesting_userid, target_userid, new_username=None, new_password=None, new_role=None, db_path=None):
    db_path = db_path or Config.PL_TRACKER_DB
    conn = get_db_connection(db_path)
    try:
        req_user = conn.execute("SELECT Role FROM users WHERE UserID = ?;", (requesting_userid,)).fetchone()
        if not req_user:
            return None, "Requesting user not found", 404
        
        is_admin = (req_user["Role"] == "Admin")
        is_self = (int(requesting_userid) == int(target_userid))

        if not is_admin and not is_self:
            return None, "Unauthorized to update this user account", 403

        target_user = conn.execute("SELECT * FROM users WHERE UserID = ?;", (target_userid,)).fetchone()
        if not target_user:
            return None, "Target user not found", 404

        with db_lock:
            conn.execute("BEGIN TRANSACTION;")

            # 1. Update Username & Recalculate Initial Letter for Linked IDs
            if new_username and new_username.lower() != target_user["Username"].lower():
                existing = conn.execute("SELECT UserID FROM users WHERE LOWER(Username) = LOWER(?) AND UserID != ?;", (new_username, target_userid)).fetchone()
                if existing:
                    conn.rollback()
                    return None, f"Username '{new_username}' is already taken", 400

                new_initial = new_username[0].upper()
                conn.execute("UPDATE users SET Username = ? WHERE UserID = ?;", (new_username, target_userid))

                # Update UniqueIDByUser & UniqueIDByDayByUser for all entries belonging to target user
                conn.execute("""
                    UPDATE user_daily_tracking
                    SET UniqueIDByUser = ? || SUBSTR(UniqueIDByUser, 2),
                        UniqueIDByDayByUser = ? || SUBSTR(UniqueIDByDayByUser, 2)
                    WHERE EntryID IN (SELECT EntryID FROM entries WHERE UserID = ?);
                """, (new_initial, new_initial, target_userid))

            # 2. Update Password if provided
            if new_password:
                if len(new_password) < 6:
                    conn.rollback()
                    return None, "Password must be at least 6 characters", 400
                new_hash = hash_password(new_password)
                conn.execute("UPDATE users SET PasswordHash = ? WHERE UserID = ?;", (new_hash, target_userid))

            # 3. Update Role if provided (Admin only)
            if new_role and new_role in ("Admin", "Local"):
                if not is_admin:
                    conn.rollback()
                    return None, "Only Administrators can change user roles", 403
                conn.execute("UPDATE users SET Role = ? WHERE UserID = ?;", (new_role, target_userid))

            conn.commit()
            return {"status": "success", "message": "User account updated successfully"}, None, 200
    except Exception as e:
        conn.rollback()
        return None, str(e), 500
    finally:
        conn.close()

def delete_user_account(requesting_userid, target_userid, delete_entries=False, db_path=None):
    db_path = db_path or Config.PL_TRACKER_DB
    conn = get_db_connection(db_path)
    try:
        admin_user = conn.execute("SELECT Role FROM users WHERE UserID = ?;", (requesting_userid,)).fetchone()
        if not admin_user or admin_user["Role"] != "Admin":
            return None, "Admin privileges required", 403

        if int(requesting_userid) == int(target_userid):
            return None, "You cannot delete your own admin account while logged in", 400

        with db_lock:
            conn.execute("BEGIN TRANSACTION;")

            if not delete_entries:
                # Reassign user entries to requesting admin so CASCADE doesn't wipe historical records
                conn.execute("UPDATE entries SET UserID = ? WHERE UserID = ?;", (requesting_userid, target_userid))

            conn.execute("DELETE FROM users WHERE UserID = ?;", (target_userid,))
            conn.commit()
            return {"status": "success", "message": "User account deleted successfully"}, None, 200
    except Exception as e:
        conn.rollback()
        return None, str(e), 500
    finally:
        conn.close()

def toggle_user_status(requesting_userid, target_userid, new_status, db_path=None):
    db_path = db_path or Config.PL_TRACKER_DB
    conn = get_db_connection(db_path)
    try:
        admin_user = conn.execute("SELECT Role FROM users WHERE UserID = ?;", (requesting_userid,)).fetchone()
        if not admin_user or admin_user["Role"] != "Admin":
            return None, "Admin privileges required", 403

        if int(requesting_userid) == int(target_userid):
            return None, "You cannot modify your own status", 400

        with db_lock:
            conn.execute("UPDATE users SET Status = ? WHERE UserID = ?;", (new_status, target_userid))
            conn.commit()
            return {"status": "success", "message": f"User status changed to {new_status}"}, None, 200
    except Exception as e:
        return None, str(e), 500
    finally:
        conn.close()

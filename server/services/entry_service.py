import threading
from datetime import datetime
from db import get_db_connection
from config import Config

db_lock = threading.Lock()

def create_entry(userid, work_order, pack_no, pl_type, sub_pl_type, location, customer, mode, timestamp, source_ip, db_path=None):
    db_path = db_path or Config.PL_TRACKER_DB
    dt = datetime.strptime(timestamp, "%Y-%m-%d %H:%M:%S")
    date_str = dt.strftime("%Y-%m-%d")

    with db_lock:
        conn = get_db_connection(db_path)
        try:
            user = conn.execute("SELECT Username FROM users WHERE UserID = ?;", (userid,)).fetchone()
            if not user:
                return None, "User not found", 404

            username = user["Username"]
            user_initial = username[0].upper() if username else 'X'

            conn.execute("BEGIN TRANSACTION;")

            # 1 single combined query for sequence ID calculation
            counts_sql = """
                SELECT 
                    (SELECT COUNT(*) FROM entries) AS master_cnt,
                    (SELECT COUNT(*) FROM entries WHERE UserID = ?) AS user_cnt,
                    (SELECT COUNT(*) FROM entries WHERE SUBSTR(EntryTimestamp, 1, 10) = ?) AS daily_cnt,
                    (SELECT COUNT(*) FROM entries WHERE UserID = ? AND SUBSTR(EntryTimestamp, 1, 10) = ?) AS user_daily_cnt;
            """
            row = conn.execute(counts_sql, (userid, date_str, userid, date_str)).fetchone()
            
            master_cnt = row["master_cnt"] + 1
            user_cnt = row["user_cnt"] + 1
            daily_cnt = row["daily_cnt"] + 1
            user_daily_cnt = row["user_daily_cnt"] + 1

            unique_id_by_user = f"{user_initial}{user_cnt:03d}"
            unique_id_by_day_by_user = f"{user_initial}{user_daily_cnt:03d}"

            cursor = conn.execute("""
                INSERT INTO entries (UserID, WorkOrder, PackNo, PLType, SubPLType, Location, Customer, EntryTimestamp, SourcePC_IP, Mode)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            """, (userid, work_order, pack_no, pl_type, sub_pl_type, location, customer, timestamp, source_ip, mode))
            
            entry_id = cursor.lastrowid

            conn.execute("""
                INSERT INTO user_daily_tracking (EntryID, MasterUniqueID, UniqueIDByUser, DailyCountID, UserDailyCountID, UniqueIDByDayByUser)
                VALUES (?, ?, ?, ?, ?, ?);
            """, (entry_id, master_cnt, unique_id_by_user, daily_cnt, user_daily_cnt, unique_id_by_day_by_user))

            conn.commit()

            return {
                "status": "success",
                "entry": {
                    "entry_id": entry_id,
                    "master_unique_id": master_cnt,
                    "unique_id_by_user": unique_id_by_user,
                    "daily_count_id": daily_cnt,
                    "user_daily_count_id": user_daily_cnt,
                    "unique_id_by_day_by_user": unique_id_by_day_by_user,
                    "work_order": work_order,
                    "pack_no": pack_no,
                    "pl_type": pl_type,
                    "sub_pl_type": sub_pl_type,
                    "location": location,
                    "customer": customer,
                    "mode": mode,
                    "timestamp": timestamp,
                    "username": username
                }
            }, None, 200
        except Exception as e:
            conn.rollback()
            return None, str(e), 500
        finally:
            conn.close()

def query_entries(filters, db_path=None):
    db_path = db_path or Config.PL_TRACKER_DB
    conn = get_db_connection(db_path)
    try:
        sql = """
            SELECT 
                e.EntryID, e.UserID, u.Username, e.WorkOrder, e.PackNo, e.PLType, e.SubPLType, 
                e.Location, e.Customer, e.EntryTimestamp, e.SourcePC_IP, e.Mode,
                t.MasterUniqueID, t.UniqueIDByUser, t.DailyCountID, t.UserDailyCountID, t.UniqueIDByDayByUser
            FROM entries e
            JOIN users u ON e.UserID = u.UserID
            LEFT JOIN user_daily_tracking t ON e.EntryID = t.EntryID
            WHERE 1=1
        """
        params = []

        if filters.get("work_order"):
            sql += " AND e.WorkOrder = ?"
            params.append(filters["work_order"])
        if filters.get("pack_no"):
            sql += " AND e.PackNo = ?"
            params.append(filters["pack_no"])
        if filters.get("pl_type"):
            sql += " AND e.PLType = ?"
            params.append(filters["pl_type"])
        if filters.get("sub_pl_type"):
            sql += " AND e.SubPLType = ?"
            params.append(filters["sub_pl_type"])
        if filters.get("location"):
            sql += " AND e.Location = ?"
            params.append(filters["location"])
        if filters.get("customer"):
            sql += " AND e.Customer = ?"
            params.append(filters["customer"])
        if filters.get("mode"):
            sql += " AND e.Mode = ?"
            params.append(filters["mode"])
        if filters.get("userid"):
            sql += " AND e.UserID = ?"
            params.append(filters["userid"])
        if filters.get("start_date"):
            sql += " AND e.EntryTimestamp >= ?"
            params.append(filters["start_date"] + " 00:00:00")
        if filters.get("end_date"):
            sql += " AND e.EntryTimestamp <= ?"
            params.append(filters["end_date"] + " 23:59:59")

        sql += " ORDER BY e.EntryTimestamp DESC, e.EntryID DESC"
        rows = conn.execute(sql, params).fetchall()

        results = [dict(r) for r in rows]
        return results, None, 200
    except Exception as e:
        return None, str(e), 500
    finally:
        conn.close()

def update_entry(requesting_userid, entry_id, work_order, pack_no, pl_type, sub_pl_type, location, customer, mode, timestamp, db_path=None):
    db_path = db_path or Config.PL_TRACKER_DB
    conn = get_db_connection(db_path)
    try:
        user = conn.execute("SELECT Role FROM users WHERE UserID = ?;", (requesting_userid,)).fetchone()
        if not user:
            return None, "Requesting user not found", 404
        
        entry = conn.execute("SELECT UserID FROM entries WHERE EntryID = ?;", (entry_id,)).fetchone()
        if not entry:
            return None, "Entry not found", 404

        if user["Role"] != "Admin" and entry["UserID"] != int(requesting_userid):
            return None, "Unauthorized to edit this entry", 403

        with db_lock:
            conn.execute("""
                UPDATE entries
                SET WorkOrder = ?, PackNo = ?, PLType = ?, SubPLType = ?, Location = ?, Customer = ?, Mode = ?, EntryTimestamp = ?
                WHERE EntryID = ?;
            """, (work_order, pack_no, pl_type, sub_pl_type, location, customer, mode, timestamp, entry_id))
            conn.commit()
            return {"status": "success", "message": "Entry updated successfully"}, None, 200
    except Exception as e:
        return None, str(e), 500
    finally:
        conn.close()

def delete_entries(requesting_userid, entry_ids, db_path=None):
    db_path = db_path or Config.PL_TRACKER_DB
    conn = get_db_connection(db_path)
    try:
        user = conn.execute("SELECT Role FROM users WHERE UserID = ?;", (requesting_userid,)).fetchone()
        if not user:
            return None, "Requesting user not found", 404

        if not entry_ids:
            return None, "No entry IDs provided", 400

        with db_lock:
            conn.execute("BEGIN TRANSACTION;")
            placeholders = ",".join("?" for _ in entry_ids)
            if user["Role"] != "Admin":
                # Check all entries belong to requesting user
                belong_count = conn.execute(f"SELECT COUNT(*) FROM entries WHERE EntryID IN ({placeholders}) AND UserID = ?;", (*entry_ids, requesting_userid)).fetchone()[0]
                if belong_count != len(entry_ids):
                    conn.rollback()
                    return None, "Unauthorized to delete some specified entries", 403

            conn.execute(f"DELETE FROM entries WHERE EntryID IN ({placeholders});", tuple(entry_ids))
            conn.commit()
            return {"status": "success", "message": f"Successfully deleted {len(entry_ids)} entries"}, None, 200
    except Exception as e:
        conn.rollback()
        return None, str(e), 500
    finally:
        conn.close()

import io
import zipfile
import xml.etree.ElementTree as ET
import threading
from datetime import datetime, timedelta
from db import get_db_connection
from services.auth_service import hash_password
from config import Config

db_lock = threading.Lock()

def parse_excel_date(date_val):
    if not date_val:
        return None
    date_str = str(date_val).strip()
    if not date_str:
        return None

    # Handle Excel float serial date (e.g. 45300 or 45300.5)
    try:
        val_float = float(date_str)
        if val_float > 30000:
            excel_epoch = datetime(1899, 12, 30)
            dt = excel_epoch + timedelta(days=val_float)
            return dt.strftime("%Y-%m-%d %H:%M:%S")
    except ValueError:
        pass

    formats = [
        "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d",
        "%d/%m/%Y %H:%M:%S", "%d/%m/%Y %H:%M", "%d/%m/%Y",
        "%m/%d/%Y %H:%M:%S", "%m/%d/%Y %H:%M", "%m/%d/%Y",
        "%d-%m-%Y %H:%M:%S", "%d-%m-%Y %H:%M", "%d-%m-%Y"
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt.strftime("%Y-%m-%d %H:%M:%S")
        except ValueError:
            pass

    return None

def import_excel_data(file_bytes, admin_userid, source_ip, db_path=None):
    db_path = db_path or Config.PL_TRACKER_DB
    conn = get_db_connection(db_path)
    try:
        admin_user = conn.execute("SELECT Role FROM users WHERE UserID = ?;", (admin_userid,)).fetchone()
        if not admin_user or admin_user["Role"] != "Admin":
            return None, "Admin authorization required to import Excel data", 403

        # Stream Zip Archive (OpenXML format .xlsm / .xlsx)
        try:
            z = zipfile.ZipFile(io.BytesIO(file_bytes))
        except Exception:
            return None, "Invalid Excel file format. Must be a valid .xlsm or .xlsx file.", 400

        # Read sharedStrings.xml
        shared_strings = []
        if "xl/sharedStrings.xml" in z.namelist():
            ss_xml = z.read("xl/sharedStrings.xml")
            ss_tree = ET.fromstring(ss_xml)
            for si in ss_tree.findall("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si"):
                t_el = si.find("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t")
                if t_el is not None and t_el.text:
                    shared_strings.append(t_el.text)
                else:
                    text_parts = []
                    for r_el in si.findall("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}r"):
                        t_part = r_el.find("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t")
                        if t_part is not None and t_part.text:
                            text_parts.append(t_part.text)
                    shared_strings.append("".join(text_parts))

        # Find first sheet
        sheet_files = [f for f in z.namelist() if f.startswith("xl/worksheets/sheet")]
        if not sheet_files:
            return None, "No worksheet found in Excel file", 400

        sheet_xml = z.read(sorted(sheet_files)[0])
        sheet_tree = ET.fromstring(sheet_xml)

        sheet_data = sheet_tree.find("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheetData")
        if sheet_data is None:
            return None, "Empty sheet data", 400

        rows_raw = []
        for row_el in sheet_data.findall("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row"):
            row_cells = {}
            for c_el in row_el.findall("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c"):
                r_ref = c_el.attrib.get("r", "")
                t_attr = c_el.attrib.get("t", "")
                v_el = c_el.find("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v")
                val = v_el.text if v_el is not None else ""
                
                if t_attr == "s" and val.isdigit():
                    idx = int(val)
                    if 0 <= idx < len(shared_strings):
                        val = shared_strings[idx]

                col_name = "".join([char for char in r_ref if char.isalpha()])
                row_cells[col_name] = val
            rows_raw.append(row_cells)

        if not rows_raw:
            return None, "No data rows found in Excel file", 400

        # Header detection
        header_row_idx = 0
        col_map = {}
        for idx, r in enumerate(rows_raw[:10]):
            vals_lower = {k: str(v).lower().strip() for k, v in r.items()}
            for col_letter, val in vals_lower.items():
                if "work" in val or "wo" in val or "order" in val:
                    col_map["work_order"] = col_letter
                elif "pack" in val:
                    col_map["pack_no"] = col_letter
                elif "pl" in val and "type" in val and "sub" not in val:
                    col_map["pl_type"] = col_letter
                elif "sub" in val:
                    col_map["sub_pl_type"] = col_letter
                elif "loc" in val:
                    col_map["location"] = col_letter
                elif "cust" in val:
                    col_map["customer"] = col_letter
                elif "user" in val or "operator" in val or "name" in val:
                    col_map["username"] = col_letter
                elif "date" in val or "time" in val or "stamp" in val:
                    col_map["timestamp"] = col_letter
                elif "mode" in val:
                    col_map["mode"] = col_letter

            if "work_order" in col_map and "pack_no" in col_map:
                header_row_idx = idx + 1
                break

        # Fallback column letters if header detection didn't match all
        fallback_letters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]
        if "work_order" not in col_map and len(fallback_letters) > 0: col_map["work_order"] = "A"
        if "pack_no" not in col_map and len(fallback_letters) > 1: col_map["pack_no"] = "B"
        if "pl_type" not in col_map and len(fallback_letters) > 2: col_map["pl_type"] = "C"
        if "sub_pl_type" not in col_map and len(fallback_letters) > 3: col_map["sub_pl_type"] = "D"
        if "location" not in col_map and len(fallback_letters) > 4: col_map["location"] = "E"
        if "customer" not in col_map and len(fallback_letters) > 5: col_map["customer"] = "F"
        if "username" not in col_map and len(fallback_letters) > 6: col_map["username"] = "G"
        if "timestamp" not in col_map and len(fallback_letters) > 7: col_map["timestamp"] = "H"
        if "mode" not in col_map and len(fallback_letters) > 8: col_map["mode"] = "I"

        parsed_entries = []
        for r in rows_raw[header_row_idx:]:
            wo_str = str(r.get(col_map.get("work_order", ""), "")).strip()
            pack_str = str(r.get(col_map.get("pack_no", ""), "")).strip()

            if not wo_str or not pack_str:
                continue

            try:
                wo_val = int(float(wo_str))
                pack_val = int(float(pack_str))
            except ValueError:
                continue

            pl_type_val = str(r.get(col_map.get("pl_type", ""), "New")).strip() or "New"
            sub_pl_val = str(r.get(col_map.get("sub_pl_type", ""), "With ASN")).strip() or "With ASN"
            location_val = str(r.get(col_map.get("location", ""), "B1 GF")).strip() or "B1 GF"
            customer_val = str(r.get(col_map.get("customer", ""), "AEO")).strip() or "AEO"
            username_val = str(r.get(col_map.get("username", ""), "Admin")).strip() or "Admin"
            mode_val = str(r.get(col_map.get("mode", ""), "Manual")).strip()
            if mode_val not in ["Mail", "Manual"]:
                mode_val = "Manual"

            ts_raw = r.get(col_map.get("timestamp", ""), "")
            parsed_ts = parse_excel_date(ts_raw) or datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            parsed_entries.append({
                "work_order": wo_val,
                "pack_no": pack_val,
                "pl_type": pl_type_val,
                "sub_pl_type": sub_pl_val,
                "location": location_val,
                "customer": customer_val,
                "username": username_val,
                "mode": mode_val,
                "timestamp": parsed_ts
            })

        if not parsed_entries:
            return None, "No valid entries parsed from Excel file", 400

        # Sort chronologically by timestamp
        parsed_entries.sort(key=lambda x: x["timestamp"])

        created_users = []
        user_cache = {}

        with db_lock:
            conn.execute("BEGIN TRANSACTION;")

            # 1. Resolve/Auto-create users
            for entry in parsed_entries:
                uname = entry["username"]
                if uname.lower() not in user_cache:
                    u_row = conn.execute("SELECT UserID FROM users WHERE LOWER(Username) = LOWER(?);", (uname,)).fetchone()
                    if u_row:
                        user_cache[uname.lower()] = u_row["UserID"]
                    else:
                        def_hash = hash_password("operator123")
                        c_res = conn.execute("INSERT INTO users (Username, PasswordHash, Role) VALUES (?, ?, ?);", (uname, def_hash, "Local"))
                        new_u_id = c_res.lastrowid
                        user_cache[uname.lower()] = new_u_id
                        created_users.append(uname)

            # 2. Insert entries & calculate sequence tracking IDs
            imported_count = 0
            for entry in parsed_entries:
                uid = user_cache[entry["username"].lower()]
                dt_str = entry["timestamp"][:10]
                user_initial = entry["username"][0].upper()

                counts_sql = """
                    SELECT 
                        (SELECT COUNT(*) FROM entries) AS master_cnt,
                        (SELECT COUNT(*) FROM entries WHERE UserID = ?) AS user_cnt,
                        (SELECT COUNT(*) FROM entries WHERE SUBSTR(EntryTimestamp, 1, 10) = ?) AS daily_cnt,
                        (SELECT COUNT(*) FROM entries WHERE UserID = ? AND SUBSTR(EntryTimestamp, 1, 10) = ?) AS user_daily_cnt;
                """
                counts = conn.execute(counts_sql, (uid, dt_str, uid, dt_str)).fetchone()
                
                m_id = counts["master_cnt"] + 1
                u_cnt = counts["user_cnt"] + 1
                d_cnt = counts["daily_cnt"] + 1
                ud_cnt = counts["user_daily_cnt"] + 1

                u_id_user = f"{user_initial}{u_cnt:03d}"
                u_id_day_user = f"{user_initial}{ud_cnt:03d}"

                e_res = conn.execute("""
                    INSERT INTO entries (UserID, WorkOrder, PackNo, PLType, SubPLType, Location, Customer, EntryTimestamp, SourcePC_IP, Mode)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                """, (uid, entry["work_order"], entry["pack_no"], entry["pl_type"], entry["sub_pl_type"], entry["location"], entry["customer"], entry["timestamp"], source_ip, entry["mode"]))

                e_id = e_res.lastrowid

                conn.execute("""
                    INSERT INTO user_daily_tracking (EntryID, MasterUniqueID, UniqueIDByUser, DailyCountID, UserDailyCountID, UniqueIDByDayByUser)
                    VALUES (?, ?, ?, ?, ?, ?);
                """, (e_id, m_id, u_id_user, d_cnt, ud_cnt, u_id_day_user))

                imported_count += 1

            conn.commit()

            start_ts = parsed_entries[0]["timestamp"] if parsed_entries else "--"
            end_ts = parsed_entries[-1]["timestamp"] if parsed_entries else "--"

            return {
                "status": "success",
                "message": f"Successfully imported {imported_count} packing list entries into user databases!",
                "imported_count": imported_count,
                "user_count": len(user_cache),
                "created_users": created_users,
                "date_range": {"start": start_ts, "end": end_ts}
            }, None, 200

    except Exception as e:
        conn.rollback()
        return None, f"Excel processing error: {str(e)}", 500
    finally:
        conn.close()

from datetime import datetime

def validate_work_order(work_order):
    try:
        wo = int(work_order)
        if 200000000 < wo < 1000000000:
            return wo, None
        return None, "Work Order must be a 9-digit number starting with > 200000000"
    except (TypeError, ValueError):
        return None, "Work Order must be numeric"

def validate_pack_no(pack_no):
    try:
        pk = int(pack_no)
        if 40000 < pk < 100000:
            return pk, None
        return None, "Pack No must be a 5-digit number > 40000"
    except (TypeError, ValueError):
        return None, "Pack No must be numeric"

def validate_timestamp(timestamp_str):
    if not timestamp_str:
        return None, "Timestamp is required"
    try:
        dt = datetime.strptime(str(timestamp_str).strip(), "%Y-%m-%d %H:%M:%S")
        return dt.strftime("%Y-%m-%d %H:%M:%S"), None
    except ValueError:
        return None, "Timestamp must follow YYYY-MM-DD HH:MM:SS format"

def validate_mode(mode_str):
    if not mode_str or mode_str not in ("Mail", "Manual"):
        return "Manual"
    return mode_str

def validate_role(role_str):
    if role_str in ("Admin", "Local"):
        return role_str, None
    return None, "Invalid role specified (must be Admin or Local)"

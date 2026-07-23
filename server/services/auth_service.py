import bcrypt
from db import get_db_connection
from config import Config

def get_user_by_username(username, db_path=None):
    db_path = db_path or Config.PL_TRACKER_DB
    conn = get_db_connection(db_path)
    try:
        user = conn.execute("SELECT * FROM users WHERE Username = ?;", (username,)).fetchone()
        return user
    finally:
        conn.close()

def check_auth(username, password, db_path=None):
    user = get_user_by_username(username, db_path)
    if not user:
        return None, "username"
    
    hashed = user["PasswordHash"]
    if bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8')):
        return user, None
    else:
        return None, "password"

def hash_password(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

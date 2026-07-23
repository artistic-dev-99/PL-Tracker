import sqlite3
import os

def get_db_connection(db_path):
    conn = sqlite3.connect(db_path, timeout=30.0)
    conn.row_factory = sqlite3.Row
    # Enable foreign keys
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db(db_path):
    # Ensure directory exists
    db_dir = os.path.dirname(db_path)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir)

    conn = get_db_connection(db_path)
    cursor = conn.cursor()

    # Create Users Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        UserID INTEGER PRIMARY KEY AUTOINCREMENT,
        Username TEXT UNIQUE NOT NULL,
        PasswordHash TEXT NOT NULL,
        Role TEXT NOT NULL CHECK(Role IN ('Admin', 'Local')),
        Status TEXT DEFAULT 'Active',
        LastActive TIMESTAMP,
        CreatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Create Entries Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS entries (
        EntryID INTEGER PRIMARY KEY AUTOINCREMENT,
        UserID INTEGER NOT NULL,
        WorkOrder INTEGER NOT NULL,
        PackNo INTEGER NOT NULL,
        PLType TEXT NOT NULL,
        SubPLType TEXT NOT NULL,
        Location TEXT NOT NULL,
        Customer TEXT NOT NULL,
        EntryTimestamp TEXT NOT NULL, -- format: YYYY-MM-DD HH:MM:SS
        SourcePC_IP TEXT NOT NULL,
        Mode TEXT DEFAULT 'Manual',
        FOREIGN KEY (UserID) REFERENCES users (UserID) ON DELETE CASCADE
    );
    """)

    # Create User Daily Tracking Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS user_daily_tracking (
        TrackID INTEGER PRIMARY KEY AUTOINCREMENT,
        EntryID INTEGER NOT NULL,
        MasterUniqueID INTEGER NOT NULL,
        UniqueIDByUser TEXT NOT NULL,
        DailyCountID INTEGER NOT NULL,
        UserDailyCountID INTEGER NOT NULL,
        UniqueIDByDayByUser TEXT NOT NULL,
        FOREIGN KEY (EntryID) REFERENCES entries (EntryID) ON DELETE CASCADE
    );
    """)

    # Create Indexes for optimization
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_entries_timestamp ON entries(EntryTimestamp);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_entries_userid ON entries(UserID);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_entries_location ON entries(Location);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_username ON users(Username);")

    # Migrate users table to add Status column if not exists
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN Status TEXT DEFAULT 'Active';")
    except sqlite3.OperationalError:
        pass

    # Migrate entries table to add Mode column if not exists
    try:
        cursor.execute("ALTER TABLE entries ADD COLUMN Mode TEXT DEFAULT 'Manual';")
    except sqlite3.OperationalError:
        pass

    conn.commit()
    conn.close()
    print(f"Database initialized successfully at: {db_path}")

if __name__ == "__main__":
    init_db("pl_tracker.db")

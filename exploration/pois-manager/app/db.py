import sqlite3
from pathlib import Path

DB_PATH = Path("data/assignments.db")

def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS assignments (
            profile TEXT NOT NULL,
            uuid TEXT NOT NULL,
            set_path TEXT NOT NULL,
            PRIMARY KEY (profile, uuid)
        )
    """)
    conn.commit()
    conn.close()

def get_assignment(profile: str, user_uuid: str):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT set_path FROM assignments WHERE profile=? AND uuid=?", (profile, user_uuid))
    row = c.fetchone()
    conn.close()
    return row[0] if row else None

def save_assignment(profile: str, user_uuid: str, set_path: str):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        "INSERT OR REPLACE INTO assignments (profile, uuid, set_path) VALUES (?,?,?)",
        (profile, user_uuid, set_path)
    )
    conn.commit()
    conn.close()

def used_sets(profile: str):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT set_path FROM assignments WHERE profile=?", (profile,))
    rows = c.fetchall()
    conn.close()
    return {r[0] for r in rows}

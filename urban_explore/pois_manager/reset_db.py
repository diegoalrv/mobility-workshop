#!/usr/bin/env python3
"""
reset_db.py
Elimina y recrea la base de datos assignments.db.
"""

import sqlite3
from pathlib import Path

DB_PATH = Path("data/assignments.db")

def reset_db():
    # Si existe, se elimina
    if DB_PATH.exists():
        print(f"🗑️  Eliminando base de datos existente: {DB_PATH}")
        DB_PATH.unlink()

    # Crear carpeta data si no existe
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    print("📦 Creando nueva base de datos y tabla assignments...")
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""
        CREATE TABLE assignments (
            profile TEXT NOT NULL,
            uuid TEXT NOT NULL,
            set_path TEXT NOT NULL,
            PRIMARY KEY (profile, uuid)
        )
    """)
    conn.commit()
    conn.close()
    print("✅ Base de datos reiniciada correctamente.")


if __name__ == "__main__":
    reset_db()

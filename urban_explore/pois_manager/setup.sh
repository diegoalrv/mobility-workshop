#!/bin/bash
set -e

echo "📦 Creando estructura de proyecto..."

# Carpetas base
mkdir -p app
mkdir -p static/places/elderly
mkdir -p static/places/student
mkdir -p static/places/tourist
mkdir -p data    # <-- Aquí se guardará assignments.db

# Crear archivo db.py
cat > app/db.py << 'EOF'
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
EOF

# Crear archivo main.py
cat > app/main.py << 'EOF'
from fastapi import FastAPI, HTTPException
from fastapi.responses import RedirectResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from .db import init_db, get_assignment, save_assignment, used_sets

app = FastAPI()

SETS_BASE = Path("static/places")
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.on_event("startup")
def startup_event():
    init_db()

@app.get("/join/{profile}")
def join(profile: str, uuid: str = None):
    profile_path = SETS_BASE / profile
    if not profile_path.exists():
        raise HTTPException(status_code=404, detail=f"Perfil '{profile}' no existe")

    available_sets = sorted(profile_path.glob("*.geojson"))
    if not available_sets:
        raise HTTPException(status_code=404, detail=f"No hay sets para '{profile}'")

    if not uuid:
        return HTMLResponse(
            f"<h3>⚠️ Falta el parámetro uuid en la URL.</h3>"
            f"<p>Ejemplo: /join/{profile}?uuid=ID_UNICO</p>"
        )

    existing = get_assignment(profile, uuid)
    if existing:
        chosen = existing
    else:
        used = used_sets(profile)
        free_sets = [str(s) for s in available_sets if str(s) not in used]
        if not free_sets:
            raise HTTPException(status_code=410, detail=f"Ya no quedan sets para '{profile}'")
        chosen = free_sets[0]
        save_assignment(profile, uuid, chosen)

    return RedirectResponse(url=f"/viewer/{profile}/{uuid}")

@app.get("/viewer/{profile}/{uuid}")
def viewer(profile: str, uuid: str):
    set_file = get_assignment(profile, uuid)
    if not set_file:
        return HTMLResponse("<h3>⚠️ Usuario no registrado o sin set asignado.</h3>")

    rel_path = set_file.replace("static/", "")

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8"/>
        <title>Mapa asignado - {profile}</title>
        <link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
        <style>html,body,#map {{height:100%; margin:0;}}</style>
    </head>
    <body>
    <div id="map"></div>
    <script>
        var map = L.map('map').setView([-36.82,-73.05], 13);
        L.tileLayer('https://{{s}}.tile.openstreetmap.org/{{z}}/{{x}}/{{y}}.png', {{
            maxZoom: 19,
        }}).addTo(map);

        fetch('/static/{rel_path}')
            .then(r => r.json())
            .then(data => {{
                var layer = L.geoJSON(data).addTo(map);
                map.fitBounds(layer.getBounds());
            }});
    </script>
    </body>
    </html>
    """
    return HTMLResponse(html)
EOF

# Crear requirements.txt
cat > requirements.txt << 'EOF'
fastapi
uvicorn[standard]
EOF

# Crear Dockerfile
cat > Dockerfile << 'EOF'
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ app/
COPY static/ static/
COPY data/ data/

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
EOF

# Crear docker-compose.yml
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  poi-viewer:
    build: .
    container_name: poi-viewer
    ports:
      - "8000:8000"
    volumes:
      - ./static:/app/static
      - ./data:/app/data
    restart: unless-stopped
EOF

# Crear base de datos vacía con permisos correctos
touch data/assignments.db
chmod 666 data/assignments.db

echo "✅ Proyecto inicializado."
echo "1. Pon tus archivos GeoJSON en static/places/<perfil>/"
echo "2. Levanta el proyecto con: docker-compose up -d --build"
echo "3. Accede en el navegador a: http://localhost:8000/join/student?uuid=1213"

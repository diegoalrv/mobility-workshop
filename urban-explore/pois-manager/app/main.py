from fastapi import FastAPI, HTTPException
from fastapi.responses import RedirectResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from .db import init_db, get_assignment, save_assignment, used_sets
from fastapi.templating import Jinja2Templates
from fastapi import Request
import os
import dotenv

dotenv.load_dotenv()  # Cargar variables de entorno desde .env

app = FastAPI()

SETS_BASE = Path("static/places")
app.mount("/static", StaticFiles(directory="static"), name="static")

# Inicializar templates una sola vez a nivel global
templates = Jinja2Templates(directory="templates")

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
def viewer(profile: str, uuid: str, request: Request):
    set_file = get_assignment(profile, uuid)
    if not set_file:
        return HTMLResponse("<h3>⚠️ Usuario no registrado o sin set asignado.</h3>")

    rel_path = set_file.replace("static/", "")

    # Obtener API key de Mapbox desde variables de entorno
    mapbox_api_key = os.getenv("MAPBOX_API_KEY")
    if not mapbox_api_key:
        return HTMLResponse("<h3>⚠️ Error: MAPBOX_API_KEY no configurada en .env</h3>")

    return templates.TemplateResponse(
        "viewer.html",
        {
            "request": request,
            "profile": profile,
            "rel_path": rel_path,
            "mapbox_api_key": mapbox_api_key,
        }
    )
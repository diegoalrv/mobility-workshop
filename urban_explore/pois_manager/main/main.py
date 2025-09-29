from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import RedirectResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pathlib import Path
from .db import init_db, get_assignment, save_assignment, used_sets, used_uuids
from dotenv import load_dotenv
import os
from fastapi.middleware.cors import CORSMiddleware


app = FastAPI(
    title="POIs Manager - Concepción",
    description="Sistema de gestión de Points of Interest para Concepción, Chile",
    version="1.0.0"
)

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],  # o ["http://localhost:8000"] si quieres restringir
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# Cargar .env SOLO si existe (desarrollo local)
if Path(".env").exists():
    load_dotenv()
    print("🔑 Cargando variables desde .env (desarrollo)")

else:
    print("🚀 Usando variables de entorno del sistema (producción)")

# Verificar que tenemos la API key
MAPBOX_API_KEY = os.getenv("MAPBOX_API_KEY")
if not MAPBOX_API_KEY:
    raise ValueError("❌ MAPBOX_API_KEY no encontrada en variables de entorno")

print(f"✅ Mapbox API Key configurada: {MAPBOX_API_KEY[:10]}...")

# Configuración de directorios
BASE_DIR = Path(__file__).parent.parent
SETS_BASE = BASE_DIR / "static" / "places"
STATIC_DIR = BASE_DIR / "static" 
TEMPLATES_DIR = BASE_DIR / "templates"

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))

@app.on_event("startup")
def startup_event():
    init_db()
    print(f"🗺️ POIs Manager iniciado - Concepción, Chile")

@app.get("/")
def home(request: Request):
    return templates.TemplateResponse("home.html", {"request": request})

@app.get("/health")
def health_check():
    return {
        "status": "healthy", 
        "location": "Concepción, Chile",
        "mapbox_configured": MAPBOX_API_KEY is not None,
        "profiles": ["student", "elderly", "tourist", "families", "office_worker", "shop_owner"]
    }

@app.get("/join/{profile}")
def join(profile: str, uuid: str = None):
    profile_path = SETS_BASE / profile
    if not profile_path.exists():
        raise HTTPException(status_code=404, detail=f"Perfil '{profile}' no existe")

    available_sets = sorted(profile_path.glob("*.geojson"))
    if not available_sets:
        raise HTTPException(status_code=404, detail=f"No hay sets para '{profile}'")

    if not uuid:
        usados = used_uuids(profile)
        usados_enteros = {int(u) for u in usados if u.isdigit()}
        nuevo = 1
        while nuevo in usados_enteros:
            nuevo += 1
        uuid = str(nuevo)

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
    rel_path = set_file.replace("/app", "")
    print(rel_path)
    return templates.TemplateResponse(
        "viewer.html",
        {
            "request": request,
            "profile": profile,
            "rel_path": rel_path,
            "uuid": uuid,
            "mapbox_api_key": MAPBOX_API_KEY,
        }
    )
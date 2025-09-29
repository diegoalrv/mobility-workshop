from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import RedirectResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pathlib import Path
from .db import init_db, get_assignment, save_assignment, used_sets
from dotenv import load_dotenv
import os

# Cargar .env SOLO si existe (desarrollo local)
if Path(".env").exists():
    load_dotenv()
    print("🔑 Cargando variables desde .env (desarrollo)")
else:
    print("🚀 Usando variables de entorno del sistema (producción)")

app = FastAPI(
    title="POIs Manager - Concepción",
    description="Sistema de gestión de Points of Interest para Concepción, Chile",
    version="1.0.0"
)

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

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))

@app.on_event("startup")
def startup_event():
    init_db()
    print(f"🗺️ POIs Manager iniciado - Concepción, Chile")

@app.get("/")
def home():
    return HTMLResponse("""
    <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="color: #333; text-align: center;">🗺️ POIs Manager - Concepción</h1>
        <p style="text-align: center; color: #666; font-size: 18px;">Sistema de gestión de Points of Interest para Concepción, Chile</p>
        
        <div style="background: #f8f9fa; padding: 30px; border-radius: 12px; margin: 30px 0;">
            <h2 style="color: #495057;">📱 Perfiles Disponibles:</h2>
            <ul style="list-style: none; padding: 0;">
                <li style="padding: 10px; margin: 10px 0; background: white; border-radius: 8px; border-left: 4px solid #007bff;">
                    <strong>student</strong> - Estudiantes universitarios
                </li>
                <li style="padding: 10px; margin: 10px 0; background: white; border-radius: 8px; border-left: 4px solid #28a745;">
                    <strong>elderly</strong> - Adultos mayores
                </li>
                <li style="padding: 10px; margin: 10px 0; background: white; border-radius: 8px; border-left: 4px solid #ffc107;">
                    <strong>tourist</strong> - Turistas
                </li>
                <li style="padding: 10px; margin: 10px 0; background: white; border-radius: 8px; border-left: 4px solid #17a2b8;">
                    <strong>families</strong> - Familias con niños
                </li>
                <li style="padding: 10px; margin: 10px 0; background: white; border-radius: 8px; border-left: 4px solid #6f42c1;">
                    <strong>office_worker</strong> - Trabajadores de oficina
                </li>
                <li style="padding: 10px; margin: 10px 0; background: white; border-radius: 8px; border-left: 4px solid #e83e8c;">
                    <strong>shop_owner</strong> - Comerciantes locales
                </li>
            </ul>
        </div>
        
        <div style="background: #e7f3ff; padding: 20px; border-radius: 8px; border: 1px solid #b3d9ff;">
            <h3 style="color: #0066cc; margin-top: 0;">🔗 Cómo usar:</h3>
            <code style="background: #fff; padding: 10px; border-radius: 4px; display: block; margin: 10px 0;">
                /join/{perfil}?uuid={tu_id_unico}
            </code>
            <p style="color: #0066cc; margin: 0;">
                <strong>Ejemplo:</strong> <code>/join/student?uuid=estudiante123</code>
            </p>
        </div>
    </div>
    """)

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

    return templates.TemplateResponse(
        "viewer.html",
        {
            "request": request,
            "profile": profile,
            "rel_path": rel_path,
            "mapbox_api_key": MAPBOX_API_KEY,
        }
    )
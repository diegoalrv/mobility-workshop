# 🗺️ Mobility Workshop - Concepción

Sistema interactivo de exploración de Points of Interest (POIs) para diferentes perfiles de usuarios en Concepción, Chile.

## 🌐 Aplicación Web

**🔗 URL Principal:** https://mobility-concepcion-workshop.up.railway.app/

## 🚀 Cómo Usar

### Para Nuevos Usuarios
Únete con tu perfil y ID único:
```
https://mobility-concepcion-workshop.up.railway.app/join/{perfil}?uuid={tu_id_unico}
```

**Ejemplo:**
```
https://mobility-concepcion-workshop.up.railway.app/join/student?uuid=estudiante123
```

### Para Sesiones Existentes
Regresa a tu mapa personalizado:
```
https://mobility-concepcion-workshop.up.railway.app/viewer/{perfil}/{uuid}
```

## 👥 Perfiles Disponibles

| Perfil | Descripción | URL de Ejemplo |
|--------|-------------|----------------|
| `student` | Estudiantes universitarios | `/join/student?uuid=est001` |
| `elderly` | Adultos mayores | `/join/elderly?uuid=mayor001` |
| `tourist` | Turistas | `/join/tourist?uuid=tur001` |
| `families` | Familias con niños | `/join/families?uuid=fam001` |
| `office_worker` | Trabajadores de oficina | `/join/office_worker?uuid=ofi001` |
| `shop_owner` | Comerciantes locales | `/join/shop_owner?uuid=com001` |

## 📱 Generación de QR Codes

Para crear códigos QR para cada perfil:

```python
import qrcode
import os

BASE_URL = "https://mobility-concepcion-workshop.up.railway.app"

PROFILES = {
    "student": "Estudiantes",
    "elderly": "Adultos Mayores", 
    "tourist": "Turistas",
    "families": "Familias",
    "office_worker": "Trabajadores",
    "shop_owner": "Comerciantes"
}

def generate_qr_codes():
    os.makedirs("qr_codes", exist_ok=True)
    
    for profile, name in PROFILES.items():
        # Genera URL con placeholder para ID personalizado
        url = f"{BASE_URL}/join/{profile}?uuid=CHANGE_THIS_ID"
        
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(url)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        img.save(f"qr_codes/{profile}_qr.png")
        
        print(f"✅ QR generado para {name}")
        print(f"   📁 Archivo: qr_codes/{profile}_qr.png")
        print(f"   🔗 URL: {url}")
        print()

if __name__ == "__main__":
    generate_qr_codes()
    print("🎯 ¡Todos los códigos QR generados en carpeta 'qr_codes/'!")
```

## 🗺️ Características del Sistema

### ✨ Funcionalidades
- **Mapas interactivos** con Mapbox GL JS
- **POIs categorizados** por tipo (restaurantes, cafés, universidades, etc.)
- **Asignación única** de conjuntos de POIs por usuario
- **Integración con Google Maps** para navegación
- **Diseño responsive** para móviles y desktop
- **Persistencia de sesiones** con SQLite

### 🎯 POIs Incluidos
- 🍽️ **Restaurantes** y cafeterías
- 🎓 **Universidades** y escuelas
- 🏪 **Tiendas** y supermercados
- 🏢 **Oficinas** y espacios de trabajo
- 🌳 **Parques** y espacios recreativos
- 🏥 **Servicios** públicos y salud
- 📷 **Atracciones** turísticas
- 🏠 **Zonas** residenciales

## 🛠️ Estructura del Proyecto

```
mobility-workshop/
├── README.md                          # Este archivo
├── railway.toml                       # Configuración de deployment
├── .gitignore                        # Archivos ignorados por Git
├── exploration/                      # Módulo de exploración de datos
│   ├── download_pois.py             # Descarga POIs con OSMnx
│   ├── transform_pois.py            # Procesamiento y categorización
│   ├── generate_sets.py             # Generación de conjuntos por perfil
│   └── app/                         # Aplicación web FastAPI
├── urban-explore/
│   └── pois-manager/                # 🚀 Aplicación desplegada
│       ├── app/
│       │   ├── main.py             # API principal FastAPI
│       │   └── db.py               # Manejo de base de datos
│       ├── static/
│       │   ├── css/style.css       # Estilos personalizados
│       │   ├── js/script.js        # Lógica del mapa Mapbox
│       │   └── places/             # Conjuntos de POIs por perfil
│       └── templates/
│           └── viewer.html         # Interfaz del mapa
└── data/                           # Datasets procesados (local)
```

## 🔧 Desarrollo Local

### Requisitos
```bash
pip install fastapi uvicorn python-dotenv jinja2
```

### Variables de Entorno
Crear archivo `.env` en `urban-explore/pois-manager/`:
```env
MAPBOX_API_KEY=pk.eyJ1IjoiQ...
```

### Ejecutar Localmente
```bash
cd urban-explore/pois-manager
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Visita: `http://localhost:8000`

## 📊 Endpoints de la API

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/` | GET | Página de inicio con instrucciones |
| `/health` | GET | Estado de salud de la aplicación |
| `/join/{profile}?uuid={id}` | GET | Unirse con un perfil específico |
| `/viewer/{profile}/{uuid}` | GET | Ver mapa asignado a usuario |

## 🎨 Personalización

### Añadir Nuevos Perfiles
1. Editar `generate_sets.py` en el módulo exploration
2. Añadir reglas de categorización para el nuevo perfil
3. Regenerar conjuntos de POIs
4. Desplegar cambios

### Modificar Estilos del Mapa
- Editar `static/css/style.css` para estilos generales
- Modificar `static/js/script.js` para colores y comportamiento de POIs
- Cambiar template `viewer.html` para estructura HTML

## 🚀 Deployment

La aplicación está desplegada en **Railway** con:
- ✅ URL fija para códigos QR
- ✅ Variables de entorno seguras
- ✅ Escalabilidad automática
- ✅ HTTPS incluido

### Redesplegar
Los cambios se despliegan automáticamente al hacer push a la rama `main`.

## 📈 Métricas y Monitoreo

- **Health Check**: `/health` - Verifica estado de la aplicación
- **Logs**: Disponibles en Railway dashboard
- **Performance**: Railway proporciona métricas de CPU, RAM y respuesta

## 🔒 Seguridad

- ✅ Variables de entorno protegidas
- ✅ API keys no expuestas en código
- ✅ Archivos sensibles en `.gitignore`
- ✅ HTTPS forzado en producción

## 🤝 Uso en Workshop

### Para Participantes
1. **Escanea** el código QR de tu perfil
2. **Añade** tu ID único en la URL
3. **Explora** tu conjunto personalizado de POIs
4. **Navega** usando la integración con Google Maps

### Para Organizadores
1. **Genera** códigos QR usando el script Python
2. **Imprime** o comparte digitalmente
3. **Monitorea** uso en Railway dashboard
4. **Analiza** patrones de asignación en base de datos

## 📞 Soporte

- **URL Principal**: https://mobility-concepcion-workshop.up.railway.app/
- **Health Check**: https://mobility-concepcion-workshop.up.railway.app/health
- **Repositorio**: Este proyecto en GitHub

---

### 📍 Acerca del Proyecto

Sistema desarrollado para workshop de movilidad urbana en **Concepción, Chile**. 
Permite exploración interactiva de Points of Interest adaptados a diferentes perfiles de usuarios urbanos.

**Stack Tecnológico**: FastAPI, Mapbox GL JS, SQLite, Railway, Python
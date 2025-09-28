# Exploración de Datos de Movilidad

Este módulo contiene herramientas para la descarga, procesamiento, categorización y visualización de datos de Points of Interest (POIs) categorizados por perfiles de usuario.

## Estructura del Proyecto

```
urban-explore/
├── app/                          # Aplicación web FastAPI
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # Aplicación principal con endpoints
│   │   └── db.py                # Manejo de base de datos SQLite
│   ├── static/
│   │   └── places/              # Conjuntos de POIs por perfil (generados automáticamente)
│   │       ├── elderly/         # Sets para personas mayores
│   │       ├── student/         # Sets para estudiantes
│   │       ├── office_worker/   # Sets para trabajadores de oficina
│   │       ├── tourist/         # Sets para turistas
│   │       ├── families/        # Sets para familias
│   │       └── shop_owner/      # Sets para comerciantes
│   └── templates/
│       └── viewer.html          # Template HTML con mapa interactivo
├── data/                        # Directorio de datos (ignorado en git)
│   ├── places/                  # Conjuntos generados originales
│   ├── pois.gpkg               # POIs descargados (OSMnx)
│   ├── area_mobility_workshop   # Archivo del área de interés
│   ├── pois_categorizados.gpkg  # POIs categorizados completos
│   ├── pois_categorizados.geojson # POIs categorizados en GeoJSON
│   └── pois_categorizados_filtrados.parquet  # Datos finales procesados
├── download_pois.py             # Script para descargar POIs con OSMnx
├── transform_pois.py            # Script para categorizar y filtrar POIs
├── generate_sets.py             # Script para generar conjuntos por perfil
└── README.md                    # Este archivo
```

## Pipeline de Datos

### 1. Descarga de POIs (`download_pois.py`)

Script que descarga Points of Interest usando OSMnx para una zona geográfica específica.

**Funcionalidades:**
- Descarga POIs por categorías (amenities, buildings, landuse, etc.)
- Usa un área de interés (ROI) para delimitar la descarga
- Guarda datos en formato GPKG para preservar geometrías
- Incluye metadatos completos de OpenStreetMap

**Categorías descargadas:**
- `amenity`: Restaurants, cafés, hospitales, escuelas, etc.
- `tourism`: Museos, atracciones, hoteles, etc.
- `leisure`: Parques, gimnasios, centros deportivos, etc.
- `shop`: Tiendas, supermercados, comercios, etc.
- `office`: Oficinas, edificios comerciales, etc.
- `building`: Edificios residenciales y comerciales
- `landuse`: Usos de suelo diversos

**Uso:**
```bash
python download_pois.py
```

**Requisitos:**
- Archivo del área de interés en `./data/area_mobility_workshop`
- Conexión a internet para acceder a OSM

### 2. Transformación y Categorización (`transform_pois.py`)

Script que procesa los POIs descargados, los categoriza según perfiles de usuario y los filtra por área de interés.

**Proceso de transformación:**
1. **Carga** de POIs desde archivo GPKG
2. **Categorización** usando reglas específicas por perfil
3. **Filtrado geográfico** por área de interés
4. **Separación** de geometrías (puntos vs polígonos)
5. **Validación** y limpieza de datos
6. **Exportación** en múltiples formatos

**Reglas de categorización:**
```python
category_rules = {
    "storefront": {"shop": True},
    "university": {"amenity": "university"},
    "cafe": {"amenity": "cafe"},
    "grocery_store": {"shop": ["supermarket", "convenience"], "amenity": "marketplace"},
    "restaurant": {"amenity": "restaurant"},
    "market": {"amenity": "marketplace"},
    "residential": {"building": "residential", "landuse": "residential"},
    "pub": {"amenity": "pub"},
    "tourist_places": {"tourism": ["attraction", "museum", "viewpoint"]},
    "park": {"leisure": "park"},
    "school": {"amenity": "school"},
    "office": {"office": True},
    "plaza": {"leisure": "plaza", "amenity": "town_square"},
    "gym": {"amenity": "gym", "leisure": "fitness_centre"}
}
```

**Uso:**
```bash
python transform_pois.py
```

**Salidas:**
- `pois_categorizados.gpkg`: Todos los POIs categorizados
- `pois_categorizados.geojson`: Versión GeoJSON
- `pois_categorizados_filtrados.parquet`: Dataset final filtrado

### 3. Generación de Conjuntos (`generate_sets.py`)

Script que genera conjuntos específicos de POIs para diferentes perfiles de usuario a partir del dataset procesado.

**Perfiles disponibles:**
- `elderly`: Personas mayores (residencial, supermercados, parques)
- `student`: Estudiantes (universidades, bares, gimnasios)
- `office_worker`: Trabajadores de oficina (oficinas, restaurantes, residencial)
- `tourist`: Turistas (2 lugares turísticos + 1 bar/pub)
- `families`: Familias (parques, escuelas, residencial)
- `shop_owner`: Comerciantes (2 tiendas + 1 residencial)

**Características:**
- Selección aleatoria balanceada por categoría
- Reglas específicas por perfil
- Conversión de polígonos a centroides para mapas
- Copia automática a directorio de aplicación web
- Generación en formato GeoJSON

**Uso:**
```bash
python generate_sets.py
```

### 4. Aplicación Web (`app/`)

Aplicación FastAPI que permite visualizar los conjuntos de POIs en un mapa interactivo.

#### Endpoints principales:

- `GET /join/{profile}?uuid={id}`: Asigna un conjunto único a un usuario
- `GET /viewer/{profile}/{uuid}`: Muestra el mapa con el conjunto asignado

#### Características:
- Asignación automática de conjuntos únicos por usuario
- Base de datos SQLite para tracking de asignaciones
- Mapa interactivo usando Leaflet
- Carga dinámica de archivos GeoJSON
- Popups informativos para cada POI
- Sistema de archivos estáticos para servir datos

## Instalación y Configuración

### Requisitos

```bash
pip install osmnx geopandas pandas fastapi uvicorn
```

### Pipeline completo de datos

1. **Prepara el área de interés:**
   - Coloca el archivo del área de interés en `./data/area_mobility_workshop`

2. **Descarga POIs:**
   ```bash
   python download_pois.py
   ```

3. **Procesa y categoriza datos:**
   ```bash
   python transform_pois.py
   ```

4. **Genera conjuntos por perfil:**
   ```bash
   python generate_sets.py
   ```

### Ejecutar la aplicación

```bash
cd app
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Uso de la Aplicación Web

### Paso 1: Unirse a un perfil
Visita: `http://localhost:8000/join/{perfil}?uuid={tu_id_unico}`

Ejemplo:
```
http://localhost:8000/join/student?uuid=usuario123
```

### Paso 2: Ver el mapa
Serás redirigido automáticamente al visor de mapas donde podrás:
- Ver tu conjunto único de POIs en un mapa interactivo
- Hacer clic en los elementos para ver información detallada
- Explorar la ubicación de cada punto de interés

## Configuración Avanzada

### Personalizar categorización

Edita las reglas en `transform_pois.py`:

```python
category_rules = {
    "nueva_categoria": {"tag_osm": "valor_requerido"},
    # ...más reglas
}
```

### Añadir nuevos perfiles

Modifica el diccionario `profiles_pois` en `generate_sets.py`:

```python
"nuevo_perfil": {
    "categoria1": ["tag_osm1", "tag_osm2"],
    "categoria2": ["tag_osm3", "tag_osm4"]
}
```

### Ajustar parámetros de generación

En `generate_sets.py`:

```python
SETS_PER_PROFILE = 100    # Número de sets por perfil
RANDOM_SEED = None        # Para resultados reproducibles
MIN_POIS_PER_SET = 3      # Mínimo de POIs por conjunto
```

### Personalizar el mapa

Edita `templates/viewer.html` para cambiar:
- Estilos del mapa y marcadores
- Coordenadas centrales por defecto
- Configuración de popups y tooltips
- Capas base del mapa (OpenStreetMap, etc.)

## Estructura de Datos

### POIs descargados (`pois.gpkg`)
Datos directos de OpenStreetMap con todas las propiedades originales y geometrías preservadas.

### POIs categorizados (`pois_categorizados_filtrados.parquet`)
Dataset procesado y filtrado con estructura simplificada:

```python
{
    'geometry': Point/Polygon,
    'name': 'Nombre del POI',
    'category': 'categoria_simplificada',
    'amenity': 'amenity_original_osm',
    'shop': 'tipo_tienda_si_aplica',
    'tourism': 'atraccion_si_aplica',
    'building': 'tipo_edificio_si_aplica'
}
```

### Sets de POIs (archivos GeoJSON)
Conjuntos específicos por perfil en formato GeoJSON estándar:

```json
{
  "type": "Feature",
  "geometry": {
    "type": "Point",
    "coordinates": [longitud, latitud]
  },
  "properties": {
    "name": "Nombre del POI",
    "category": "categoria",
    "amenity": "tipo_amenidad",
    "profile": "perfil_asociado"
  }
}
```

## Base de Datos

La aplicación usa SQLite para rastrear asignaciones de usuarios:

```sql
CREATE TABLE assignments (
    id INTEGER PRIMARY KEY,
    profile TEXT NOT NULL,
    user_uuid TEXT NOT NULL,
    set_path TEXT NOT NULL,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(profile, user_uuid)
);
```

## Archivos Ignorados

Los siguientes archivos están configurados para ser ignorados por Git (ver `.gitignore`):

- Archivos del directorio `data/` (datasets grandes)
- Archivos CSV temporales
- Configuraciones de entorno (.env)
- Archivos del sistema (.DS_Store, etc.)
- Logs y archivos temporales

## Monitoreo y Métricas

### Calidad de datos
- Completitud por categoría después del procesamiento
- Distribución geográfica de POIs filtrados
- POIs categorizados vs no categorizados

### Uso de la aplicación
- Asignaciones por perfil y fecha
- Sets más/menos utilizados
- Patrones temporales de acceso

## Solución de Problemas

### Error en descarga de POIs
- **Sin área de interés**: Verifica que existe `./data/area_mobility_workshop`
- **Timeout de OSMnx**: Reduce el área de interés o reintenta
- **Sin conectividad**: Verifica conexión a internet

### Error en transformación
- **Archivo GPKG no encontrado**: Ejecuta primero `download_pois.py`
- **CRS incompatibles**: El script maneja reprojeccion automática
- **Categorías vacías**: Revisa las reglas de categorización

### Error en generación de sets
- **Archivo Parquet faltante**: Ejecuta `transform_pois.py` primero
- **POIs insuficientes**: Reduce `SETS_PER_PROFILE` o ajusta filtros
- **Sin diversidad por perfil**: Verifica categorías disponibles en datos

### Errores de la aplicación web
- **Template not found**: Asegúrate de que existe `app/templates/viewer.html`
- **Profile not found**: Verifica archivos en `app/static/places/`
- **Sin conjuntos disponibles**: Regenera sets o reduce usuarios concurrentes

## Desarrollo

### Estructura de desarrollo recomendada

1. **Modificar descarga**: Ajusta `download_pois.py`
2. **Cambiar categorización**: Edita reglas en `transform_pois.py`
3. **Ajustar perfiles**: Modifica `generate_sets.py`
4. **Personalizar interfaz**: Cambia archivos en `app/`

### Flujo de desarrollo

```bash
# 1. Preparar datos
python download_pois.py
python transform_pois.py
python generate_sets.py

# 2. Desarrollar aplicación
cd app
uvicorn app.main:app --reload

# 3. Probar cambios
# Visitar http://localhost:8000/join/student?uuid=test123
```

### Contribuir al proyecto

1. Fork del repositorio
2. Crea una rama para tu feature
3. Implementa cambios siguiendo el pipeline
4. Prueba con datos locales
5. Crea pull request con descripción detallada

## Performance

### Optimizaciones implementadas
- Uso de Parquet para almacenamiento eficiente
- Separación de geometrías por tipo para procesamiento
- Índices espaciales automáticos en GeoPandas
- Carga lazy de templates en FastAPI

### Consideraciones de escala
- **Área geográfica**: Límites recomendados por performance de OSMnx
- **Número de sets**: Balance entre diversidad y storage
- **Usuarios concurrentes**: SQLite maneja bien carga moderada

## Referencias

- [OSMnx](https://osmnx.readthedocs.io/) - Descarga de datos OSM
- [OpenStreetMap](https://www.openstreetmap.org/) - Fuente de datos
- [FastAPI](https://fastapi.tiangolo.com/) - Framework web
- [Leaflet](https://leafletjs.com/) - Biblioteca de mapas
- [GeoPandas](https://geopandas.org/) - Procesamiento geoespacial
- [OpenStreetMap Wiki](https://wiki.openstreetmap.org/wiki/Map_Features) - Tags y categorías

## Licencia

[Especificar licencia aquí]
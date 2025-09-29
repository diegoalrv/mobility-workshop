#!/usr/bin/env python3
"""
Genera conjuntos de POIs para distintos perfiles de usuario a partir de un GeoDataFrame
ya categorizado. Crea carpetas /data/places/{perfil}/ con archivos 1.geojson, 2.geojson, ...
"""

import geopandas as gpd
import pandas as pd
import random
from pathlib import Path

# =====================
# CONFIGURACIÓN
# =====================

INPUT_FILE = "./data/pois_categorizados_filtrados_refinados.parquet"
OUTPUT_BASE = Path("./data/places")
SETS_PER_PROFILE = 200    # <-- Cuántos sets generar por perfil
RANDOM_SEED = None        # Fijar semilla para reproducibilidad (None para aleatorio cada vez)

# =====================
# DEFINICIÓN DE PERFILES
# =====================

profiles_pois = {
    "elderly": {
        "residential": ["residential"],
        "grocery_store": ["supermarket", "convenience", "marketplace"],
        "park": ["square", "park"]
    },
    "student": {
        "university": ["university", "college", "school"],
        "pub": ["pub", "bar", "nightclub"],
        "gym": ["gym", "fitness_centre", "sports_centre"]
    },
    "office_worker": {
        "office": ["office", "commercial"],
        "restaurant": ["restaurant", "cafe", "fast_food"],
        "residential": ["residential"]
    },
    "tourist": {
        "tourist_places": ["museum", "art_gallery", "viewpoint", "attraction", "monument", "historic", "tourism"]
        # Reglas: 2 turísticos + 1 pub/bar
    },
    "families": {
        "park": ["park", "playground", "garden"],
        "school": ["school", "kindergarten"],
        "residential": ["residential"]
    },
    "shop_owner": {
        "residential": ["residential"],
        "storefront": ["shop", "marketplace", "supermarket", "convenience"]
    }
}

# =====================
# FUNCIONES
# =====================

def pick_pois_for_profile(profile_name, rules, gdf):
    """
    Selecciona un subconjunto de POIs para un perfil dado.
    Devuelve una lista de registros (dict) y mensajes de advertencia si faltan categorías.
    """
    warnings = []
    selected = []

    if profile_name == "tourist":
        # 2 lugares turísticos
        turis = gdf[gdf["category"] == "tourist_places"]
        if len(turis) >= 2:
            selected.extend(turis.sample(2, random_state=RANDOM_SEED).to_dict("records"))
        elif len(turis) == 1:
            selected.extend(turis.to_dict("records"))
            warnings.append("⚠️ Solo se encontró 1 lugar turístico (se requerían 2).")
        else:
            warnings.append("⚠️ No hay lugares turísticos disponibles.")

        # 1 pub/bar
        pubs = gdf[gdf["category"] == "pub"]
        if len(pubs) >= 1:
            selected.extend(pubs.sample(1, random_state=RANDOM_SEED).to_dict("records"))
        else:
            warnings.append("⚠️ No hay pubs/bars disponibles.")
        return selected, warnings
    
    if profile_name == "shop_owner":
        # 2 storefronts
        stores = gdf[gdf["category"] == "storefront"]
        if len(stores) >= 2:
            selected.extend(stores.sample(2, random_state=RANDOM_SEED).to_dict("records"))
        elif len(stores) == 1:
            selected.extend(stores.to_dict("records"))
            warnings.append("⚠️ Solo se encontró 1 tienda (se requerían 2).")
        else:
            warnings.append("⚠️ No hay tiendas disponibles.")

        # 1 residential
        res = gdf[gdf["category"] == "residential"]
        if len(res) >= 1:
            selected.extend(res.sample(1, random_state=RANDOM_SEED).to_dict("records"))
        else:
            warnings.append("⚠️ No hay áreas residenciales disponibles.")
        return selected, warnings

    # Otros perfiles: 1 por cada categoría clave
    for cat_key in rules.keys():
        subset = gdf[gdf["category"] == cat_key]
        if len(subset) >= 1:
            selected.extend(subset.sample(1, random_state=RANDOM_SEED).to_dict("records"))
        else:
            warnings.append(f"⚠️ No hay elementos para categoría '{cat_key}'.")
    return selected, warnings


# =====================
# PROCESO PRINCIPAL
# =====================

print("📥 Cargando POIs...")
gdf = gpd.read_parquet(INPUT_FILE)
if gdf.crs is None or gdf.crs.to_epsg() != 4326:
    gdf.set_crs("EPSG:4326", inplace=True, allow_override=True)

gdf_ = gdf[gdf['category'].notna()].copy()  # Asegurar que no haya categorías nulas
gdf_points = gdf_[gdf_.geometry.type == 'Point'].copy()
gdf_polygons = gdf_[gdf_.geometry.type.isin(['Polygon', 'MultiPolygon'])].copy()
# In case of polygons, extract the centroid for selection purposes, but it has to be inside the polygon
gdf_polygons['geometry'] = gdf_polygons.centroid
gdf = pd.concat([gdf_points, gdf_polygons], ignore_index=True)
gdf = gpd.GeoDataFrame(gdf, geometry='geometry', crs=gdf.crs)

OUTPUT_BASE.mkdir(parents=True, exist_ok=True)

for profile, rules in profiles_pois.items():
    profile_dir = OUTPUT_BASE / profile
    profile_dir.mkdir(parents=True, exist_ok=True)
    print(f"\n➡️ Generando {SETS_PER_PROFILE} sets para perfil: {profile}")

    for i in range(1, SETS_PER_PROFILE + 1):
        selected, warnings = pick_pois_for_profile(profile, rules, gdf)
        if not selected:
            print(f"❌ Set {i} para {profile} no se generó (sin datos).")
            continue

        subset = gpd.GeoDataFrame(selected, crs=gdf.crs)
        output_file = profile_dir / f"{i}.geojson"
        subset.to_file(output_file, driver="GeoJSON")
        print(f"   ✅ Set {i} guardado en {output_file}")
        if warnings:
            for w in warnings:
                print(f"      {w}")

print("\n🏁 Proceso completado. Revisa la carpeta ./data/places/")

# Ahora puedes copia ./data/places/ a ./app/static/places/ para que la app lo use.

import shutil
shutil.copytree(OUTPUT_BASE, Path("./pois-manager/static/places"), dirs_exist_ok=True)
print("📂 Copiados los sets a ./pois-manager/static/places/ para la app.")


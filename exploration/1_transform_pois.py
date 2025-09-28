#!/usr/bin/env python3
"""
Procesa y categoriza POIs descargados, filtrándolos por área de interés.
Convierte el archivo pois.gpkg en pois_categorizados_filtrados.parquet
"""

import osmnx as ox
import geopandas as gpd
import pandas as pd
from pathlib import Path

# =====================
# CONFIGURACIÓN
# =====================

INPUT_POIS_FILE = "./data/pois.gpkg"
INPUT_ROI_FILE = "./data/area_mobility_workshop"
OUTPUT_GPKG = "./data/pois_categorizados.gpkg"
OUTPUT_GEOJSON = "./data/pois_categorizados.geojson"
OUTPUT_PARQUET = "./data/pois_categorizados_filtrados.parquet"

# Diccionario de categorías de OSM para cada perfil
profiles_pois = {
    "elderly": {
        "residential": ["residential"],
        "grocery_store": ["supermarket", "convenience", "marketplace"],
        "plaza": ["square", "park"]
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
    },
    "families": {
        "park": ["park", "playground", "garden"],
        "school": ["school", "kindergarten"],
        "residential": ["residential"]
    },
    "shop_owner": {
        "residential": ["residential"],
        "market": ["marketplace", "supermarket", "convenience"],
        "storefront": ["shop"]
    }
}

# =====================
# FUNCIONES
# =====================

def assign_category(row):
    """
    Asigna una categoría a cada POI basada en las reglas definidas.
    """
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
        "gym": {"amenity": "gym", "leisure": "fitness_centre", "sport": ["fitness", "gymnastics"]},
    }
    
    for cat, rules in category_rules.items():
        for key, values in rules.items():
            if key not in row or pd.isna(row.get(key)):
                continue
            val = row.get(key)
            if values is True:  # Cualquier valor sirve
                return cat
            if isinstance(values, list) and val in values:
                return cat
            if val == values:
                return cat
    return None

def load_and_categorize_pois():
    """
    Carga los POIs y les asigna categorías.
    """
    print("📥 Cargando POIs desde archivo GPKG...")
    gdf = gpd.read_file(INPUT_POIS_FILE, layer="pois")
    print(f"✅ Cargados {len(gdf)} POIs")
    
    print("🏷️ Asignando categorías...")
    # Crear nueva columna de categoría
    gdf["category"] = gdf.apply(assign_category, axis=1)
    
    # Si alguna quedó sin categoría, usa la columna main_category original como fallback
    gdf["category"] = gdf["category"].fillna(gdf.get("main_category"))
    
    # Mostrar resumen de categorización
    category_counts = gdf["category"].value_counts()
    print(f"📊 Categorías asignadas:")
    for cat, count in category_counts.head(10).items():
        print(f"   {cat}: {count}")
    
    uncategorized = gdf["category"].isna().sum()
    if uncategorized > 0:
        print(f"⚠️ POIs sin categoría: {uncategorized}")
    
    return gdf

def filter_by_roi(gdf):
    """
    Filtra los POIs por el área de interés (ROI).
    """
    print("🗺️ Cargando área de interés...")
    roi = gpd.read_file(INPUT_ROI_FILE)
    print(f"✅ Área de interés cargada: {roi.crs}")
    
    # Asegurar que ambos GeoDataFrames usen el mismo CRS
    if gdf.crs != roi.crs:
        print(f"🔄 Reprojectando POIs de {gdf.crs} a {roi.crs}")
        gdf = gdf.to_crs(roi.crs)
    
    print("🔍 Filtrando POIs por área de interés...")
    
    # Filtrar puntos
    print("   📍 Procesando geometrías tipo Point...")
    gdf_points = gdf[gdf.geometry.type == 'Point'].copy()
    gdf_points_filtered = gdf_points[gdf_points['category'].notna()].copy()
    gdf_points_filtered = gpd.overlay(gdf_points_filtered, roi, how='intersection')
    print(f"   ✅ {len(gdf_points_filtered)} puntos dentro del área")
    
    # Filtrar polígonos
    print("   🏢 Procesando geometrías tipo Polygon/MultiPolygon...")
    gdf_polygons = gdf[gdf.geometry.type.isin(['Polygon', 'MultiPolygon'])].copy()
    gdf_polygons_filtered = gdf_polygons[gdf_polygons['category'].notna()].copy()
    gdf_polygons_filtered = gpd.overlay(gdf_polygons_filtered, roi, how='intersection')
    print(f"   ✅ {len(gdf_polygons_filtered)} polígonos dentro del área")
    
    # Combinar resultados
    print("🔗 Combinando geometrías filtradas...")
    gdf_filtered = pd.concat([gdf_points_filtered, gdf_polygons_filtered], ignore_index=True)
    gdf_filtered = gpd.GeoDataFrame(gdf_filtered, geometry='geometry', crs=gdf.crs)
    
    print(f"✅ Total POIs filtrados: {len(gdf_filtered)}")
    return gdf_filtered

def export_results(gdf_categorized, gdf_filtered):
    """
    Exporta los resultados en múltiples formatos.
    """
    print("💾 Exportando resultados...")
    
    # Crear directorio de datos si no existe
    Path("./data").mkdir(exist_ok=True)
    
    # Exportar POIs categorizados (antes del filtrado geográfico)
    print(f"   📄 Exportando a {OUTPUT_GPKG}")
    gdf_categorized.to_file(OUTPUT_GPKG, layer="pois", driver="GPKG")
    
    print(f"   📄 Exportando a {OUTPUT_GEOJSON}")
    gdf_categorized.to_file(OUTPUT_GEOJSON, driver="GeoJSON")
    
    # Exportar POIs filtrados (resultado final)
    print(f"   📄 Exportando resultado final a {OUTPUT_PARQUET}")
    gdf_filtered.to_parquet(OUTPUT_PARQUET, index=False)
    
    print("✅ Exportación completa")

def show_summary(gdf_filtered):
    """
    Muestra un resumen de los datos procesados.
    """
    print("\n📊 RESUMEN FINAL:")
    print(f"   Total POIs procesados: {len(gdf_filtered)}")
    print(f"   CRS: {gdf_filtered.crs}")
    
    print("\n📈 Distribución por categoría:")
    category_counts = gdf_filtered["category"].value_counts()
    for cat, count in category_counts.items():
        print(f"   {cat}: {count}")
    
    print(f"\n📋 Columnas disponibles: {list(gdf_filtered.columns)}")
    print(f"💾 Archivo final guardado en: {OUTPUT_PARQUET}")

# =====================
# PROCESO PRINCIPAL
# =====================

def main():
    """
    Ejecuta el proceso completo de transformación de POIs.
    """
    print("🚀 Iniciando proceso de transformación de POIs...")
    
    try:
        # Verificar archivos de entrada
        if not Path(INPUT_POIS_FILE).exists():
            raise FileNotFoundError(f"No se encuentra el archivo de POIs: {INPUT_POIS_FILE}")
        
        if not Path(INPUT_ROI_FILE).exists():
            raise FileNotFoundError(f"No se encuentra el archivo de ROI: {INPUT_ROI_FILE}")
        
        # 1. Cargar y categorizar POIs
        gdf_categorized = load_and_categorize_pois()
        
        # 2. Filtrar por área de interés
        gdf_filtered = filter_by_roi(gdf_categorized)
        
        # 3. Exportar resultados
        export_results(gdf_categorized, gdf_filtered)
        
        # 4. Mostrar resumen
        show_summary(gdf_filtered)
        
        print("\n🏁 Proceso completado exitosamente!")
        print(f"👉 El archivo {OUTPUT_PARQUET} está listo para usar con generate_sets.py")
        
    except Exception as e:
        print(f"❌ Error en el proceso: {e}")
        raise

if __name__ == "__main__":
    main()
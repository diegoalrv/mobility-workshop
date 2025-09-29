#!/usr/bin/env python3
"""
Extrae POIs de OpenStreetMap usando un polígono propio (GeoDataFrame) con OSMnx.
Incluye gimnasios (amenity=gym, leisure=fitness_centre, sport=fitness/gymnastics).
"""

import osmnx as ox
import geopandas as gpd
import pandas as pd


def extract_pois_from_polygon(polygon_gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """
    Descarga puntos y polígonos de OSM para varias categorías definidas y los unifica en un solo GeoDataFrame.

    Parameters
    ----------
    polygon_gdf : GeoDataFrame
        GeoDataFrame con al menos una geometría poligonal que define el área de interés.

    Returns
    -------
    GeoDataFrame
        Capa única con todos los POIs y columna 'main_category'.
    """

    # Asegurar que está en WGS84
    if polygon_gdf.crs is None or polygon_gdf.crs.to_epsg() != 4326:
        polygon_gdf = polygon_gdf.to_crs("EPSG:4326")

    # Si hay varias geometrías, unirlas en una sola
    area_geom = polygon_gdf.union_all()

    categories = {
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

    all_layers = []

    for cat, tag_filter in categories.items():
        print(f"Descargando categoría: {cat} ...")
        try:
            gdf = ox.features_from_polygon(area_geom, tag_filter)
            if gdf.empty:
                print(f"⚠️  No se encontraron elementos para '{cat}'")
                continue
            gdf = gdf.to_crs("EPSG:4326")
            gdf["main_category"] = cat
            all_layers.append(gdf)
        except Exception as e:
            print(f"Error descargando '{cat}': {e}")

    if not all_layers:
        raise ValueError("No se descargó ningún elemento. Revisa el área o los filtros.")

    gdf_all = gpd.GeoDataFrame(
        pd.concat(all_layers, ignore_index=True),
        crs="EPSG:4326"
    )

    # Filtrar geometrías válidas
    gdf_all = gdf_all[gdf_all.geometry.notnull() & gdf_all.is_valid]

    return gdf_all


if __name__ == "__main__":
    # 👉 Carga tu polígono
    roi = gpd.read_file("./pois-manager/static/geometries/area_mobility_workshop.geojson")

    pois_gdf = extract_pois_from_polygon(roi)

    print(f"\nTotal de POIs descargados: {len(pois_gdf)}")
    print(pois_gdf[["main_category", "geometry"]].head())
    import os
    os.makedirs("./data", exist_ok=True)
    # Exportar resultados
    pois_gdf.to_file("./data/pois.gpkg", layer="pois", driver="GPKG")
    pois_gdf.to_file("./data/pois.geojson", driver="GeoJSON")

    print("\n✅ Datos exportados en './data/pois.gpkg' y './data/pois.geojson'")

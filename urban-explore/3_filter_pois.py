import pandas as pd
import geopandas as gpd

input_path = './data/pois_categorizados_filtrados.parquet'
banned_path = './data/banned.xlsx'
output_path = './data/pois_categorizados_filtrados_refinados.parquet'

print("Leyendo datos principales...")
gdf = gpd.read_parquet(input_path)
print(f"Total de registros cargados: {len(gdf)}")

print("Leyendo lista de nombres baneados...")
banned_df = pd.read_excel(banned_path)
banned_names = set(banned_df.iloc[:, 0].dropna().astype(str).str.strip())
print(f"Nombres baneados cargados: {len(banned_names)}")

# print("Filtrando registros sin nombre o vacíos...")
# before = len(gdf)
# gdf = gdf[gdf['name'].notna() & (gdf['name'].str.strip() != '')]
# print(f"Registros eliminados por nombre vacío: {before - len(gdf)}")

print("Filtrando registros con nombres baneados...")
before = len(gdf)
gdf = gdf[~gdf['name'].astype(str).str.strip().isin(banned_names)]
print(f"Registros eliminados por estar en la lista de baneo: {before - len(gdf)}")

print(f"Total de registros finales: {len(gdf)}")
print("Guardando resultado...")
gdf.to_parquet(output_path, index=False)
print(f"Archivo guardado en: {output_path}")
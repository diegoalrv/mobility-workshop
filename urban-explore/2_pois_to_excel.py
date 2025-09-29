import geopandas as gpd
import pandas as pd
import os

# Ruta de entrada y salida
input_path = './data/pois_categorizados_filtrados.parquet'  # Ajusta si tu archivo tiene otro nombre o extensión
output_path = './data/banned.xlsx'

# Leer los datos de POIs
gdf = gpd.read_parquet(input_path)

# Seleccionar columnas útiles para identificar los POIs
# Ajusta los nombres de columnas según tu archivo
cols_to_keep = ['name', 'category']
cols_present = [col for col in cols_to_keep if col in gdf.columns]
gdf_filtered = gdf[cols_present]
df = pd.DataFrame(gdf_filtered)
# Guardar a Excel para filtrar manualmente
os.makedirs('./data', exist_ok=True)
df.to_excel(output_path, index=False)

print(f'Archivo generado en: {output_path}')
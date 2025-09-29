import pandas as pd

input_path = './data/pois_categorizados_filtrados.parquet'
banned_path = './data/banned.xlsx'
output_path = './data/pois_categorizados_filtrados_refinados.parquet'

print("Leyendo datos principales...")
df = pd.read_parquet(input_path)
print(f"Total de registros cargados: {len(df)}")

print("Leyendo lista de nombres baneados...")
banned_df = pd.read_excel(banned_path)
banned_names = set(banned_df.iloc[:, 0].dropna().astype(str).str.strip())
print(f"Nombres baneados cargados: {len(banned_names)}")

print("Filtrando registros sin nombre o vacíos...")
before = len(df)
df = df[df['name'].notna() & (df['name'].str.strip() != '')]
print(f"Registros eliminados por nombre vacío: {before - len(df)}")

print("Filtrando registros con nombres baneados...")
before = len(df)
df = df[~df['name'].astype(str).str.strip().isin(banned_names)]
print(f"Registros eliminados por estar en la lista de baneo: {before - len(df)}")

print(f"Total de registros finales: {len(df)}")
print("Guardando resultado...")
df.to_parquet(output_path, index=False)
print(f"Archivo guardado en: {output_path}")
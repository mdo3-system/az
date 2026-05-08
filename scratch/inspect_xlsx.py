import pandas as pd

file_path = 'data/長期軸力.xlsx'
try:
    df = pd.read_excel(file_path, header=None)
    print("Excel Data (First 10 rows):")
    print(df.head(10))
except Exception as e:
    print(f"Error: {e}")

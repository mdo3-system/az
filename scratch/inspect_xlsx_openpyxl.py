try:
    import openpyxl
    wb = openpyxl.load_workbook('data/長期軸力.xlsx')
    sheet = wb.active
    print("Excel Data (First 10 rows):")
    for i, row in enumerate(sheet.iter_rows(max_row=10, values_only=True)):
        print(f"Row {i}: {row}")
except Exception as e:
    print(f"Error: {e}")

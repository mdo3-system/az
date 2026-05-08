import openpyxl

file_path = 'data/長期軸力.xlsx'
try:
    wb = openpyxl.load_workbook(file_path, data_only=True)
    sheet = wb.active
    
    current_floor = "1"
    last_id = ""
    extracted = []
    
    for row in sheet.iter_rows(min_row=3, values_only=True):
        raw_id = str(row[0]).strip() if row[0] else ""
        if raw_id and not raw_id.isdigit():
            last_id = raw_id
        
        floor = str(row[1]).strip() if row[1] else ""
        val = row[7]
        
        if last_id and floor == current_floor and val is not None:
            extracted.append((last_id, val))
            
    print(f"Extracted for Floor {current_floor}:")
    print(extracted)
except Exception as e:
    print(f"Error: {e}")

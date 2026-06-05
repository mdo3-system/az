import requests
import sys

# 標準出力を UTF-8 に
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

url = 'http://127.0.0.1:8000/api/v1/merge-floors'
files_to_send = {
    'file_1f': ('1F20260605.dxf', open('data/1F20260605.dxf', 'rb'), 'application/octet-stream'),
    'file_2f': ('2F20260605.dxf', open('data/2F20260605.dxf', 'rb'), 'application/octet-stream'),
    'file_3f': ('3F20260605.dxf', open('data/3F20260605.dxf', 'rb'), 'application/octet-stream'),
}

print('Sending actual user DXFs to:', url)
try:
    resp = requests.post(url, files=files_to_send, timeout=30)
    print('Response Status:', resp.status_code)
    if resp.status_code == 200:
        print('SUCCESS! Response size:', len(resp.content), 'bytes')
    else:
        print('FAIL:', resp.text[:500])
except Exception as e:
    print('Request error:', e)
finally:
    for f in files_to_send.values():
        f[1].close()

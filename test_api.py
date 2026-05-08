import requests, os

url = 'http://127.0.0.1:8000/api/v1/merge-floors'
files_to_send = {}
for label, fname in [('file_1f', 'data/1F.dxf')]:
    if os.path.exists(fname):
        files_to_send[label] = (os.path.basename(fname), open(fname, 'rb'), 'application/octet-stream')

print('Sending request to:', url)
try:
    resp = requests.post(url, files=files_to_send, timeout=120)
    print('Status:', resp.status_code)
    if resp.status_code == 200:
        print('SUCCESS! size:', len(resp.content), 'bytes')
        print('Starts with:', resp.content[:80])
        # 保存して確認
        with open('test_merge_result.dxf', 'wb') as f:
            f.write(resp.content)
        print('Saved to test_merge_result.dxf')
    else:
        print('Error:', resp.text[:2000])
finally:
    for f in files_to_send.values():
        try:
            f[1].close()
        except:
            pass

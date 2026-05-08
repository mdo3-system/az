import requests, os

url = 'http://127.0.0.1:8000/api/v1/merge-floors'
files_to_send = {
    'file_1f': ('1F.dxf', open('data/1F.dxf', 'rb'), 'application/octet-stream'),
    'file_2f': ('2F.dxf', open('data/2F.dxf', 'rb'), 'application/octet-stream'),
    'file_3f': ('RF.dxf', open('data/RF.dxf', 'rb'), 'application/octet-stream'),
}

print('Sending all 3 floors to:', url)
try:
    resp = requests.post(url, files=files_to_send, timeout=300)
    print('Status:', resp.status_code)
    if resp.status_code == 200:
        print('SUCCESS! size:', len(resp.content), 'bytes')
        with open('test_merge_3floors.dxf', 'wb') as f:
            f.write(resp.content)
        print('Saved to test_merge_3floors.dxf')
        
        # 内容確認
        import ezdxf
        doc = ezdxf.readfile('test_merge_3floors.dxf')
        msp = list(doc.modelspace())
        layers = sorted(set(e.dxf.layer for e in msp))
        print(f'\nTotal entities: {len(msp)}')
        glid = [l for l in layers if 'GLID' in l]
        col = [l for l in layers if l.startswith('COL')]
        wall_b = [l for l in layers if 'WALL_BRACED' in l]
        wall_n = [l for l in layers if 'WALL_NORMAL' in l]
        print('GLID layers:', glid)
        print('COL layers:', col)
        print('WALL_BRACED layers:', wall_b)
        print('WALL_NORMAL layers:', wall_n)
    else:
        print('Error:', resp.text[:1000])
finally:
    for f in files_to_send.values():
        try:
            f[1].close()
        except:
            pass

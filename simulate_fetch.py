import httpx
from pathlib import Path

def test_api():
    filepath = Path(r"d:\Dropbox\■設計ｻﾎﾟｰﾄ\■note\antigravity\az\data\小屋伏図.dxf")
    url = "http://127.0.0.1:8000/api/v1/analyze-floor"
    
    with open(filepath, "rb") as f:
        files = {"dxf_file": (filepath.name, f, "application/octet-stream")}
        data = {
            "wall_layers": '["LAYER31"]',
            "floor_layers": '["LAYER79", "LAYER110"]',
            "min_area": "10000.0",
            "generate_images": "true"
        }
        print("Sending POST request to running API...")
        try:
            r = httpx.post(url, data=data, files=files, timeout=30.0)
            print("Status Code:", r.status_code)
            print("Response:", r.json())
        except Exception as e:
            print("Request crashed!", type(e), e)

if __name__ == "__main__":
    test_api()

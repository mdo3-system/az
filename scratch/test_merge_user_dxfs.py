import sys
import os
import time

# プロジェクトのルートをインポートパスに追加
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from az_bridge.dxf_merger import merge_dxf_files

files_dict = {
    "1F": "data/1F20260605.dxf",
    "2F": "data/2F20260605.dxf",
    "3F": "data/3F20260605.dxf"
}

print("Starting merge_dxf_files test...")
start_time = time.time()
try:
    output_fn, total_lines = merge_dxf_files(files_dict)
    end_time = time.time()
    print("Merge completed successfully!")
    print(f"Time taken: {end_time - start_time:.2f} seconds")
    print(f"Output file: {output_fn}")
    print(f"Output file size: {os.path.getsize(output_fn)} bytes ({os.path.getsize(output_fn)/1024/1024:.2f} MB)")
    print(f"Total lines: {total_lines}")
    
    # テスト出力なので一時ファイルを削除
    if os.path.exists(output_fn):
        os.remove(output_fn)
except Exception as e:
    import traceback
    print(f"Error during merge: {e}")
    traceback.print_exc()

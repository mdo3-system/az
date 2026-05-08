import os

base_dir = r"e:\Dropbox\■設計ｻﾎﾟｰﾄ\■note\antigravity\az\frontend\assets\js\modules\foundation"
files_info = []

for root, dirs, files in os.walk(base_dir):
    for file in files:
        if file.endswith(".js"):
            path = os.path.join(root, file)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    lines = len(f.readlines())
                files_info.append({"name": file, "lines": lines, "path": path})
            except Exception as e:
                pass

files_info.sort(key=lambda x: x["lines"], reverse=True)

print("Top 15 files by line count:")
for i, info in enumerate(files_info[:15]):
    print(f"{i+1}. {info['name']} ({info['lines']} lines) - {info['path']}")

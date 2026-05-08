import re
import os

f_path = r'd:\Dropbox\■設計ｻﾎﾟｰﾄ\■note\antigravity\az\frontend\assets\js\modules\foundation\foundation_main.js'

with open(f_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix the corrupted lines after `;`
# We look for the part that says `1.33` and `</div>` shortly after a `;`
pattern_corrupt = re.compile(r'`;\s+.*1\.33.*?\n\s+</div>', re.DOTALL)
new_content = pattern_corrupt.sub('`;', content)

# 2. Fix the slab button text and mojibake
# We search for the button with openSlabDetailModal and update its text.
pattern_btn = re.compile(r'<button onclick="window\.openSlabDetailModal\(\$\{index\}\)"[^>]+>.*?</button>', re.DOTALL)
replacement_btn = r'<button onclick="window.openSlabDetailModal(${index})" style="width:100%; padding:8px; background:#55efc4; color:#1a1a2e; border:none; border-radius:4px; font-weight:bold; cursor:pointer; font-size:11px;">💻 詳細計算根拠を表示</button>'
new_content = pattern_btn.sub(replacement_btn, new_content)

with open(f_path, 'w', encoding='utf-8', newline='') as f:
    f.write(new_content)

print(f"Fix completed. Original length: {len(content)}, New length: {len(new_content)}")

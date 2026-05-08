/**
 * JWW to DXF 変換・最適化モーダル
 */
export const showJwwModal = async () => {
    // モーダルのHTML基盤
    const modalHtml = `
        <div id="jwwModal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:3000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(8px);">
            <div style="background:var(--bg-panel); width:95%; max-width:1200px; height:85%; border-radius:16px; border:1px solid var(--border); display:flex; flex-direction:column; overflow:hidden; box-shadow:0 24px 48px rgba(0,0,0,0.5);">
                <!-- Header -->
                <div style="padding:20px 24px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.02);">
                    <div>
                        <h2 style="font-size:18px; color:#fff; margin:0; display:flex; align-items:center; gap:10px;">
                            <i class="fas fa-file-export" style="color:var(--accent);"></i> JWW to DXF レイヤ整理・原点補正
                        </h2>
                        <p style="font-size:11px; color:var(--text-secondary); margin-top:4px;">JWWファイルを構造計算に最適化された実寸のDXFに変換します</p>
                    </div>
                    <button id="closeJwwModal" style="background:none; border:none; color:var(--text-secondary); font-size:24px; cursor:pointer;">&times;</button>
                </div>

                <!-- Main Content -->
                <div style="flex:1; display:flex; overflow:hidden;">
                    <!-- Left: Layer Table -->
                    <div style="width:550px; border-right:1px solid var(--border); display:flex; flex-direction:column; background:rgba(255,255,255,0.01);">
                        <div style="padding:15px; background:rgba(255,255,255,0.03); border-bottom:1px solid var(--border);">
                            <input type="file" id="jwwFileInput" accept=".jww" style="display:none;">
                            <button id="btnSelectJww" class="tool-btn" style="width:100%; justify-content:center; background:var(--accent); color:white; border:none; font-weight:bold;">
                                <i class="fas fa-upload"></i> JWWファイルをアップロード
                            </button>
                        </div>
                        <div id="jwwLayerTableContainer" style="flex:1; overflow-y:auto; padding:0;">
                            <div style="padding:40px; text-align:center; color:var(--text-muted);">
                                JWWファイルを選択して解析を開始してください
                            </div>
                        </div>
                    </div>

                    <!-- Right: Preview & Origin -->
                    <div style="flex:1; display:flex; flex-direction:column; position:relative;">
                        <div style="position:absolute; top:15px; left:15px; z-index:10; background:rgba(0,0,0,0.6); padding:8px 12px; border-radius:8px; border:1px solid rgba(255,255,255,0.1); pointer-events:none;">
                            <div style="color:var(--accent); font-weight:bold; font-size:11px;">原点指定プレビュー</div>
                            <div style="font-size:10px; color:#ccc;">通り芯の交点など、新原点(0,0)にしたい点をクリックしてください</div>
                        </div>
                        <canvas id="jwwPreviewCanvas" style="width:100%; height:100%; background:#111; cursor:crosshair;"></canvas>
                        <div id="originCoords" style="position:absolute; bottom:15px; right:15px; background:rgba(0,0,0,0.8); color:var(--success); font-family:var(--mono); padding:4px 10px; border-radius:4px; font-size:11px; border:1px solid var(--success);">
                            原点：(0, 0)
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div style="padding:16px 24px; border-top:1px solid var(--border); display:flex; justify-content:flex-end; gap:12px; background:rgba(255,255,255,0.02);">
                    <div id="jwwStatus" style="margin-right:auto; align-self:center; font-size:12px; color:var(--success);"></div>
                    <button id="btnCancelJww" class="tool-btn">キャンセル</button>
                    <button id="btnExportDxf" class="tool-btn" style="background:var(--success); color:white; border:none; padding:8px 24px; font-weight:bold; opacity:0.5;" disabled>
                        <i class="fas fa-check-circle"></i> DXFを出力してダウンロード
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // 内部状態
    let layerData = [];
    let selectedOrigin = { x: 0, y: 0 };
    let currentJwwFile = null;

    // イベント登録
    const close = () => {
        const m = document.getElementById('jwwModal');
        if (m) m.remove();
    };
    document.getElementById('closeJwwModal').onclick = close;
    document.getElementById('btnCancelJww').onclick = close;

    document.getElementById('btnSelectJww').onclick = () => document.getElementById('jwwFileInput').click();
    document.getElementById('jwwFileInput').onchange = async (e) => {
        if (!e.target.files[0]) return;
        currentJwwFile = e.target.files[0];
        await analyzeJww(currentJwwFile);
    };

    /**
     * API呼出: 解析
     */
    async function analyzeJww(file) {
        const formData = new FormData();
        formData.append('file', file);
        
        const status = document.getElementById('jwwStatus');
        status.innerText = "⏳ 解析中...";
        status.style.color = "orange";

        try {
            // 注意: バックエンドURLを環境に合わせて調整
            const resp = await fetch('http://localhost:8000/analyze-jww', {
                method: 'POST',
                body: formData
            });
            if (!resp.ok) throw new Error("解析に失敗しました");
            const data = await resp.json();
            
            layerData = data.layers;
            renderLayerTable();
            // 簡易的なプレビュー描画（実際には図形データを受け取る処理が必要）
            initPreviewCanvas();
            
            status.innerText = "✅ 解析完了";
            status.style.color = "#27ae60";
            document.getElementById('btnExportDxf').disabled = false;
            document.getElementById('btnExportDxf').style.opacity = 1;
        } catch (err) {
            status.innerText = "❌ エラー: " + err.message;
            status.style.color = "#e74c3c";
        }
    }

    function initPreviewCanvas() {
        const canvas = document.getElementById('jwwPreviewCanvas');
        const ctx = canvas.getContext('2d');
        // コンテナに合わせてリサイズ
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;

        ctx.strokeStyle = '#333';
        ctx.beginPath();
        for(let i=0; i<canvas.width; i+=50) { ctx.moveTo(i,0); ctx.lineTo(i,canvas.height); }
        for(let i=0; i<canvas.height; i+=50) { ctx.moveTo(0,i); ctx.lineTo(canvas.width,i); }
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = '12px sans-serif';
        ctx.fillText("プレビュー（モック表示）", 20, 40);

        canvas.onclick = (e) => {
            const rx = e.offsetX;
            const ry = e.offsetY;
            // 実際には世界座標へ逆変換してセット
            selectedOrigin = { x: rx, y: ry };
            document.getElementById('originCoords').innerText = `原点指定：(${Math.round(rx)}, ${Math.round(ry)})`;
            
            // ポインター描画
            renderLayerTable(); // 再描画は不要だが、プレビュー更新
            ctx.strokeStyle = '#00ff00';
            ctx.beginPath();
            ctx.arc(rx, ry, 5, 0, Math.PI*2);
            ctx.stroke();
        };
    }

    /**
     * レイヤテーブルの描画
     */
    function renderLayerTable() {
        const container = document.getElementById('jwwLayerTableContainer');
        container.innerHTML = `
            <table style="width:100%; border-collapse:collapse; font-size:11px; color:#ddd;">
                <thead style="position:sticky; top:0; background:rgba(40,40,40,0.95); z-index:5;">
                    <tr>
                        <th style="padding:10px; text-align:left; color:#888;">ID</th>
                        <th style="padding:10px; text-align:left; color:#888;">元の名称</th>
                        <th style="padding:10px; text-align:left; color:#888;">新名称・下絵統合</th>
                        <th style="padding:10px; text-align:center; color:#888;">削除</th>
                    </tr>
                </thead>
                <tbody>
                    ${layerData.map(l => `
                        <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                            <td style="padding:8px 10px; opacity:0.6; font-family:monospace;">${l.id}</td>
                            <td style="padding:8px 10px;">${l.name}</td>
                            <td style="padding:8px 10px;">
                                <div style="display:flex; gap:6px; align-items:center;">
                                    <input type="text" class="jww-new-name" data-id="${l.id}" placeholder="名称変更..." style="flex:1; background:#222; border:1px solid #444; color:#fff; padding:4px 8px; border-radius:4px; font-size:10px;">
                                    <label title="BASE_MAPレイヤに統合（下絵用）" style="display:flex; align-items:center; gap:4px; font-size:10px; cursor:pointer;">
                                        <input type="checkbox" class="jww-merge-check" data-id="${l.id}"> 統合
                                    </label>
                                </div>
                            </td>
                            <td style="padding:8px 10px; text-align:center;">
                                <input type="checkbox" class="jww-delete-check" data-id="${l.id}">
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    /**
     * API呼出: 変換・ダウンロード
     */
    document.getElementById('btnExportDxf').onclick = async () => {
        if (!currentJwwFile) return;

        const mapping = {};
        layerData.forEach(l => {
            const row = document.querySelector(`.jww-new-name[data-id="${l.id}"]`);
            const isDelete = document.querySelector(`.jww-delete-check[data-id="${l.id}"]`).checked;
            const isMerge = document.querySelector(`.jww-merge-check[data-id="${l.id}"]`).checked;
            
            mapping[l.id] = {
                action: isDelete ? 'delete' : (isMerge ? 'merge' : 'keep'),
                newName: row ? row.value.trim() : ""
            };
        });

        const formData = new FormData();
        formData.append('file', currentJwwFile);
        formData.append('origin_x', selectedOrigin.x);
        formData.append('origin_y', selectedOrigin.y);
        formData.append('settings', JSON.stringify(mapping));

        const btn = document.getElementById('btnExportDxf');
        const status = document.getElementById('jwwStatus');
        btn.disabled = true;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> 変換中...`;

        try {
            const resp = await fetch('http://localhost:8000/convert-to-dxf', {
                method: 'POST',
                body: formData
            });
            if (!resp.ok) throw new Error("変換に失敗しました");
            
            const blob = await resp.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = currentJwwFile.name.replace(".jww", "_AZ_OPTIMIZED.dxf");
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            
            status.innerText = "✨ 変換完了！";
            status.style.color = "#2ecc71";
            setTimeout(close, 1500);
        } catch (err) {
            alert("エラー: " + err.message);
            btn.disabled = false;
            btn.innerHTML = `<i class="fas fa-check-circle"></i> DXFを出力`;
        }
    };
};

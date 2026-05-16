import { makeDraggable, safeRemoveById } from '../ui_utils.js';

/**
 * 操作マニュアルモーダルを表示する
 */
export const openManualModal = () => {
    safeRemoveById('manual-modal-overlay');

    const overlay = document.createElement('div');
    overlay.id = 'manual-modal-overlay';
    overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); z-index:10000; display:flex; justify-content:center; align-items:center;';
    
    const content = document.createElement('div');
    content.style.cssText = 'width:95%; max-width:1100px; height:85vh; background:#fff; border-radius:12px; box-shadow:0 20px 60px rgba(0,0,0,0.4); display:flex; flex-direction:column; overflow:hidden; color:#333; position:relative;';

    content.innerHTML = `
        <!-- ヘッダー -->
        <div id="manual-modal-header" style="background:#2c3e50; color:#fff; padding:15px 25px; display:flex; justify-content:space-between; align-items:center; cursor:grab; flex-shrink:0;">
            <h2 style="margin:0; font-size:18px; display:flex; align-items:center; gap:10px;">
                <span style="font-size:22px;">📖</span> 操作マニュアル & ガイドライン
            </h2>
            <button id="close-manual-btn" style="background:none; border:none; color:#fff; font-size:28px; cursor:pointer; line-height:1;">&times;</button>
        </div>

        <!-- メインコンテンツ領域 -->
        <div style="flex:1; overflow-y:auto; display:flex; background:#f4f7f6;">
            <!-- サイドナビ -->
            <div style="width:220px; background:#e9ecef; border-right:1px solid #dee2e6; padding:20px 10px; flex-shrink:0;">
                <ul style="list-style:none; padding:0; margin:0; font-size:14px;">
                    <li class="manual-nav-item active" data-target="intro" style="padding:10px 15px; cursor:pointer; border-radius:6px; margin-bottom:5px; background:#2c3e50; color:#fff;">ツールの目的</li>
                    <li class="manual-nav-item" data-target="workflow" style="padding:10px 15px; cursor:pointer; border-radius:6px; margin-bottom:5px;">基本ワークフロー</li>
                    <li class="manual-nav-item" data-target="ui-layout" style="padding:10px 15px; cursor:pointer; border-radius:6px; margin-bottom:5px;">画面構成の説明</li>
                    <li class="manual-nav-item" data-target="tools" style="padding:10px 15px; cursor:pointer; border-radius:6px; margin-bottom:5px;">作図ツールの詳細</li>
                    <li class="manual-nav-item" data-target="modal-column" style="padding:10px 15px; cursor:pointer; border-radius:6px; margin-bottom:5px;">柱モーダルの見方</li>
                    <li class="manual-nav-item" data-target="modal-wall" style="padding:10px 15px; cursor:pointer; border-radius:6px; margin-bottom:5px;">耐力壁モーダルの見方</li>
                    <li class="manual-nav-item" data-target="modal-beam" style="padding:10px 15px; cursor:pointer; border-radius:6px; margin-bottom:5px;">基礎梁モーダルの見方</li>
                    <li class="manual-nav-item" data-target="modal-slab" style="padding:10px 15px; cursor:pointer; border-radius:6px; margin-bottom:5px;">スラブモーダルの見方</li>
                    <li class="manual-nav-item" data-target="important" style="padding:10px 15px; cursor:pointer; border-radius:6px; margin-bottom:5px;">重要事項・注意点</li>
                </ul>
            </div>

            <!-- 本文 -->
            <div id="manual-body-content" style="flex:1; padding:30px; background:#fff; line-height:1.7;">
                <!-- コンテンツはJSで切り替え -->
            </div>
        </div>

        <style>
            .manual-nav-item:not(.active):hover { background: #dee2e6; }
            #manual-body-content h3 { border-left: 5px solid #e67e22; padding-left: 12px; color: #2c3e50; margin-top: 30px; margin-bottom: 15px; font-size: 18px; }
            #manual-body-content p { margin-bottom: 15px; font-size: 14px; }
            .step-box { background: #f8f9fa; border: 1px solid #dee2e6; padding: 15px; border-radius: 8px; margin-bottom: 15px; position: relative; padding-left: 50px; }
            .step-num-badge { position: absolute; left: 15px; top: 15px; background: #2c3e50; color: #fff; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; }
            .tool-grid { display: grid; grid-template-columns: 120px 1fr; gap: 10px; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px; }
            .tool-name { font-weight: bold; color: #e67e22; }
            .ui-point { background: #2c3e50; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; margin-right: 5px; }
        </style>
    `;

    const bodyContent = content.querySelector('#manual-body-content');
    const navItems = content.querySelectorAll('.manual-nav-item');

    const sections = {
        intro: `
            <h2 style="margin-top:0;">🛠 ツールの目的と位置づけ</h2>
            <div style="background:#fff8f0; border:1px solid #ffe8cc; padding:20px; border-radius:8px; margin-bottom:20px;">
                <p>本ツールは、<strong>ARCHITREND ZERO（アーキトレンド）</strong>で一貫計算ができない「平面斜め壁」を有する建物において、以下の計算・検定を補完するための設計支援ツールです。</p>
                <ul>
                    <li><strong>水平構面（屋根・床）</strong>の計算</li>
                    <li><strong>引張耐力</strong>の集計と金物設定</li>
                    <li><strong>基礎梁・基礎スラブ</strong>の構造計算</li>
                </ul>
                <p style="font-weight:bold; color:#c0392b;">※本ツールでは必要耐力の算出や壁バランスの計算、横架材の計算は行いません。これらはすべてアーキトレンド側で行います。</p>
            </div>
        `,
        workflow: `
            <h2 style="margin-top:0;">🔄 基本ワークフロー</h2>
            <div class="step-box"><span class="step-num-badge">1</span><strong>耐力按分の算出</strong>：斜め壁の耐力を本ツールで按分し、その数値をアーキトレンドに登録します。</div>
            <div class="step-box"><span class="step-num-badge">2</span><strong>全体設計</strong>：アーキトレンド側で全体の構造計算（壁配置・バランス・梁の設計等）を完了させます。</div>
            <div class="step-box"><span class="step-num-badge">3</span><strong>DXF読込</strong>：アーキトレンドから書き出したDXFを左パネルからアップロードし「構造用DXFに統合・解析」を実行します。</div>
            <div class="step-box"><span class="step-num-badge">4</span><strong>グリッド・符号の調整</strong>：読み込みきれなかったグリッドの整理を行います。<span style="color:#c0392b;">要素は必ずグリッド交点に配置される</span>ため、意匠図と100%整合させてください。</div>
            <div class="step-box"><span class="step-num-badge">5</span><strong>斜め通り芯・柱の作図</strong>：自動配置されなかった斜め通り芯や柱を追加作図します。</div>
            <div class="step-box"><span class="step-num-badge">6</span><strong>符号の強制整合</strong>：左パネルの「全符号を通り芯に強制整合」ボタンを押し、要素名をグリッド名に同期させます。</div>
            <div class="step-box"><span class="step-num-badge">7</span><strong>耐力壁・構面の作図</strong>：意匠図通りに耐力壁を配置し、構面を入力します。<br>
                <div style="margin-top:8px; padding:10px; background:#fff5f5; border:1px solid #feb2b2; border-radius:4px; color:#c53030; font-weight:bold;">
                    ⚠️【最重要】すべての壁に対し、必ず「耐力倍率」または「通り名」を設定してください！<br>
                    設定がない壁は、計算対象（水平構面・引張力）から完全に除外され、重大な設計ミスに直結します。
                </div>
            </div>
            <div class="step-box"><span class="step-num-badge">8</span><strong>スラブ・基礎梁の作図</strong>：基礎設計に必要な要素を配置し、断面検定を行います。</div>
            <div class="step-box"><span class="step-num-badge">9</span><strong>保存と出力</strong>：適宜JSONファイルを保存しながら進め、最終的な計算書（PDF）を出力します。</div>
        `,
        'ui-layout': `
            <h2 style="margin-top:0;">📱 画面構成の説明</h2>
            <div style="margin-bottom:25px; border:1px solid #ddd; border-radius:8px; overflow:hidden; box-shadow:0 5px 15px rgba(0,0,0,0.1);">
                <img src="manual/screen01.png" alt="画面構成" style="width:100%; height:auto; display:block;">
            </div>
            <p>画面は大きく4つのエリアで構成されています。</p>
            
            <h3>1. 左パネル：データ管理と設定</h3>
            <p><span class="ui-point">A</span> <strong>DXF読込</strong>：各階の平面図を読み込み、構造モデルに変換します。</p>
            <p><span class="ui-point">B</span> <strong>符号整合</strong>：通り芯名を変更した際、要素側の符号を一括で同期させる重要ボタンです。</p>
            <p><span class="ui-point">C</span> <strong>外部連携</strong>：XLSXからのNw読込や、壁軸力立面図の表示を行います。</p>
            <p><span class="ui-point">D</span> <strong>表示切替</strong>：下絵の表示/非表示や、各要素のレイヤー表示を管理します。</p>

            <h3>2. 右パネル：作図ツールと属性編集</h3>
            <p><span class="ui-point">E</span> <strong>作図ツール</strong>：グリッドから基礎梁まで、モデルを構築するすべてのツールが集約されています。</p>
            <p><span class="ui-point">F</span> <strong>全体設計条件</strong>：コンクリート強度や積雪量など、プロジェクト全体のパラメータを設定します。</p>
            <p><span class="ui-point">G</span> <strong>プロパティ</strong>：選択した要素の詳細（梁成、鉄筋、金物等）を表示・編集します。</p>

            <h3>3. 上部：階層切り替え</h3>
            <p>1F（基礎）からPH階までを切り替えます。「全体」表示では全階層を重ねて確認できます。</p>

            <h3>4. 中央：メインキャンバス</h3>
            <p>CAD操作を行うメイン領域です。マウスホイールで拡大縮小、右ドラッグで移動が可能です。</p>
        `,
        tools: `
            <h2 style="margin-top:0;">📐 作図ツールの詳細説明</h2>
            
            <div class="tool-grid"><div class="tool-name">グリッド</div><div>直交する通り芯を作成します。端点の座標を指定し、ラベル（X1, Y1等）を付与します。</div></div>
            <div class="tool-grid"><div class="tool-name">斜め通り芯</div><div>任意の2点を結ぶ通り芯を作成します。斜め壁の配置基準となります。</div></div>
            <div class="tool-grid"><div class="tool-name">柱</div><div>グリッドの交点に「ノード」を作成します。構造計算の起点となります。</div></div>
            <div class="tool-grid"><div class="tool-name">耐力壁</div><div>2つのノード間に配置します。耐力倍率や壁厚を設定します。</div></div>
            <div class="tool-grid"><div class="tool-name">構面</div><div><strong>長方形</strong>：対角2点をクリック。<br><strong>多角形</strong>：頂点を順にクリック。斜め壁がある場合は多角形を使用します。</div></div>
            <div class="tool-grid"><div class="tool-name">スラブ</div><div>基礎スラブの範囲を指定します。AIJ略算式による断面検定が可能です。</div></div>
            <div class="tool-grid"><div class="tool-name">基礎梁</div><div>柱間に配置します。応力解析を行い、主筋・スターラップの検定を行います。</div></div>
            <div class="tool-grid"><div class="tool-name">削除</div><div>クリックした要素を削除します。</div></div>
            <div class="tool-grid"><div class="tool-name">選択</div><div>要素をクリックしてプロパティパネルを開きます。断面寸法の変更などはここで行います。</div></div>
        `,
        'modal-column': `
            <h2 style="margin-top:0;">🏠 柱プロパティ詳細（引張耐力検討）</h2>
            <div style="margin-bottom:25px; border:1px solid #ddd; border-radius:8px; overflow:hidden; box-shadow:0 5px 15px rgba(0,0,0,0.1);">
                <img src="manual/post.png" alt="柱モーダル" style="width:100%; height:auto; display:block;">
            </div>
            <p>柱をクリックして開くこのモーダルでは、柱の引張耐力（T値）の算定と金物選定を行います。</p>
            <div style="background:#fff8f0; border:1px solid #ffe8cc; padding:15px; border-radius:8px; margin-bottom:20px; font-size:13px;">
                <strong>💡 計算基準について</strong><br>
                本ツールの引張耐力および金物選定の計算式・計算表はすべて<strong>「グレー本（木造軸組工法住宅の許容応力度設計）」に完全に準拠</strong>しており、アーキトレンド ゼロと同じ構成・ロジックで出力されます。
            </div>

            <h3>1. 基本設定</h3>
            <p><strong>引張耐力検討用軸力 Nw</strong>：引張力を低減させるための長期軸力です。アーキトレンドからインポートされた値、または手入力した値を使用します。</p>
            <p><strong>Bi係数 / 個別階高 Hi / 反曲点高比 B</strong>：地震時の引き抜き力（Ni）を算出するための係数です。通常は「自動判定」で問題ありませんが、特殊な形状の場合は個別設定が可能です。</p>

            <h3>2. 上階累積軸力 ΣNi (手入力上書き)</h3>
            <p>複雑な平面形状において、システムによる自動的な軸力追従を補正したい場合に使用します。通り芯ごとに、左加力・右加力それぞれの累積軸力を個別に設定できます。</p>

            <h3>3. 金物選定（引張判定）</h3>
            <p><strong>柱頭 (Top) / 柱脚 (Base)</strong> それぞれの必要引張力（T値）に対し、金物耐力（Ra）が上回っているかを判定します。</p>
            <ul>
                <li><strong>自動選定</strong>：マスターリストから必要耐力を満たす最小の金物を自動的に割り当てます。</li>
                <li><strong>判定表示</strong>：<code>T値 <= Ra</code> であれば <span style="color:#27ae60; font-weight:bold;">OK</span>、不足していれば <span style="color:#e74c3c; font-weight:bold;">NG</span> と表示されます。</li>
            </ul>

            <h3>4. 引張力 算定根拠詳細（テーブル）</h3>
            <p>アーキトレンドの計算書と同じフォーマットで、T値算出のプロセスをすべて開示しています。</p>
            <ul>
                <li><strong>ΣΔQiL×Hi / ΣΔQiR×Hi</strong>：加力方向別のモーメント集計値。</li>
                <li><strong>Ni (頭/脚)</strong>：当該階での引き抜き力。</li>
                <li><strong>T値</strong>：最終的な必要引張力。<code>T = (Ni + 上階ΣNi) * Bi - (Nw * 0.8)</code> の式に基づきます。</li>
            </ul>
        `,
        'modal-wall': `
            <h2 style="margin-top:0;">🧱 耐力壁プロパティ詳細</h2>
            <div style="margin-bottom:25px; border:1px solid #ddd; border-radius:8px; overflow:hidden; box-shadow:0 5px 15px rgba(0,0,0,0.1);">
                <img src="manual/wall.png" alt="耐力壁モーダル" style="width:100%; height:auto; display:block;">
            </div>

            <div style="background:#fff5f5; border:2px solid #feb2b2; padding:20px; border-radius:8px; margin-bottom:25px;">
                <h3 style="margin-top:0; color:#c53030; border-left-color:#c53030;">🚨 鉄の掟：壁設定の徹底</h3>
                <p style="font-size:16px; font-weight:bold; color:#c53030; margin-bottom:10px;">
                    作図した「すべての壁」において、以下のいずれか、あるいは両方を必ず設定してください。
                </p>
                <ul style="color:#c53030; font-weight:bold;">
                    <li>耐力倍率（0以上）</li>
                    <li>通り名（軸名）</li>
                </ul>
                <p style="font-size:13px; color:#666;">
                    ※これらが未設定（空欄や0）の壁は、システム上で「存在しないもの」として扱われ、水平構面の検定や柱の引張耐力集計に一切反映されません。
                </p>
            </div>

            <h3>1. 基本設定</h3>
            <p><strong>符号 / 壁長</strong>：意匠図・構造図と整合させてください。</p>
            <p><strong>耐力倍率</strong>：水平構面（床・屋根）の計算に使用されます。斜め壁の場合は、この倍率を基にX方向・Y方向への按分耐力が算出されます。</p>

            <h3>2. 通り名（軸名）の設定</h3>
            <p><strong>通り名（例: X1, Y2, X2-X3など）</strong>：柱の引張耐力を集計するためのキーとなります。耐力壁がどの通り芯上に乗っているかを指定することで、その通り芯全体の引き抜き力が正しく計算されます。</p>
            <p style="background:#e9ecef; padding:10px; border-radius:4px; font-size:13px;">
                💡 <strong>ヒント</strong>：左パネルの「全符号を通り芯に強制整合」ボタンを使用すると、配置済みの壁に最も近い通り芯名が自動的にセットされます。<br>
                <span style="color:#c53030; font-weight:bold;">※通り芯が極めて近接している場合、意図しない隣の通り芯が選択される可能性があるため、実行後は必ず一通りの確認を行ってください。</span>
            </p>
        `,
        'modal-beam': `
            <h2 style="margin-top:0;">横架材・基礎梁プロパティ詳細</h2>
            <p>基礎梁をクリックして開くこのモーダルでは、配筋の設定、応力計算結果の確認、および断面検定を行います。</p>

            <h3 style="border-left:4px solid var(--primary); padding-left:10px;">1. 基本情報と配筋設定</h3>
            <div style="margin-bottom:15px; border:1px solid #ddd; border-radius:8px; overflow:hidden; box-shadow:0 5px 15px rgba(0,0,0,0.1);">
                <img src="manual/f01.png" alt="基礎梁基本設定" style="width:100%; height:auto; display:block;">
            </div>
            <ul>
                <li><strong>符号 / コンクリート / 形状</strong>：梁の断面寸法（幅・成）とコンクリート強度を設定します。</li>
                <li><strong>配筋入力</strong>：上端筋、下端筋、腹筋、肋筋（スターラップ）の径と本数を指定します。これらは断面検定の「許容耐力」に直接反映されます。</li>
            </ul>

            <h3 style="border-left:4px solid var(--accent); padding-left:10px;">2. 応力計算結果（M・Q図）</h3>
            <div style="margin-bottom:15px; border:1px solid #ddd; border-radius:8px; overflow:hidden; box-shadow:0 5px 15px rgba(0,0,0,0.1);">
                <img src="manual/f02.png" alt="基礎梁応力図" style="width:100%; height:auto; display:block;">
            </div>
            <p><strong>応力図 (Diagram)</strong>：地震時および長期荷重によって梁に生じる曲げモーメント（M）とせん断力（Q）を可視化しています。中央の表には、端部（左・右）および中央部での最大応力が数値で表示されます。</p>

            <h3 style="border-left:4px solid var(--success); padding-left:10px;">3. 断面検定と算定根拠</h3>
            <div style="margin-bottom:15px; border:1px solid #ddd; border-radius:8px; overflow:hidden; box-shadow:0 5px 15px rgba(0,0,0,0.1);">
                <img src="manual/f03.png" alt="基礎梁断面検定" style="width:100%; height:auto; display:block;">
            </div>
            <p><strong>検定計算結果</strong>：グレー本に準拠した詳細な検定結果です。以下の項目が自動計算されます。</p>
            <ul>
                <li><strong>必要鉄筋量 vs 実配筋量</strong>：設定した主筋が、生じているモーメントに対して不足していないか（at > at_req）を判定します。</li>
                <li><strong>コンクリートのせん断検定</strong>：肋筋（スターラップ）とコンクリート断面がせん断力に対して安全かを確認します。</li>
                <li><strong>総合判定</strong>：すべてOKであれば「検定比（応力/許容耐力）」が1.0以下となり、緑色の「OK」が表示されます。</li>
            </ul>
        `,
        'modal-slab': `
            <h2 style="margin-top:0;">🌊 基礎スラブ・土間スラブの断面検定</h2>
            <div style="margin-bottom:25px; border:1px solid #ddd; border-radius:8px; overflow:hidden; box-shadow:0 5px 15px rgba(0,0,0,0.1);">
                <img src="manual/s01.png" alt="スラブモーダル" style="width:100%; height:auto; display:block;">
            </div>

            <div style="background:#fff8f0; border:2px solid #e67e22; padding:20px; border-radius:8px; margin-bottom:25px;">
                <h3 style="margin-top:0; color:#d35400; border-left-color:#d35400;">📢 スラブ設計の重要ポイント</h3>
                <p style="font-size:15px; font-weight:bold; color:#d35400; margin-bottom:10px;">
                    1. 接地圧はアーキトレンドから正確に転載すること
                </p>
                <p style="font-size:13px; color:#333; margin-bottom:15px;">
                    計算に使用する「接地圧 (kN/㎡)」は、ARCHITREND ZERO の基礎計算結果から、対象となるスラブ位置の最大接地圧を正確に転載してください。この数値が断面検定のすべての基礎となります。
                </p>
                <p style="font-size:15px; font-weight:bold; color:#d35400; margin-bottom:10px;">
                    2. 支持条件を必ず個別に設定すること
                </p>
                <p style="font-size:13px; color:#333;">
                    スラブの各辺が「固定（基礎梁に接合）」「ピン」「自由（端部）」のいずれであるかを、意匠図・構造図に基づき必ず設定してください。支持条件の選択により、AIJ略算式の係数が変動し、計算結果が大きく変わります。
                </p>
            </div>

            <h3>1. スラブ基本設定</h3>
            <p><strong>スラブ厚 (D) / かぶり厚 (dt)</strong>：設計仕様に合わせます。一般的に基礎スラブは150mm以上、かぶりは70mm程度です。</p>
            <p><strong>配筋設定 (X方向・Y方向)</strong>：使用する鉄筋の径とピッチを入力します。シングル配筋・ダブル配筋それぞれの検定に対応しています。</p>

            <h3>2. 断面検定結果テーブル</h3>
            <p><strong>AIJ略算式による検定</strong>：スラブの短辺(Lx)と長辺(Ly)の比率、および支持条件から、生じる最大モーメントを算出します。</p>
            <ul>
                <li><strong>必要断面積 (at)</strong>：モーメントに対して必要な鉄筋量です。</li>
                <li><strong>検定比</strong>：<code>生じている応力 / 許容耐力</code>。1.0以下（OK）となるよう配筋を調整してください。</li>
                <li><strong>接地圧の確認</strong>：転載した接地圧が正しいか、再度チェックを行ってください。</li>
            </ul>
        `,
        important: `
            <h2 style="margin-top:0;">⚠️ 重要事項・制限事項</h2>
            <ul>
                <li><strong>グリッド整合性</strong>：要素を配置した後にグリッドを削除すると、要素が浮いてしまい計算エラーとなります。グリッド名の整合を最初に行ってください。</li>
                <li><strong>水平構面の貼り分け</strong>：斜め軸回転モデルでは、原則として1つの構面領域内に複数の仕様（倍率）を混在させないでください。</li>
                <li><strong>自動保存</strong>：ブラウザの更新などでデータが消える可能性があるため、こまめに左パネル下の「保存（JSON）」を行ってください。</li>
            </ul>
        `
    };

    const updateSection = (target) => {
        bodyContent.innerHTML = sections[target];
        navItems.forEach(item => {
            if (item.getAttribute('data-target') === target) {
                item.classList.add('active');
                item.style.background = '#2c3e50';
                item.style.color = '#fff';
            } else {
                item.classList.remove('active');
                item.style.background = 'none';
                item.style.color = '#333';
            }
        });
    };

    updateSection('intro');

    navItems.forEach(item => {
        item.addEventListener('click', () => updateSection(item.getAttribute('data-target')));
    });

    content.querySelector('#close-manual-btn').addEventListener('click', () => safeRemoveById('manual-modal-overlay'));
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) safeRemoveById('manual-modal-overlay');
    });

    overlay.appendChild(content);
    document.body.appendChild(overlay);
    makeDraggable(content, content.querySelector('#manual-modal-header'));
};

window.openManualModal = openManualModal;

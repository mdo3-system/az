# AZ斜め壁補助計算Web-CAD 確定済み計算ロジック定義 (FIXED_LOGICS)

本ドキュメントは、本システムに実装されている全構造計算プロセスの主要な数式およびロジックを公式に定義するものである。

## 1. 斜め耐力壁の算定ロジック

### 1.1 換算壁倍率の分解
斜め方向に配置された耐力壁の倍率 $P$ を、配置角度 $\theta$（垂直軸からの時計回りの角度）に基づき X方向・Y方向に分解する。
*   **X方向換算倍率 ($Px$)**: $Px = P \times \sin^2\theta$
*   **Y方向換算倍率 ($Py$)**: $Py = P \times \cos^2\theta$
※ 物理的な剛性配分に基づき、$\cos \theta$ や $\sin \theta$ ではなく、二乗（$\sin^2, \cos^2$）を適用して分解する。

---

## 2. 水平構面の検討ロジック

### 2.1 等価置き換えモデル (形状低減 η)
不整形な構面を整形な矩形として評価するための換算式。
*   **実面積 ($S$)**: 構面ポリゴンの面積 (m²)
*   **最大奥行 ($L_{max}$)**: 検討方向の最大寸法 (m)
*   **等価奥行 ($L_{eq}$)**: $L_{eq} = S / B_{max}$ ($B_{max}$ は支持幅)
*   **形状低減係数 ($\eta$)**: $\eta = L_{eq} / L_{max}$
*   **有効奥行 ($L_{red}$)**: $L_{red} = L_{eq} \times \eta = \frac{S}{B_{max}} \times \frac{S / B_{max}}{L_{max}}$

### 2.2 斜め軸回転モデル (グレー本 3-7節 準拠)
斜め軸を主軸とした座標変換を行い、単純梁モデルで検定する。
*   **座標回転**: $\begin{pmatrix} x' \\ y' \end{pmatrix} = \begin{pmatrix} \cos\theta & -\sin\theta \\ \sin\theta & \cos\theta \end{pmatrix} \begin{pmatrix} x \\ y \end{pmatrix}$
*   **有効耐力壁線の判定 ($Pa$)**: 
    $$Pa = \sum (P \times L \times \Delta Qa \times \text{effFactor})$$
    判定条件：$Pa \ge 0.6 \times h \times \Delta Qa$ かつ $Pa \ge 7.0$ (kN)
*   **区間検定公式**:
    *   **地震力 ($QE$)**: $QE = 0.24 \times \alpha \times \Delta Qa \times h \times L$
    *   **風圧力 ($QW$)**: $QW = 1.7 \times \alpha \times L$
    *   **判定**: $\Delta Qa \times h \ge \max(QE, QW)$
    ※ $\alpha$: 中間壁がある場合は 1.6、ない場合は 1.0。

---

## 3. 柱の引張力（N値・T値）算定ロジック

### 3.1 階ごとの壁せん断力の抽出
各柱に接する壁から、通り芯方向の力を抽出する。
*   **壁せん断力 ($Q \cdot H$)**: $Q \cdot H = 1.96 \times P \times H$ (kN・m)
    *   $P$: 壁倍率、 $H$: 階高 (m)
*   **柱頭・柱脚の偶力 ($N_i$)**:
    *   $N_{i,top} = (Q \cdot H_{right} - Q \cdot H_{left}) \times B_{i,top}$
    *   $N_{i,bot} = (Q \cdot H_{right} - Q \cdot H_{left}) \times B_{i,bot}$
    ※ $B_i$: 反曲点高比（通常 0.5、隅柱などは 0.8）

### 3.2 累積引張力 (T値) の算定
*   **柱頭引張力 ($T_{top}$)**: $T_{top} = (N_{i,top} + \sum N_{upper}) - Nw$
*   **柱脚引張力 ($T_{bot}$)**: $T_{bot} = (N_{i,bot} + \sum N_{upper}) - Nw$
    *   $\sum N_{upper}$: 上階からの累積引張力
    *   $Nw$: 柱に作用する長期軸力による押さえ効果（低減）

---

## 4. 金物選定および判定

### 4.1 金物選定基準
算出された引張力 $T$ に対し、金物マスタから以下の条件を満たす最小の金物を選定する。
*   **判定条件**: $T \le Ta - 0.5$ (kN)
    *   $Ta$: 金物の許容引張耐力
    *   $0.5$: 独自の安全側マージン（検定用余裕値）

---

## 5. 基礎計算（スラブ・基礎梁）

### 5.1 基礎スラブ応力算定
*   **モーメント**: $M = C \times \sigma_e \times lx^2$
*   **必要鉄筋量 ($at$)**: $at = \frac{M \times 10^6}{ft \times j}$ ($j = \frac{7}{8}d$)

### 5.2 基礎梁への荷重伝達
*   **合算負担幅 ($B_{total}$)**: $\sum B_{side}$
*   **加重平均接地圧 ($\sigma_{e,avg}$)**: $\frac{\sum (\sigma_{side} \times B_{side})}{\sum B_{side}}$
*   **長期応力算定**: $M_{mid} = \frac{w L^2}{8}, \quad M_{end} = \frac{w L^2}{12}$
